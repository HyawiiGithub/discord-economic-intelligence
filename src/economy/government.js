'use strict';

const db = require('../db');
const accounts = require('./accounts');
const { nowIso, addMinutes, formatBps, formatMoney } = require('../money');

function treasury(guildId) {
    return accounts.treasuryBalance(guildId);
}
function spendToUser(guildId, actorId, userId, amount, category) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) throw new Error('spending amount must be positive');
    if (treasury(guildId) < value) throw new Error('treasury has insufficient funds');
    accounts.governmentToWallet(guildId, userId, value, 'government_spending', actorId);
    db.audit(guildId, actorId, 'treasury_spend', { userId, amount: value, category: category || 'general' });
    return value;
}
function spendToCompany(guildId, actorId, companyId, amount, category) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) throw new Error('spending amount must be positive');
    if (treasury(guildId) < value) throw new Error('treasury has insufficient funds');
    const company = db.get('SELECT * FROM companies WHERE guild_id = ? AND id = ?', [guildId, Number(companyId)]);
    if (!company) throw new Error('company not found');
    db.post(guildId, 'government_procurement', actorId, 'Government procurement', [
        accounts.governmentEntry(guildId, -value),
        accounts.companyEntry(guildId, company.id, 'cash', value),
    ]);
    db.audit(guildId, actorId, 'treasury_procurement', { companyId: company.id, amount: value, category: category || 'procurement' });
    return value;
}
function purchaseBond(guildId, userId, face, termCycles) {
    const value = Math.max(0, Math.trunc(Number(face) || 0));
    if (value < 1000) throw new Error('minimum bond purchase is 10.00');
    if (db.walletBalance(guildId, userId) < value) throw new Error('insufficient wallet balance');
    const guild = db.getGuild(guildId);
    const term = Math.max(1, Math.min(120, Math.trunc(Number(termCycles) || 12)));
    const rate = Math.max(0, Number(guild.policy_rate_bps) + 150);
    const at = nowIso();
    const result = db.run(`INSERT INTO bonds (guild_id, holder_id, face_cents, rate_bps, term_cycles, cycles_paid, status, next_due_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)`,
        [guildId, String(userId), value, rate, term, addMinutes(at, Number(guild.cycle_minutes) || 60), at, at]);
    db.post(guildId, 'bond_purchase', userId, 'Government bond purchase', [
        accounts.walletEntry(guildId, userId, -value),
        { accountId: accounts.acct(guildId, 'user', userId, 'bond').id, delta: value },
        accounts.governmentEntry(guildId, value),
        { accountId: accounts.acct(guildId, 'government', 'treasury', 'bond_liability').id, delta: -value },
    ]);
    db.audit(guildId, userId, 'bond_purchase', { bondId: Number(result.lastInsertRowid), face: value, rate, term });
    return { bondId: Number(result.lastInsertRowid), face: value, rate, term };
}
function serviceBond(guildId, bond) {
    const interest = Math.floor(Number(bond.face_cents) * Number(bond.rate_bps) / 120000);
    if (interest > 0) {
        if (treasury(guildId) < interest) {
            db.run('UPDATE bonds SET status = ?, updated_at = ? WHERE id = ?', ['delinquent', nowIso(), bond.id]);
            return { bondId: bond.id, interest, paid: 0, status: 'delinquent' };
        }
        db.post(guildId, 'bond_interest', 'government', 'Government bond interest', [
            accounts.governmentEntry(guildId, -interest),
            accounts.walletEntry(guildId, bond.holder_id, interest),
        ]);
    }
    const cycles = Number(bond.cycles_paid) + 1;
    let status = 'active';
    if (cycles >= Number(bond.term_cycles)) {
        const face = Number(bond.face_cents);
        if (treasury(guildId) < face) {
            status = 'matured_unpaid';
        } else {
            db.post(guildId, 'bond_maturity', 'government', 'Government bond redemption', [
                accounts.governmentEntry(guildId, -face),
                { accountId: accounts.acct(guildId, 'government', 'treasury', 'bond_liability').id, delta: face },
                { accountId: accounts.acct(guildId, 'user', bond.holder_id, 'bond').id, delta: -face },
                accounts.walletEntry(guildId, bond.holder_id, face),
            ]);
            status = 'redeemed';
        }
    }
    db.run('UPDATE bonds SET cycles_paid = ?, status = ?, next_due_at = ?, updated_at = ? WHERE id = ?',
        [cycles, status, addMinutes(nowIso(), Number(db.getGuild(guildId).cycle_minutes) || 60), nowIso(), bond.id]);
    return { bondId: bond.id, interest, paid: interest, status };
}
function runCycle(guildId) {
    const bonds = db.all(`SELECT * FROM bonds WHERE guild_id = ? AND status IN ('active','delinquent')`, [guildId]);
    const serviced = bonds.map(bond => serviceBond(guildId, bond));
    return { bondsServiced: serviced.length, bonds: serviced };
}
function summary(guildId) {
    const balance = treasury(guildId);
    const revenueRow = db.get(`SELECT COALESCE(SUM(e.delta), 0) AS total
        FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
        WHERE e.guild_id = ? AND e.account_id = ? AND e.delta > 0 AND t.kind <> 'bond_purchase'`, [
        guildId,
        accounts.acct(guildId, 'government', 'treasury', 'treasury').id,
    ]);
    const spendingRow = db.get(`SELECT COALESCE(SUM(CASE WHEN t.kind IN ('government_spending','government_procurement','bond_interest','bond_maturity') THEN -e.delta ELSE 0 END), 0) AS total
        FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
        WHERE e.guild_id = ? AND e.account_id = ? AND e.delta < 0`, [
        guildId,
        accounts.acct(guildId, 'government', 'treasury', 'treasury').id,
    ]);
    const bonds = db.get(`SELECT COUNT(*) AS n, COALESCE(SUM(face_cents), 0) AS face FROM bonds WHERE guild_id = ? AND status IN ('active','delinquent','matured_unpaid')`, [guildId]);
    return {
        balance,
        revenue: Number(revenueRow && revenueRow.total) || 0,
        spending: Number(spendingRow && spendingRow.total) || 0,
        bonds: Number(bonds && bonds.n) || 0,
        bondFace: Number(bonds && bonds.face) || 0,
    };
}
function bondsFor(guildId, userId) {
    return db.all('SELECT * FROM bonds WHERE guild_id = ? AND holder_id = ? ORDER BY id DESC', [guildId, String(userId)]);
}
function summaryText(guildId) {
    const s = summary(guildId);
    return [
        `Treasury balance **${formatMoney(s.balance, db.getGuild(guildId).currency_code)}**`,
        `Recorded tax revenue **${formatMoney(s.revenue, db.getGuild(guildId).currency_code)}**`,
        `Recorded expenditure **${formatMoney(s.spending, db.getGuild(guildId).currency_code)}**`,
        `Outstanding bonds **${s.bonds}** (face **${formatMoney(s.bondFace, db.getGuild(guildId).currency_code)}**)`,
        `Policy rate **${formatBps(db.getGuild(guildId).policy_rate_bps)}**`,
    ].join('\n');
}

module.exports = {
    treasury,
    spendToUser,
    spendToCompany,
    purchaseBond,
    serviceBond,
    runCycle,
    summary,
    bondsFor,
    summaryText,
};
