'use strict';

const cryptoRandom = require('node:crypto');
const db = require('../db');
const accounts = require('./accounts');
const { nowIso } = require('../money');

const DEFAULT_ASSETS = [
    {
        symbol: 'RMX',
        name: 'Reichsmark Index',
        kind: 'coin',
        description: 'A broad settlement token used by the Reichsbank clearing desks.',
        price: 100,
        volatility: 350,
        fee: 80,
    },
    {
        symbol: 'KSR',
        name: 'KaiserMark',
        kind: 'memecoin',
        description: 'A sovereign meme token with no promise of prudence.',
        price: 5,
        volatility: 1800,
        fee: 150,
    },
    {
        symbol: 'DGM',
        name: 'DogeMark',
        kind: 'memecoin',
        description: 'Much Reich. Very coin. Issued by the department of questionable finance.',
        price: 2,
        volatility: 2600,
        fee: 200,
    },
    {
        symbol: 'MNM',
        name: 'MondMark',
        kind: 'memecoin',
        description: 'A lunar speculation vehicle backed by enthusiasm and very little else.',
        price: 1,
        volatility: 3200,
        fee: 250,
    },
];
const MIN_TRADE = 100;
const MAX_TRADE = 5000000;
const CREATION_LIQUIDITY = 10000;

