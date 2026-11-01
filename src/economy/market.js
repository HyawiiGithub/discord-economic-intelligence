'use strict';

const db = require('../db');
const accounts = require('./accounts');
const companies = require('./companies');
const bank = require('./bank');
const { GOODS } = require('../config');
const { nowIso, safeDiv } = require('../money');

function goodsList(guildId) {
    const rows = db.all(`SELECT gm.*, COALESCE((SELECT SUM(i.quantity) FROM inventory i WHERE i.guild_id = gm.guild_id AND i.good_key = gm.good_key), 0) AS stock
        FROM goods_market gm WHERE gm.guild_id = ? ORDER BY gm.good_key`, [guildId]);
    return rows.map(row => ({
        ...row,
        label: (GOODS[row.good_key] || {}).label || row.good_key,
        unit: (GOODS[row.good_key] || {}).unit || 'unit',
        base_price: (GOODS[row.good_key] || {}).base_price || row.price_cents,
        stock: Number(row.stock) || 0,
        last_sales_volume: Number(row.last_sales_volume) || 0,
        news_pressure_bps: Number(row.news_pressure_bps) || 0,
        change_bps: Math.round(safeDiv(Number(row.price_cents) - Number((GOODS[row.good_key] || {}).base_price || row.price_cents), Number((GOODS[row.good_key] || {}).base_price || row.price_cents), 0) * 10000),
    }));
}
function priceIndex(guildId) {
    const list = goodsList(guildId);
    if (!list.length) return 10000;
    let total = 0;
    let count = 0;
    for (const row of list) {
        const base = Number(row.base_price) || 1;
        total += (Number(row.price_cents) || base) / base;
        count += 1;
    }
    return Math.round(total / Math.max(1, count) * 10000);
}
function updatePrices(guildId) {
    const list = db.all('SELECT * FROM goods_market WHERE guild_id = ?', [guildId]);
    const changes = [];
    for (const row of list) {
        const stock = db.get('SELECT COALESCE(SUM(quantity), 0) AS q FROM inventory WHERE guild_id = ? AND good_key = ?', [guildId, row.good_key]);
        const supply = Math.max(0, Number(stock && stock.q) || 0);
        const demand = Math.max(0, Number(row.sales_volume) || 0);
        const elasticity = Number((GOODS[row.good_key] || {}).elasticity) || 1;
        let change = (Number(row.news_pressure_bps) || 0) / 10000;
        if (supply || demand) {
            const imbalance = (demand - supply) / Math.max(1, supply + demand);
            change += Math.max(-0.04, Math.min(0.04, imbalance * elasticity * 0.05));
        }
        change = Math.max(-0.18, Math.min(0.18, change));
        const price = Math.max(1, Math.round(Number(row.price_cents) * (1 + change)));
        db.run('UPDATE goods_market SET price_cents = ?, supply = ?, demand = ?, last_sales_volume = sales_volume, sales_volume = 0, updated_at = ? WHERE guild_id = ? AND good_key = ?',
            [price, supply, demand, nowIso(), guildId, row.good_key]);
        changes.push({ goodKey: row.good_key, price, change });
    }
    return changes;
}
function flowsSince(guildId, since) {
    const at = since || '1970-01-01T00:00:00.000Z';
    const consumption = db.get(`SELECT COALESCE(SUM(CASE WHEN e.delta < 0 THEN -e.delta ELSE 0 END), 0) AS total
        FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
        WHERE e.guild_id = ? AND t.kind = 'goods_sale' AND t.created_at > ? AND e.account_id IN (
            SELECT id FROM accounts WHERE guild_id = ? AND owner_type = 'user' AND kind = 'wallet'
        )`, [guildId, at, guildId]) || { total: 0 };
    const government = db.get(`SELECT COALESCE(SUM(CASE WHEN e.delta < 0 THEN -e.delta ELSE 0 END), 0) AS total
        FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
        WHERE e.guild_id = ? AND t.kind IN ('government_spending','government_procurement') AND t.created_at > ? AND e.account_id IN (
            SELECT id FROM accounts WHERE guild_id = ? AND owner_type = 'government' AND kind = 'treasury'
        )`, [guildId, at, guildId]) || { total: 0 };
    const wages = db.get(`SELECT COALESCE(SUM(CASE WHEN e.delta < 0 THEN -e.delta ELSE 0 END), 0) AS total
        FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
        WHERE e.guild_id = ? AND t.kind = 'wage_payment' AND t.created_at > ? AND e.account_id IN (
            SELECT id FROM accounts WHERE guild_id = ? AND owner_type = 'company' AND kind = 'cash'
        )`, [guildId, at, guildId]) || { total: 0 };
    return {
        consumption: Number(consumption.total) || 0,
        government: Number(government.total) || 0,
        wages: Number(wages.total) || 0,
    };
}
function inventoryValue(guildId) {
    const row = db.get(`SELECT COALESCE(SUM(i.quantity * gm.price_cents), 0) AS total
        FROM inventory i JOIN goods_market gm ON gm.guild_id = i.guild_id AND gm.good_key = i.good_key
        WHERE i.guild_id = ?`, [guildId]);
    return Number(row && row.total) || 0;
}
function stockMarketCap(guildId) {
    const row = db.get(`SELECT COALESCE(SUM(last_price_cents * shares_outstanding), 0) AS total
        FROM companies WHERE guild_id = ? AND public = 1 AND status = 'active'`, [guildId]);
    return Number(row && row.total) || 0;
}
function workforce(guildId) {
    const total = db.get('SELECT COUNT(*) AS n FROM profiles WHERE guild_id = ? AND starter_granted = 1', [guildId]);
    const employed = db.get('SELECT COUNT(*) AS n FROM employment WHERE guild_id = ?', [guildId]);
    return { workforce: Number(total && total.n) || 0, employed: Number(employed && employed.n) || 0 };
}
function snapshot(guildId) {
    const guild = db.getGuild(guildId);
    const since = guild.last_cycle_at;
    const prev = db.get('SELECT * FROM snapshots WHERE guild_id = ? ORDER BY id DESC LIMIT 1', [guildId]);
    const flows = flowsSince(guildId, since);
    const inventory = inventoryValue(guildId);
    const inventoryDelta = prev ? inventory - Number(prev.inventory_cents) : inventory;
    const investment = inventoryDelta;
    const gdp = Math.max(0, flows.consumption + flows.government + investment);
    const work = workforce(guildId);
    const unemploymentBps = work.workforce > 0 ? Math.round((work.workforce - work.employed) / work.workforce * 10000) : 0;
    const bankSummary = bank.summary(guildId);
    const stockCap = stockMarketCap(guildId);
    const idx = priceIndex(guildId);
    const tick = Number(guild.last_cycle_tick) + 1;
    const at = nowIso();
    const companyCount = db.get('SELECT COUNT(*) AS n FROM companies WHERE guild_id = ? AND status = ?', [guildId, 'active']).n;
    const result = db.run(`INSERT INTO snapshots
        (guild_id, tick, at, gdp_cents, consumption_cents, investment_cents, government_cents, wages_cents, inventory_cents,
         money_supply_cents, treasury_cents, price_index, employed, workforce, unemployment_bps, policy_rate_bps,
         stock_market_cap_cents, company_count, bank_vault_cents, deposits_cents, loans_cents, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [guildId, tick, at, gdp, flows.consumption, investment, flows.government, flows.wages, inventory,
            accounts.moneySupply(guildId), accounts.treasuryBalance(guildId), idx, work.employed, work.workforce, unemploymentBps,
            Number(guild.policy_rate_bps) || 0, stockCap, Number(companyCount) || 0, bankSummary.vault, bankSummary.deposits, bankSummary.loans, at]);
    return db.get('SELECT * FROM snapshots WHERE id = ?', [Number(result.lastInsertRowid)]);
}
function latest(guildId) {
    return db.get('SELECT * FROM snapshots WHERE guild_id = ? ORDER BY id DESC LIMIT 1', [guildId]);
}
function previous(guildId) {
    return db.get('SELECT * FROM snapshots WHERE guild_id = ? ORDER BY id DESC LIMIT 1 OFFSET 1', [guildId]);
}
function history(guildId, limit) {
    return db.all('SELECT * FROM snapshots WHERE guild_id = ? ORDER BY id DESC LIMIT ?', [guildId, Math.max(2, Math.min(120, Number(limit) || 30))]).reverse();
}
function inflationBps(guildId) {
    const last = latest(guildId);
    const prev = previous(guildId);
    if (!last || !prev) return 0;
    return Math.round((Number(last.price_index) - Number(prev.price_index)) / Math.max(1, Number(prev.price_index)) * 10000);
}
function gdpChangeBps(guildId) {
    const last = latest(guildId);
    const prev = previous(guildId);
    if (!last || !prev) return 0;
    return Math.round((Number(last.gdp_cents) - Number(prev.gdp_cents)) / Math.max(1, Number(prev.gdp_cents)) * 10000);
}
function live(guildId) {
    const work = workforce(guildId);
    return {
        snapshot: latest(guildId),
        previous: previous(guildId),
        inflationBps: inflationBps(guildId),
        gdpChangeBps: gdpChangeBps(guildId),
        moneySupply: accounts.moneySupply(guildId),
        treasury: accounts.treasuryBalance(guildId),
        inventory: inventoryValue(guildId),
        stockMarketCap: stockMarketCap(guildId),
        priceIndex: priceIndex(guildId),
        workforce: work.workforce,
        employed: work.employed,
        unemploymentBps: work.workforce ? Math.round((work.workforce - work.employed) / work.workforce * 10000) : 0,
        companyCount: db.get('SELECT COUNT(*) AS n FROM companies WHERE guild_id = ? AND status = ?', [guildId, 'active']).n,
        goods: goodsList(guildId),
        bank: bank.health(guildId),
    };
}
function runCycle(guildId) {
    const changes = updatePrices(guildId);
    const snap = snapshot(guildId);
    return { changes, snapshot: snap };
}

module.exports = {
    goodsList,
    priceIndex,
    updatePrices,
    flowsSince,
    inventoryValue,
    stockMarketCap,
    workforce,
    snapshot,
    latest,
    previous,
    history,
    inflationBps,
    gdpChangeBps,
    live,
    runCycle,
};
