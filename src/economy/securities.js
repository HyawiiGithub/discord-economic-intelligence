'use strict';

const db = require('../db');
const accounts = require('./accounts');
const companies = require('./companies');
const { nowIso, formatMoney, pctChange } = require('../money');

const TRADE_FEE_BPS = 20;
const SPREAD_BPS = 100;
const MAX_TRADE_SHARE_OF_CAP_BPS = 1000;

function companyOrThrow(guildId, companyId) {
    const company = companies.get(guildId, companyId);
    if (!company) throw new Error('company not found');
    return company;
}
function quote(guildId, companyId) {
    const company = companyOrThrow(guildId, companyId);
    const fin = companies.financials(guildId, company.id);
    const last = Math.max(1, Number(company.last_price_cents) || 1);
    return {
        company,
        bid: Math.max(1, Math.floor(last * (10000 - SPREAD_BPS) / 10000)),
        ask: Math.max(1, Math.ceil(last * (10000 + SPREAD_BPS) / 10000)),
        last,
        marketCap: last * Number(company.shares_outstanding),
        bookValue: fin.bookValue,
        public: !!company.public,
    };
}
function ipo(guildId, actorId, companyId, offerRef) {
    const company = companyOrThrow(guildId, companyId);
    if (String(company.owner_user_id) !== String(actorId)) throw new Error('only the owner can list the company');
    if (company.public) throw new Error('company is already publicly listed');
    if (Number(company.shares_outstanding) < 100) throw new Error('company has too few shares');
    const fin = companies.financials(guildId, company.id);
    const fundamental = fin.cash + fin.inventoryValue + Math.max(0, fin.profit) * 6;
    const offer = offerRef
        ? Math.max(1, Math.trunc(Number(offerRef) || 0))
        : Math.max(1, Math.floor(fundamental / Math.max(1, Number(company.shares_outstanding))));
    db.run(`UPDATE companies SET public = 1, publicly_listed_at = ?, share_price_cents = ?, last_price_cents = ?, updated_at = ? WHERE guild_id = ? AND id = ?`,
        [nowIso(), offer, offer, nowIso(), guildId, company.id]);
    db.audit(guildId, actorId, 'company_ipo', { companyId: company.id, offer, fundamental });
    return { companyId: company.id, offer, fundamental, shares: Number(company.shares_outstanding) };
}
function buy(guildId, userId, companyId, totalRef) {
    accounts.ensureUser(guildId, userId);
    const company = companyOrThrow(guildId, companyId);
    if (!company.public) throw new Error('company is not publicly listed');
    const budget = Math.max(1, Math.trunc(Number(totalRef) || 0));
    const q = quote(guildId, company.id);
    const maxBudget = Math.max(q.ask, Math.floor(q.marketCap * MAX_TRADE_SHARE_OF_CAP_BPS / 10000));
    if (budget > maxBudget) throw new Error(`single order is limited to ${formatMoney(maxBudget, db.getGuild(guildId).currency_code)}`);
    const fee = Math.max(1, Math.floor(budget * TRADE_FEE_BPS / 10000));
    const spend = budget - fee;
    const shares = Math.floor(spend / q.ask);
    if (shares < 1) throw new Error('amount is below the current ask price');
    const cost = shares * q.ask;
    const charged = cost + fee;
    if (db.walletBalance(guildId, userId) < charged) throw new Error('insufficient wallet balance');
    db.post(guildId, 'share_purchase', userId, `Share purchase: ${company.name}`, [
        accounts.walletEntry(guildId, userId, -charged),
        accounts.companyEntry(guildId, company.id, 'cash', cost),
        accounts.governmentEntry(guildId, fee),
    ]);
    const at = nowIso();
    db.run(`INSERT INTO share_holdings (guild_id, company_id, user_id, shares, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, company_id, user_id) DO UPDATE SET shares = shares + excluded.shares, updated_at = excluded.updated_at`,
        [guildId, company.id, String(userId), shares, at]);
    const impact = Math.min(800, Math.floor(cost / Math.max(1, q.marketCap) * 2500));
    const price = Math.max(1, Math.floor(q.ask * (10000 + impact) / 10000));
    db.run('UPDATE companies SET shares_outstanding = shares_outstanding + ?, share_price_cents = ?, last_price_cents = ?, updated_at = ? WHERE guild_id = ? AND id = ?',
        [shares, price, price, at, guildId, company.id]);
    recordPrice(guildId, company.id, price);
    db.audit(guildId, userId, 'share_purchase', { companyId: company.id, shares, cost, fee, price });
    return { company, shares, cost, fee, charged, price, quote: q };
}
function sell(guildId, userId, companyId, sharesRef) {
    const company = companyOrThrow(guildId, companyId);
    if (!company.public) throw new Error('company is not publicly listed');
    const holding = db.get('SELECT * FROM share_holdings WHERE guild_id = ? AND company_id = ? AND user_id = ?',
        [guildId, company.id, String(userId)]);
    const shares = Math.max(1, Math.trunc(Number(sharesRef) || 0));
    if (!holding || Number(holding.shares) < shares) throw new Error('you do not hold that many shares');
    if (Number(company.shares_outstanding) - shares < 1) throw new Error('company cannot repurchase that many shares');
    const q = quote(guildId, company.id);
    const gross = shares * q.bid;
    const fee = Math.max(1, Math.floor(gross * TRADE_FEE_BPS / 10000));
    const net = gross - fee;
    if (db.balanceOf(guildId, 'company', String(company.id), 'cash') < gross) throw new Error('company has insufficient cash for the buyback');
    db.post(guildId, 'share_sale', userId, `Share sale: ${company.name}`, [
        accounts.companyEntry(guildId, company.id, 'cash', -gross),
        accounts.walletEntry(guildId, userId, net),
        accounts.governmentEntry(guildId, fee),
    ]);
    const at = nowIso();
    db.run('UPDATE share_holdings SET shares = shares - ?, updated_at = ? WHERE guild_id = ? AND company_id = ? AND user_id = ?',
        [shares, at, guildId, company.id, String(userId)]);
    const impact = Math.min(800, Math.floor(gross / Math.max(1, q.marketCap) * 2500));
    const price = Math.max(1, Math.floor(q.bid * (10000 - impact) / 10000));
    db.run('UPDATE companies SET shares_outstanding = shares_outstanding - ?, share_price_cents = ?, last_price_cents = ?, updated_at = ? WHERE guild_id = ? AND id = ?',
        [shares, price, price, at, guildId, company.id]);
    recordPrice(guildId, company.id, price);
    db.audit(guildId, userId, 'share_sale', { companyId: company.id, shares, gross, fee, price });
    return { company, shares, gross, fee, net, price, quote: q };
}
function recordPrice(guildId, companyId, price) {
    const guild = db.getGuild(guildId);
    const tick = Number(guild.last_cycle_tick) || 0;
    const company = companies.get(guildId, companyId);
    if (!company) return;
    db.run('INSERT INTO stock_prices (guild_id, company_id, tick, price_cents, market_cap_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, companyId, tick, price, price * Number(company.shares_outstanding), nowIso()]);
}
function history(guildId, companyId, limit) {
    return db.all('SELECT * FROM stock_prices WHERE guild_id = ? AND company_id = ? ORDER BY id DESC LIMIT ?',
        [guildId, Number(companyId), Math.max(2, Math.min(120, Number(limit) || 30))]).reverse();
}
function marketView(guildId) {
    const list = companies.list(guildId).map(company => {
        const q = quote(guildId, company.id);
        const lastRows = db.all('SELECT * FROM stock_prices WHERE guild_id = ? AND company_id = ? ORDER BY id DESC LIMIT 2',
            [guildId, company.id]);
        const previous = lastRows[1] ? Number(lastRows[1].price_cents) : q.last;
        return {
            company,
            quote: q,
            change: pctChange(q.last, previous) * 100,
            marketCap: q.marketCap,
            public: !!company.public,
        };
    });
    const publicList = list.filter(x => x.public);
    const totalCap = publicList.reduce((sum, x) => sum + x.marketCap, 0);
    return {
        companies: list,
        listed: publicList,
        totalMarketCap: totalCap,
        top: [...publicList].sort((a, b) => b.marketCap - a.marketCap).slice(0, 8),
        movers: [...publicList].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5),
    };
}
function runCycle(guildId, cycleTick) {
    const guild = db.getGuild(guildId);
    const tick = Number(cycleTick == null ? guild.last_cycle_tick : cycleTick) || 0;
    const publicList = companies.list(guildId).filter(company => company.public);
    const updated = [];
    for (const company of publicList) {
        const fin = companies.financials(guildId, company.id);
        const fundamental = Math.max(1, Math.floor((fin.cash + fin.inventoryValue + Math.max(0, fin.profit) * 6) / Math.max(1, Number(company.shares_outstanding))));
        const last = Math.max(1, Number(company.last_price_cents) || 1);
        const gap = (fundamental - last) / Math.max(1, last);
        const newsDrift = Number(company.news_pressure_bps) || 0;
        const drift = Math.max(-1500, Math.min(1500, Math.round(gap * 800) + newsDrift));
        const price = Math.max(1, Math.floor(last * (10000 + drift) / 10000));
        db.run('UPDATE companies SET share_price_cents = ?, last_price_cents = ?, updated_at = ? WHERE guild_id = ? AND id = ?',
            [price, price, nowIso(), guildId, company.id]);
        db.run('INSERT INTO stock_prices (guild_id, company_id, tick, price_cents, market_cap_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [guildId, company.id, tick, price, price * Number(company.shares_outstanding), nowIso()]);
        updated.push({ companyId: company.id, price, fundamental, drift });
    }
    return updated;
}
function holdings(guildId, userId) {
    return db.all(`SELECT h.*, c.name, c.ticker, c.sector, c.last_price_cents, c.public
        FROM share_holdings h JOIN companies c ON c.id = h.company_id AND c.guild_id = h.guild_id
        WHERE h.guild_id = ? AND h.user_id = ? AND h.shares > 0 ORDER BY h.shares DESC`, [guildId, String(userId)]);
}
function portfolioValue(guildId, userId) {
    return holdings(guildId, userId).reduce((sum, row) => sum + Number(row.shares) * Number(row.last_price_cents), 0);
}

module.exports = {
    TRADE_FEE_BPS,
    SPREAD_BPS,
    quote,
    ipo,
    buy,
    sell,
    recordPrice,
    history,
    marketView,
    runCycle,
    holdings,
    portfolioValue,
};