function randomBetween(min, max) {
    const low = Math.trunc(Number(min) || 0);
    const high = Math.trunc(Number(max) || 0);
    if (high <= low) return low;
    return cryptoRandom.randomInt(low, high + 1);
}
function escrowId(assetId) {
    return `crypto:${assetId}`;
}
function escrowEntry(guildId, assetId, delta) {
    return { accountId: accounts.acct(guildId, 'system', escrowId(assetId), 'escrow').id, delta };
}
function ensure(guildId) {
    db.transaction(() => {
        const at = nowIso();
        for (const asset of DEFAULT_ASSETS) {
            const existing = db.get('SELECT * FROM crypto_assets WHERE guild_id = ? AND symbol = ?', [guildId, asset.symbol]);
            if (existing) continue;
            const result = db.run(`INSERT INTO crypto_assets
                (guild_id, symbol, name, kind, description, creator_user_id, price_cents, reserve_cents, supply,
                 volatility_bps, fee_bps, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, ?, ?)`,
                [guildId, asset.symbol, asset.name, asset.kind, asset.description, 'system', asset.price, asset.volatility, asset.fee, at, at]);
            recordPrice(guildId, Number(result.lastInsertRowid), asset.price, 0, 0);
        }
    });
}
function find(guildId, query) {
    const term = String(query || '').trim();
    if (!term) return null;
    const numeric = Number(term);
    if (Number.isInteger(numeric) && numeric > 0) {
        return db.get('SELECT * FROM crypto_assets WHERE guild_id = ? AND id = ? AND active = 1', [guildId, numeric]);
    }
    return db.get('SELECT * FROM crypto_assets WHERE guild_id = ? AND upper(symbol) = upper(?) AND active = 1', [guildId, term])
        || db.get('SELECT * FROM crypto_assets WHERE guild_id = ? AND lower(name) = lower(?) AND active = 1', [guildId, term]);
}
function recordPrice(guildId, assetId, price, reserve, supply) {
    const guild = db.getGuild(guildId);
    const tick = Number(guild && guild.last_cycle_tick) || 0;
    db.run('INSERT INTO crypto_prices (guild_id, asset_id, tick, price_cents, reserve_cents, supply, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [guildId, assetId, tick, Math.max(1, Math.trunc(price)), Math.max(0, Math.trunc(reserve)), Math.max(0, Math.trunc(supply)), nowIso()]);
}
function history(guildId, assetId, limit) {
    return db.all('SELECT * FROM crypto_prices WHERE guild_id = ? AND asset_id = ? ORDER BY id DESC LIMIT ?',
        [guildId, Number(assetId), Math.max(2, Math.min(120, Number(limit) || 30))]).reverse();
}
function list(guildId) {
    ensure(guildId);
    const assets = db.all('SELECT * FROM crypto_assets WHERE guild_id = ? AND active = 1 ORDER BY reserve_cents DESC, id', [guildId]);
    return assets.map(asset => {
        const rows = db.all('SELECT * FROM crypto_prices WHERE guild_id = ? AND asset_id = ? ORDER BY id DESC LIMIT 2', [guildId, asset.id]);
        const previous = rows[1] ? Number(rows[1].price_cents) : Number(asset.price_cents);
        const change = previous > 0 ? ((Number(asset.price_cents) - previous) / previous) * 100 : 0;
        return {
            ...asset,
            change,
            history: history(guildId, asset.id, 24),
            marketCap: Number(asset.price_cents) * Math.max(0, Number(asset.supply)),
        };
    });
}
function create(guildId, userId, displayName, name, symbol, liquidityRef) {
    ensure(guildId);
    const cleanName = String(name || '').trim().slice(0, 60);
    const cleanSymbol = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (cleanName.length < 2) throw new Error('coin name is too short');
    if (cleanSymbol.length < 2 || cleanSymbol.length > 8) throw new Error('symbol must be 2 to 8 letters or digits');
    const liquidity = Math.max(CREATION_LIQUIDITY, Math.trunc(Number(liquidityRef) || CREATION_LIQUIDITY));
    if (liquidity > MAX_TRADE) throw new Error('initial liquidity is too large');
    const existing = db.get('SELECT * FROM crypto_assets WHERE guild_id = ? AND symbol = ?', [guildId, cleanSymbol]);
    if (existing) throw new Error('that symbol is already listed');
    accounts.ensureUser(guildId, userId, displayName);
    if (db.walletBalance(guildId, userId) < liquidity) throw new Error('insufficient wallet balance for initial liquidity');
    const at = nowIso();
    return db.transaction(() => {
        const result = db.run(`INSERT INTO crypto_assets
            (guild_id, symbol, name, kind, description, creator_user_id, price_cents, reserve_cents, supply,
             volatility_bps, fee_bps, active, created_at, updated_at)
            VALUES (?, ?, ?, 'memecoin', ?, ?, 1, ?, 0, 4200, 300, 1, ?, ?)`,
            [guildId, cleanSymbol, cleanName, 'A community-issued memecoin on the local clearing layer.', userId, liquidity, at, at]);
        const assetId = Number(result.lastInsertRowid);
        db.post(guildId, 'crypto_liquidity', userId, `Initial liquidity: ${cleanSymbol}`, [
            accounts.walletEntry(guildId, userId, -liquidity),
            escrowEntry(guildId, assetId, liquidity),
        ]);
        recordPrice(guildId, assetId, 1, liquidity, 0);
        db.audit(guildId, userId, 'crypto_create', { assetId, symbol: cleanSymbol, name: cleanName, liquidity });
        return db.get('SELECT * FROM crypto_assets WHERE id = ?', [assetId]);
    });
}
function buy(guildId, userId, displayName, query, amountRef) {
    ensure(guildId);
    const asset = find(guildId, query);
    if (!asset) throw new Error('coin not found');
    const amount = Math.trunc(Number(amountRef) || 0);
    if (amount < MIN_TRADE) throw new Error('minimum purchase is too small');
    if (amount > MAX_TRADE) throw new Error('purchase exceeds the market limit');
    accounts.ensureUser(guildId, userId, displayName);
    if (db.walletBalance(guildId, userId) < amount) throw new Error('insufficient wallet balance');
    const fee = Math.max(1, Math.floor(amount * Number(asset.fee_bps) / 10000));
    const net = amount - fee;
    const price = Math.max(1, Number(asset.price_cents) || 1);
    const tokens = Math.floor(net / price);
    if (tokens < 1) throw new Error('amount is below the current coin price');
    const impact = Math.min(1500, Math.floor(net / Math.max(1, Number(asset.reserve_cents) || 1) * 1600));
    const nextPrice = Math.max(1, Math.floor(price * (10000 + impact) / 10000));
    const at = nowIso();
    return db.transaction(() => {
        db.post(guildId, 'crypto_buy', userId, `Buy ${asset.symbol}`, [
            accounts.walletEntry(guildId, userId, -amount),
            escrowEntry(guildId, asset.id, net),
            accounts.governmentEntry(guildId, fee),
        ]);
        db.run(`INSERT INTO crypto_holdings (guild_id, asset_id, user_id, amount, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, asset_id, user_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at`,
            [guildId, asset.id, String(userId), tokens, at]);
        db.run('UPDATE crypto_assets SET reserve_cents = reserve_cents + ?, supply = supply + ?, price_cents = ?, updated_at = ? WHERE id = ?',
            [net, tokens, nextPrice, at, asset.id]);
        db.run('INSERT INTO crypto_trades (guild_id, asset_id, user_id, side, amount_cents, tokens, price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [guildId, asset.id, String(userId), 'buy', amount, tokens, price, at]);
        recordPrice(guildId, asset.id, nextPrice, Number(asset.reserve_cents) + net, Number(asset.supply) + tokens);
        db.audit(guildId, userId, 'crypto_buy', { assetId: asset.id, symbol: asset.symbol, amount, tokens, price, nextPrice });
        return { asset, amount, fee, tokens, price, nextPrice, holdings: db.get('SELECT * FROM crypto_holdings WHERE guild_id = ? AND asset_id = ? AND user_id = ?', [guildId, asset.id, String(userId)]) };
    });
}
function sell(guildId, userId, query, tokensRef) {
    ensure(guildId);
    const asset = find(guildId, query);
    if (!asset) throw new Error('coin not found');
    const tokens = Math.trunc(Number(tokensRef) || 0);
    if (tokens < 1) throw new Error('specify the number of coins to sell');
    const holding = db.get('SELECT * FROM crypto_holdings WHERE guild_id = ? AND asset_id = ? AND user_id = ?', [guildId, asset.id, String(userId)]);
    if (!holding || Number(holding.amount) < tokens) throw new Error('you do not hold that many coins');
    const price = Math.max(1, Number(asset.price_cents) || 1);
    const reserve = Math.max(0, Number(asset.reserve_cents) || 0);
    const gross = Math.min(reserve, tokens * price);
    if (gross <= 0) throw new Error('the liquidity pool is empty');
    const fee = Math.max(1, Math.floor(gross * Number(asset.fee_bps) / 10000));
    const net = gross - fee;
    const impact = Math.min(1500, Math.floor(gross / Math.max(1, reserve) * 1600));
    const nextPrice = Math.max(1, Math.floor(price * (10000 - impact) / 10000));
    const at = nowIso();
    return db.transaction(() => {
        db.post(guildId, 'crypto_sell', userId, `Sell ${asset.symbol}`, [
            escrowEntry(guildId, asset.id, -gross),
            accounts.walletEntry(guildId, userId, net),
            accounts.governmentEntry(guildId, fee),
        ]);
        db.run('UPDATE crypto_holdings SET amount = amount - ?, updated_at = ? WHERE guild_id = ? AND asset_id = ? AND user_id = ?',
            [tokens, at, guildId, asset.id, String(userId)]);
        db.run('UPDATE crypto_assets SET reserve_cents = reserve_cents - ?, supply = supply - ?, price_cents = ?, updated_at = ? WHERE id = ?',
            [gross, tokens, nextPrice, at, asset.id]);
        db.run('INSERT INTO crypto_trades (guild_id, asset_id, user_id, side, amount_cents, tokens, price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [guildId, asset.id, String(userId), 'sell', gross, tokens, price, at]);
        recordPrice(guildId, asset.id, nextPrice, Math.max(0, reserve - gross), Math.max(0, Number(asset.supply) - tokens));
        db.audit(guildId, userId, 'crypto_sell', { assetId: asset.id, symbol: asset.symbol, tokens, gross, fee, net, price, nextPrice });
        return { asset, tokens, gross, fee, net, price, nextPrice, holdings: db.get('SELECT * FROM crypto_holdings WHERE guild_id = ? AND asset_id = ? AND user_id = ?', [guildId, asset.id, String(userId)]) };
    });
}
function portfolio(guildId, userId) {
    ensure(guildId);
    return db.all(`SELECT h.amount, a.* FROM crypto_holdings h JOIN crypto_assets a ON a.id = h.asset_id AND a.guild_id = h.guild_id
        WHERE h.guild_id = ? AND h.user_id = ? AND h.amount > 0 ORDER BY h.amount * a.price_cents DESC`, [guildId, String(userId)])
        .map(row => ({ ...row, value_cents: Number(row.amount) * Number(row.price_cents) }));
}
function runCycle(guildId, tick) {
    ensure(guildId);
    const assets = db.all('SELECT * FROM crypto_assets WHERE guild_id = ? AND active = 1', [guildId]);
    const updated = [];
    for (const asset of assets) {
        const drift = randomBetween(-Number(asset.volatility_bps || 500), Number(asset.volatility_bps || 500));
        const price = Math.max(1, Math.floor(Number(asset.price_cents) * (10000 + drift) / 10000));
        db.run('UPDATE crypto_assets SET price_cents = ?, updated_at = ? WHERE id = ?', [price, nowIso(), asset.id]);
        db.run('INSERT INTO crypto_prices (guild_id, asset_id, tick, price_cents, reserve_cents, supply, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [guildId, asset.id, Number(tick) || 0, price, Number(asset.reserve_cents) || 0, Number(asset.supply) || 0, nowIso()]);
        updated.push({ assetId: asset.id, symbol: asset.symbol, price, drift });
    }
    return updated;
}

module.exports = {
    DEFAULT_ASSETS,
    ensure,
    find,
    list,
    history,
    create,
    buy,
    sell,
    portfolio,
    runCycle,
    recordPrice,
};
