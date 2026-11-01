'use strict';

const db = require('../db');
const accounts = require('./accounts');
const tax = require('./taxes');
const { SECTORS, GOODS } = require('../config');
const { nowIso, toMinor, formatMoney, formatBps } = require('../money');

const SHARES_DEFAULT = 1000;
const CAPITAL_DEFAULT = 50000;
const CAPITAL_MIN = 10000;
const CAPITAL_MAX = 100000000;

function normalizeSector(value) {
    const key = String(value || '').trim().toLowerCase();
    return SECTORS[key] ? key : null;
}
function tickerBase(name) {
    const letters = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return (letters.slice(0, 5) || 'CO').padEnd(3, 'X');
}
function uniqueTicker(guildId, base) {
    let ticker = String(base || 'CO').slice(0, 6);
    let suffix = 1;
    while (db.get('SELECT id FROM companies WHERE guild_id = ? AND ticker = ?', [guildId, ticker])) {
        ticker = `${String(base).slice(0, 4)}${suffix}`.slice(0, 6);
        suffix += 1;
        if (suffix > 999) throw new Error('could not allocate a ticker');
    }
    return ticker;
}
function get(guildId, id) {
    return db.get('SELECT * FROM companies WHERE guild_id = ? AND id = ?', [guildId, Number(id)]);
}
function find(guildId, query) {
    const q = String(query || '').trim();
    if (!q) return null;
    return db.get('SELECT * FROM companies WHERE guild_id = ? AND (id = ? OR ticker = ? OR lower(name) = lower(?))',
        [guildId, Number(q) || -1, q.toUpperCase(), q])
        || db.get('SELECT * FROM companies WHERE guild_id = ? AND lower(name) LIKE ? ORDER BY id LIMIT 1',
            [guildId, `%${q.toLowerCase()}%`]);
}
function list(guildId, includeInactive) {
    return db.all(`SELECT * FROM companies WHERE guild_id = ? ${includeInactive ? '' : "AND status = 'active'"} ORDER BY id`, [guildId]);
}
function ensureCompanyAccounts(guildId, companyId) {
    return {
        cash: accounts.acct(guildId, 'company', String(companyId), 'cash'),
        loan: accounts.acct(guildId, 'company', String(companyId), 'loan'),
    };
}
function create(guildId, ownerId, name, sectorRef, description, capitalRef) {
    accounts.ensureUser(guildId, ownerId);
    const sector = normalizeSector(sectorRef);
    if (!sector) throw new Error('unknown sector');
    const label = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (label.length < 3) throw new Error('company name must be at least 3 characters');
    if (db.get('SELECT id FROM companies WHERE guild_id = ? AND lower(name) = lower(?)', [guildId, label])) {
        throw new Error('a company with that name already exists');
    }
    const info = SECTORS[sector];
    const fee = info.license_fee;
    const capital = Math.max(CAPITAL_MIN, Math.min(CAPITAL_MAX, Math.trunc(Number(capitalRef) || CAPITAL_DEFAULT)));
    const wallet = db.walletBalance(guildId, ownerId);
    if (wallet < fee + capital) throw new Error(`need ${formatMoney(fee + capital, db.getGuild(guildId).currency_code)} for the licence and capital`);
    const at = nowIso();
    const ticker = uniqueTicker(guildId, tickerBase(label));
    const result = db.run(`INSERT INTO companies
        (guild_id, name, ticker, sector, owner_user_id, description, shares_outstanding, share_price_cents, last_price_cents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [guildId, label, ticker, sector, String(ownerId), String(description || '').slice(0, 240), SHARES_DEFAULT, Math.max(1, Math.floor(capital / SHARES_DEFAULT)), Math.max(1, Math.floor(capital / SHARES_DEFAULT)), at, at]);
    const companyId = Number(result.lastInsertRowid);
    ensureCompanyAccounts(guildId, companyId);
    db.post(guildId, 'company_formation', ownerId, 'Company formation', [
        accounts.walletEntry(guildId, ownerId, -(fee + capital)),
        accounts.governmentEntry(guildId, fee),
        accounts.companyEntry(guildId, companyId, 'cash', capital),
    ]);
    db.run('INSERT INTO share_holdings (guild_id, company_id, user_id, shares, updated_at) VALUES (?, ?, ?, ?, ?)',
        [guildId, companyId, String(ownerId), SHARES_DEFAULT, at]);
    db.audit(guildId, ownerId, 'company_created', { companyId, name: label, sector, fee, capital });
    return financials(guildId, companyId);
}
function setPriceModifier(guildId, companyId, bps, actorId) {
    const value = Math.max(8000, Math.min(12000, Math.trunc(Number(bps) || 10000)));
    db.run('UPDATE companies SET price_modifier_bps = ?, updated_at = ? WHERE guild_id = ? AND id = ?',
        [value, nowIso(), guildId, Number(companyId)]);
    db.audit(guildId, actorId, 'company_price_modifier', { companyId, bps: value });
    return value;
}
function postJob(guildId, actorId, companyId, title, wageRef, slotsRef) {
    const company = get(guildId, companyId);
    if (!company) throw new Error('company not found');
    if (String(company.owner_user_id) !== String(actorId)) throw new Error('only the company owner can post jobs');
    const sector = SECTORS[company.sector];
    const wage = Math.max(Number(sector && sector.wage_floor) || 100, Math.trunc(Number(wageRef) || 0));
    const slots = Math.max(1, Math.min(50, Math.trunc(Number(slotsRef) || 1)));
    const label = String(title || '').trim().slice(0, 50) || 'Staff';
    const at = nowIso();
    const result = db.run('INSERT INTO jobs (guild_id, company_id, title, wage_cents, slots, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
        [guildId, company.id, label, wage, slots, at, at]);
    db.audit(guildId, actorId, 'job_created', { companyId: company.id, jobId: Number(result.lastInsertRowid), title: label, wage, slots });
    return { id: Number(result.lastInsertRowid), companyId: company.id, title: label, wage, slots };
}
function jobs(guildId, companyId) {
    return db.all(`SELECT j.*, (SELECT COUNT(*) FROM employment e WHERE e.guild_id = j.guild_id AND e.job_id = j.id) AS filled
        FROM jobs j WHERE j.guild_id = ? AND j.company_id = ? AND j.active = 1 ORDER BY j.id`, [guildId, Number(companyId)]);
}
function allJobs(guildId) {
    return db.all(`SELECT j.*, c.name AS company_name, c.ticker, c.sector,
        (SELECT COUNT(*) FROM employment e WHERE e.guild_id = j.guild_id AND e.job_id = j.id) AS filled
        FROM jobs j JOIN companies c ON c.id = j.company_id AND c.guild_id = j.guild_id
        WHERE j.guild_id = ? AND j.active = 1 AND c.status = 'active' ORDER BY j.wage_cents DESC, j.id`, [guildId]);
}
function employmentOf(guildId, userId) {
    return db.get(`SELECT e.*, j.title, j.active AS job_active, c.name AS company_name, c.ticker, c.sector, c.status AS company_status
        FROM employment e
        JOIN jobs j ON j.id = e.job_id AND j.guild_id = e.guild_id
        JOIN companies c ON c.id = e.company_id AND c.guild_id = e.guild_id
        WHERE e.guild_id = ? AND e.user_id = ?`, [guildId, String(userId)]);
}
function applyJob(guildId, userId, jobId) {
    accounts.ensureUser(guildId, userId);
    if (employmentOf(guildId, userId)) throw new Error('you already hold a position; resign first');
    const job = db.get(`SELECT j.*, c.status AS company_status FROM jobs j JOIN companies c ON c.id = j.company_id AND c.guild_id = j.guild_id
        WHERE j.guild_id = ? AND j.id = ? AND j.active = 1`, [guildId, Number(jobId)]);
    if (!job) throw new Error('job not found');
    if (job.company_status !== 'active') throw new Error('that company is not active');
    const filled = db.get('SELECT COUNT(*) AS n FROM employment WHERE guild_id = ? AND job_id = ?', [guildId, job.id]).n;
    if (Number(filled) >= Number(job.slots)) throw new Error('that position is filled');
    const at = nowIso();
    db.run('INSERT INTO employment (guild_id, user_id, company_id, job_id, wage_cents, started_at) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, String(userId), job.company_id, job.id, job.wage_cents, at]);
    db.audit(guildId, userId, 'employment_started', { jobId: job.id, companyId: job.company_id, wage: job.wage_cents });
    return employmentOf(guildId, userId);
}
function resign(guildId, userId) {
    const current = employmentOf(guildId, userId);
    if (!current) throw new Error('you are not employed');
    db.run('DELETE FROM employment WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]);
    db.audit(guildId, userId, 'employment_ended', { jobId: current.job_id, companyId: current.company_id });
    return current;
}
function addInventory(guildId, companyId, goodKey, quantity) {
    const qty = Math.trunc(Number(quantity) || 0);
    if (!qty) return;
    db.run(`INSERT INTO inventory (guild_id, company_id, good_key, quantity, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, company_id, good_key) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at`,
        [guildId, Number(companyId), String(goodKey), qty, nowIso()]);
}
function inventory(guildId, companyId) {
    return db.all(`SELECT i.*, gm.price_cents FROM inventory i
        LEFT JOIN goods_market gm ON gm.guild_id = i.guild_id AND gm.good_key = i.good_key
        WHERE i.guild_id = ? AND i.company_id = ? AND i.quantity > 0 ORDER BY i.good_key`, [guildId, Number(companyId)]);
}
function inventoryValue(guildId, companyId) {
    return inventory(guildId, companyId).reduce((sum, row) => sum + Number(row.quantity) * Number(row.price_cents || 0), 0);
}
function work(guildId, userId) {
    const profile = accounts.ensureUser(guildId, userId).profile;
    const current = employmentOf(guildId, userId);
    if (!current) throw new Error('you are not employed; find a job with `-jobs`');
    if (current.company_status !== 'active' || !current.job_active) throw new Error('your position is no longer active');
    const guild = db.getGuild(guildId);
    const cooldown = Math.max(1, Number(guild.work_cooldown_min) || 1);
    if (profile.last_work_at) {
        const elapsed = (Date.now() - new Date(profile.last_work_at).getTime()) / 60000;
        if (elapsed < cooldown) throw new Error(`your next shift is available in ${Math.ceil(cooldown - elapsed)} minutes`);
    }
    const gross = Number(current.wage_cents) || 0;
    const payroll = tax.payroll(guildId, gross);
    const cost = gross + payroll;
    if (db.balanceOf(guildId, 'company', String(current.company_id), 'cash') < cost) {
        throw new Error('the company cannot meet this payroll');
    }
    const income = tax.income(guildId, gross);
    db.post(guildId, 'wage_payment', userId, `Wage payment: ${current.company_name}`, [
        accounts.companyEntry(guildId, current.company_id, 'cash', -cost),
        accounts.walletEntry(guildId, userId, income.net),
        accounts.governmentEntry(guildId, income.tax + payroll),
    ]);
    const info = SECTORS[current.sector] || SECTORS.retail;
    const output = Math.max(1, Math.round(info.productivity * (0.9 + Math.random() * 0.2)));
    addInventory(guildId, current.company_id, info.good, output);
    db.run('UPDATE profiles SET last_work_at = ?, total_income = total_income + ?, total_tax = total_tax + ?, updated_at = ? WHERE guild_id = ? AND user_id = ?',
        [nowIso(), gross, income.tax, nowIso(), guildId, String(userId)]);
    db.run('UPDATE companies SET wages_cents = wages_cents + ?, expenses_cents = expenses_cents + ?, updated_at = ? WHERE guild_id = ? AND id = ?',
        [gross, cost, nowIso(), guildId, current.company_id]);
    db.run('UPDATE goods_market SET supply = supply + ?, updated_at = ? WHERE guild_id = ? AND good_key = ?',
        [output, nowIso(), guildId, info.good]);
    db.audit(guildId, userId, 'work', { companyId: current.company_id, gross, net: income.net, tax: income.tax, payroll, output });
    return {
        gross,
        net: income.net,
        incomeTax: income.tax,
        payrollTax: payroll,
        output,
        good: info.good,
        company: current.company_name,
        title: current.title,
        nextAt: new Date(Date.now() + cooldown * 60000).toISOString(),
    };
}
function sellGoods(guildId, userId, companyId, goodKey, quantity) {
    accounts.ensureUser(guildId, userId);
    const qty = Math.max(1, Math.trunc(Number(quantity) || 0));
    const company = get(guildId, companyId);
    if (!company) throw new Error('company not found');
    const stock = db.get('SELECT * FROM inventory WHERE guild_id = ? AND company_id = ? AND good_key = ?', [guildId, company.id, String(goodKey || '')]);
    if (!stock || Number(stock.quantity) < qty) throw new Error('insufficient inventory');
    const good = db.get('SELECT * FROM goods_market WHERE guild_id = ? AND good_key = ?', [guildId, goodKey]);
    if (!good) throw new Error('unknown good');
    const unit = Math.max(1, Math.floor(Number(good.price_cents) * Number(company.price_modifier_bps) / 10000));
    const net = unit * qty;
    const vat = tax.vat(guildId, net);
    const total = net + vat;
    if (db.walletBalance(guildId, userId) < total) throw new Error(`need ${formatMoney(total, db.getGuild(guildId).currency_code)}`);
    db.post(guildId, 'goods_sale', userId, `Purchase from ${company.name}`, [
        accounts.walletEntry(guildId, userId, -total),
        accounts.companyEntry(guildId, company.id, 'cash', net),
        accounts.governmentEntry(guildId, vat),
    ]);
    db.run('UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE guild_id = ? AND company_id = ? AND good_key = ?',
        [qty, nowIso(), guildId, company.id, goodKey]);
    db.run('UPDATE companies SET revenue_cents = revenue_cents + ?, updated_at = ? WHERE guild_id = ? AND id = ?',
        [net, nowIso(), guildId, company.id]);
    db.run('UPDATE goods_market SET sales_volume = sales_volume + ?, demand = demand + ?, updated_at = ? WHERE guild_id = ? AND good_key = ?',
        [qty, qty, nowIso(), guildId, goodKey]);
    db.audit(guildId, userId, 'goods_sale', { companyId: company.id, goodKey, quantity: qty, net, vat });
    return { company, goodKey, quantity: qty, unit, net, vat, total };
}
function dividend(guildId, actorId, companyId) {
    const company = get(guildId, companyId);
    if (!company) throw new Error('company not found');
    if (String(company.owner_user_id) !== String(actorId)) throw new Error('only the owner can declare a dividend');
    const cash = db.balanceOf(guildId, 'company', String(company.id), 'cash');
    if (cash <= 0) throw new Error('company has no distributable cash');
    const amount = cash;
    const holders = db.all('SELECT * FROM share_holdings WHERE guild_id = ? AND company_id = ? AND shares > 0',
        [guildId, company.id]);
    if (!holders.length) throw new Error('company has no shareholders');
    const totalShares = holders.reduce((sum, h) => sum + Number(h.shares), 0);
    const entries = [accounts.companyEntry(guildId, company.id, 'cash', -amount)];
    let distributed = 0;
    let taxTotal = 0;
    for (const holder of holders) {
        const gross = Math.floor(amount * Number(holder.shares) / totalShares);
        if (gross <= 0) continue;
        const income = tax.dividend(guildId, gross);
        entries.push(accounts.walletEntry(guildId, holder.user_id, income.net));
        taxTotal += income.tax;
        distributed += gross;
    }
    if (distributed <= 0) throw new Error('dividend amount is too small');
    if (distributed < amount) entries[0].delta += amount - distributed;
    if (taxTotal) entries.push(accounts.governmentEntry(guildId, taxTotal));
    db.post(guildId, 'dividend', actorId, `Dividend from ${company.name}`, entries);
    db.run('UPDATE companies SET dividends_cents = dividends_cents + ?, updated_at = ? WHERE guild_id = ? AND id = ?',
        [distributed, nowIso(), guildId, company.id]);
    db.audit(guildId, actorId, 'dividend', { companyId: company.id, amount: distributed, tax: taxTotal });
    return { amount: distributed, tax: taxTotal, holders: holders.length };
}
function runCycle(guildId, tick) {
    const active = list(guildId);
    const rows = [];
    for (const company of active) {
        const previous = db.get('SELECT * FROM company_flows WHERE guild_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1',
            [guildId, company.id]);
        const revenue = Number(company.revenue_cents) || 0;
        const expenses = Number(company.expenses_cents) || 0;
        const wages = Number(company.wages_cents) || 0;
        const taxes = Number(company.taxes_cents) || 0;
        const profit = revenue - expenses;
        const prevProfit = previous ? Number(previous.profit_cents) || 0 : 0;
        const periodProfit = profit - prevProfit;
        const at = nowIso();
        const taxDue = tax.corporate(guildId, Math.max(0, periodProfit));
        let taxPaid = 0;
        if (taxDue > 0) {
            const cash = db.balanceOf(guildId, 'company', String(company.id), 'cash');
            taxPaid = Math.min(taxDue, Math.max(0, cash));
            if (taxPaid > 0) {
                accounts.companyToGovernment(guildId, company.id, taxPaid, 'corporate_tax', 'system');
                db.run('UPDATE companies SET taxes_cents = taxes_cents + ?, updated_at = ? WHERE guild_id = ? AND id = ?',
                    [taxPaid, at, guildId, company.id]);
            }
            if (taxPaid < taxDue) {
                db.audit(guildId, null, 'corporate_tax_shortfall', { companyId: company.id, due: taxDue, paid: taxPaid });
            }
        }
        db.run(`INSERT INTO company_flows (guild_id, company_id, tick, revenue_cents, expenses_cents, wages_cents, taxes_cents, profit_cents, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [guildId, company.id, Number(tick) || 0, revenue, expenses, wages, taxes + taxPaid, profit, at]);
        db.run('UPDATE companies SET last_profit_cents = ?, last_tax_cents = ?, updated_at = ? WHERE guild_id = ? AND id = ?',
            [periodProfit, taxPaid, at, guildId, company.id]);
        rows.push({ companyId: company.id, periodProfit, taxDue, taxPaid });
    }
    return rows;
}
function financials(guildId, companyId) {
    const company = get(guildId, companyId);
    if (!company) return null;
    const cash = db.balanceOf(guildId, 'company', String(company.id), 'cash');
    const inv = inventory(guildId, company.id);
    const inventoryValueCents = inv.reduce((sum, row) => sum + Number(row.quantity) * Number(row.price_cents || 0), 0);
    const employees = db.get('SELECT COUNT(*) AS n FROM employment WHERE guild_id = ? AND company_id = ?', [guildId, company.id]).n;
    const openJobs = db.get(`SELECT COUNT(*) AS n FROM jobs WHERE guild_id = ? AND company_id = ? AND active = 1`, [guildId, company.id]).n;
    const holders = db.all(`SELECT h.user_id, h.shares, p.display_name FROM share_holdings h
        LEFT JOIN profiles p ON p.guild_id = h.guild_id AND p.user_id = h.user_id
        WHERE h.guild_id = ? AND h.company_id = ? AND h.shares > 0 ORDER BY h.shares DESC`, [guildId, company.id]);
    const marketCap = Number(company.last_price_cents) * Number(company.shares_outstanding);
    const book = cash + inventoryValueCents;
    const cumulativeProfit = Number(company.revenue_cents) - Number(company.expenses_cents);
    const periodProfit = Number(company.last_profit_cents) || 0;
    const periodTax = Number(company.last_tax_cents) || 0;
    return {
        ...company,
        cash,
        inventory: inv,
        inventoryValue: inventoryValueCents,
        employees: Number(employees) || 0,
        openJobs: Number(openJobs) || 0,
        holders,
        marketCap,
        bookValue: book,
        revenue: Number(company.revenue_cents) || 0,
        expenses: Number(company.expenses_cents) || 0,
        wages: Number(company.wages_cents) || 0,
        taxes: Number(company.taxes_cents) || 0,
        dividends: Number(company.dividends_cents) || 0,
        profit: periodProfit,
        profitAfterTax: periodProfit - periodTax,
        periodTax,
        cumulativeProfit,
    };
}
function listView(guildId) {
    return list(guildId).map(company => financials(guildId, company.id));
}
function sectorList() {
    return Object.entries(SECTORS).map(([key, info]) => ({ key, ...info, goodLabel: (GOODS[info.good] || {}).label || info.good }));
}

module.exports = {
    SHARES_DEFAULT,
    normalizeSector,
    get,
    find,
    list,
    create,
    setPriceModifier,
    postJob,
    jobs,
    allJobs,
    employmentOf,
    applyJob,
    resign,
    addInventory,
    inventory,
    inventoryValue,
    work,
    sellGoods,
    dividend,
    runCycle,
    financials,
    listView,
    sectorList,
};
