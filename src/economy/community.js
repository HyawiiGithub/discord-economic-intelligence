'use strict';

const crypto = require('node:crypto');
const db = require('../db');
const accounts = require('./accounts');
const bank = require('./bank');
const companies = require('./companies');
const government = require('./government');
const market = require('./market');
const securities = require('./securities');
const style = require('../style');
const { nowIso, formatDateTime } = require('../money');

const DEFAULT_GAMEPLAY = {
    daily: 25000,
    civilWorkMin: 2500,
    civilWorkMax: 7500,
    robCooldownMinutes: 10,
    robCap: 60000,
    robFineMin: 7500,
    robFineMax: 25000,
    casinoMax: 100000,
    lotteryTicket: 5000,
    lotterySeed: 50000,
    lotteryCutBps: 2000,
    lotteryDays: 7,
};
function requireStyle(guildId) {
    const profile = style.forGuild(guildId);
    if (!profile) throw new Error('this command is not enabled on this server');
    return profile;
}
function profileFor(guildId) {
    return style.forGuild(guildId) || DEFAULT_GAMEPLAY;
}
function randomBetween(min, max) {
    const low = Math.trunc(Number(min) || 0);
    const high = Math.trunc(Number(max) || 0);
    if (high <= low) return low;
    return crypto.randomInt(low, high + 1);
}
function pick(list) {
    return list[randomBetween(0, list.length - 1)];
}
function dayKey() {
    return new Date().toISOString().slice(0, 10);
}
function plusDays(days) {
    return new Date(Date.now() + Math.max(1, Number(days) || 1) * 86400000).toISOString();
}
function ensure(guildId) {
    const profile = style.forGuild(guildId);
    if (!profile) return false;
    db.transaction(() => {
        const at = nowIso();
        for (const item of profile.shop) {
            db.run(`INSERT OR IGNORE INTO shop_items
                (guild_id, name, description, category, item_type, price_cents, stock, value_cents, income_cents, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [guildId, item.name, item.description || '', item.category || 'goods', item.itemType || 'collectible',
                    Number(item.price) || 0, Number(item.stock) || 0, Number(item.value) || 0, Number(item.income) || 0, at, at]);
        }
        const lottery = db.get('SELECT * FROM lottery WHERE guild_id = ?', [guildId]);
        if (!lottery) {
            db.run('INSERT INTO lottery (guild_id, jackpot_cents, ticket_price_cents, draw_at, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [guildId, Number(profile.lotterySeed) || 0, Number(profile.lotteryTicket) || 0, plusDays(profile.lotteryDays), 'open', at]);
        }
        for (const stock of profile.stocks) {
            let company = db.get('SELECT * FROM companies WHERE guild_id = ? AND ticker = ?', [guildId, stock.ticker]);
            if (!company) {
                const price = Math.max(1, Number(stock.price) || 100);
                const shares = Math.max(1, Number(stock.shares) || 10000);
                const listedAt = nowIso();
                db.run(`INSERT INTO companies
                    (guild_id, name, ticker, sector, owner_user_id, description, shares_outstanding, share_price_cents,
                     last_price_cents, public, publicly_listed_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                    [guildId, stock.name, stock.ticker, stock.sector, 'system', stock.description || '', shares, price, price, listedAt, listedAt, listedAt]);
                company = db.get('SELECT * FROM companies WHERE guild_id = ? AND ticker = ?', [guildId, stock.ticker]);
                if (stock.inventory) {
                    companies.addInventory(guildId, company.id, stock.sector, Number(stock.inventory) || 0);
                }
                db.run('INSERT INTO stock_prices (guild_id, company_id, tick, price_cents, market_cap_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [guildId, company.id, 0, price, price * shares, nowIso()]);
            }
        }
    });
    return true;
}
function daily(guildId, userId, displayName) {
    const profile = profileFor(guildId);
    accounts.ensureUser(guildId, userId, displayName);
    const record = db.get('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]);
    const last = record && record.last_daily_at ? Date.parse(record.last_daily_at) : 0;
    const next = last + 86400000;
    if (Date.now() < next) {
        throw new Error(`Daily allowance already claimed. Next allowance available ${formatDateTime(new Date(next).toISOString())}.`);
    }
    const amount = Math.max(1, Number(profile.daily) || 0);
    db.transaction(() => {
        accounts.mint(guildId, userId, amount, 'Daily allowance', userId);
        db.run('UPDATE profiles SET last_daily_at = ?, total_income = total_income + ?, updated_at = ? WHERE guild_id = ? AND user_id = ?',
            [nowIso(), amount, nowIso(), guildId, String(userId)]);
        db.audit(guildId, userId, 'daily_allowance', { amount });
    });
    return { amount, balance: db.walletBalance(guildId, userId), nextAt: new Date(Date.now() + 86400000).toISOString() };
}
const CIVIL_JOBS = [
    'Städtischer Reinigungsdienst',
    'Reichsbahn-Schaffner',
    'Postzusteller',
    'Hafenarbeiter',
    'Straßenbaukolonne',
    'Munitionsfabrik',
    'Landwirtschaftlicher Saisonarbeiter',
    'Kraftwerksschicht',
];
function civilWork(guildId, userId, displayName) {
    const profile = profileFor(guildId);
    accounts.ensureUser(guildId, userId, displayName);
    const guild = db.getGuild(guildId);
    const record = db.get('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]);
    const cooldown = Math.max(1, Number(guild.work_cooldown_min) || 1) * 60000;
    const last = record && record.last_work_at ? Date.parse(record.last_work_at) : 0;
    const next = last + cooldown;
    if (Date.now() < next) throw new Error(`You are still on shift. Next shift available ${formatDateTime(new Date(next).toISOString())}.`);
    const amount = Math.round(randomBetween(profile.civilWorkMin, profile.civilWorkMax) / 100) * 100;
    const job = pick(CIVIL_JOBS);
    const at = nowIso();
    db.transaction(() => {
        accounts.mint(guildId, userId, amount, `Civil service: ${job}`, userId);
        db.run('UPDATE profiles SET last_work_at = ?, total_income = total_income + ?, updated_at = ? WHERE guild_id = ? AND user_id = ?',
            [at, amount, at, guildId, String(userId)]);
        db.audit(guildId, userId, 'civil_work', { amount, job });
    });
    return { amount, job, balance: db.walletBalance(guildId, userId), nextAt: new Date(Date.now() + cooldown).toISOString() };
}
function rob(guildId, userId, targetId, displayName, targetName) {
    const profile = profileFor(guildId);
    if (String(userId) === String(targetId)) throw new Error('you cannot rob yourself');
    accounts.ensureUser(guildId, userId, displayName);
    accounts.ensureUser(guildId, targetId, targetName);
    const record = db.get('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]);
    const cooldown = Math.max(1, Number(profile.robCooldownMinutes) || 10) * 60000;
    const last = record && record.last_rob_at ? Date.parse(record.last_rob_at) : 0;
    const next = last + cooldown;
    if (Date.now() < next) throw new Error(`The streets are watching. Next attempt ${formatDateTime(new Date(next).toISOString())}.`);
    const targetWallet = db.walletBalance(guildId, targetId);
    if (targetWallet < 5000) throw new Error('that household has too little cash worth taking');
    const at = nowIso();
    const success = randomBetween(1, 10000) <= 4800;
    let amount = 0;
    let fine = 0;
    if (success) {
        const share = randomBetween(800, 2000);
        amount = Math.min(Number(profile.robCap) || 60000, Math.max(100, Math.floor(targetWallet * share / 10000)));
        db.transaction(() => {
            accounts.pay(guildId, targetId, userId, amount, 'Robbery proceeds', userId);
            db.run('UPDATE profiles SET last_rob_at = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?', [at, at, guildId, String(userId)]);
            db.audit(guildId, userId, 'robbery_success', { targetId, amount });
        });
    } else {
        const wallet = db.walletBalance(guildId, userId);
        fine = Math.min(wallet, randomBetween(profile.robFineMin, profile.robFineMax));
        db.transaction(() => {
            if (fine > 0) accounts.collectTax(guildId, userId, fine, 'robbery_fine', userId);
            if (targetWallet > 0) {
                const consolation = Math.min(2500, Math.floor(targetWallet * 0.01));
                if (consolation > 0 && wallet >= consolation) accounts.pay(guildId, userId, targetId, consolation, 'Compensation for attempted robbery', userId);
            }
            db.run('UPDATE profiles SET last_rob_at = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?', [at, at, guildId, String(userId)]);
            db.audit(guildId, userId, 'robbery_failed', { targetId, fine });
        });
    }
    return { success, amount, fine, balance: db.walletBalance(guildId, userId), nextAt: new Date(Date.now() + cooldown).toISOString() };
}
function blackjack() {
    const draw = () => randomBetween(1, 11);
    const score = hand => hand.reduce((sum, card) => sum + card, 0);
    const player = [draw(), draw()];
    const dealer = [draw(), draw()];
    while (score(dealer) < 17) dealer.push(draw());
    const playerScore = score(player);
    const dealerScore = score(dealer);
    let multiplier = 0;
    if (playerScore > 21) multiplier = 0;
    else if (dealerScore > 21 || playerScore > dealerScore) multiplier = 2;
    else if (playerScore === dealerScore) multiplier = 1;
    return { player, dealer, playerScore, dealerScore, multiplier };
}
function casino(guildId, userId, displayName, game, choice, bet) {
    const profile = profileFor(guildId);
    const wager = Math.trunc(Number(bet) || 0);
    if (wager < 100) throw new Error('minimum wager is RM 1.00');
    if (wager > Number(profile.casinoMax)) throw new Error('that wager exceeds the table limit');
    accounts.ensureUser(guildId, userId, displayName);
    if (db.walletBalance(guildId, userId) < wager) throw new Error('insufficient wallet balance');
    const key = String(game || '').toLowerCase();
    const value = String(choice || '').toLowerCase();
    let payout = 0;
    let label = '';
    let detail = '';
    if (key === 'coinflip') {
        const result = randomBetween(1, 2) === 1 ? 'heads' : 'tails';
        if (!['heads', 'tails'].includes(value)) throw new Error('choose heads or tails');
        payout = result === value ? wager * 2 : 0;
        label = result;
        detail = `Coin landed on **${result}**.`;
    } else if (key === 'dice') {
        const result = randomBetween(1, 6);
        const guess = Number(value);
        if (!Number.isInteger(guess) || guess < 1 || guess > 6) throw new Error('choose a number from 1 to 6');
        payout = result === guess ? wager * 5 : 0;
        label = String(result);
        detail = `The die landed on **${result}**.`;
    } else if (key === 'roulette') {
        const result = randomBetween(0, 36);
        const color = result === 0 ? 'green' : result % 2 === 0 ? 'black' : 'red';
        const numeric = Number(value);
        if (['red', 'black', 'green'].includes(value)) {
            const multiplier = value === 'green' ? 14 : 2;
            payout = result === 0 ? (value === 'green' ? wager * multiplier : 0) : (value === color ? wager * multiplier : 0);
        } else if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 36) {
            payout = result === numeric ? wager * 36 : 0;
        } else {
            throw new Error('choose red, black, green or a number from 0 to 36');
        }
        label = `${result} ${color}`;
        detail = `The wheel stopped on **${result} ${color}**.`;
    } else if (key === 'slots') {
        const symbols = ['Reichsmark', 'Adler', 'Krone', 'Zahnrad', 'Kelch'];
        const reels = [pick(symbols), pick(symbols), pick(symbols)];
        const three = reels[0] === reels[1] && reels[1] === reels[2];
        const pair = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
        payout = three ? wager * 8 : pair ? wager * 2 : 0;
        label = reels.join(' · ');
        detail = `The reels show **${reels.join(' · ')}**.`;
    } else if (key === 'blackjack') {
        const result = blackjack();
        payout = wager * result.multiplier;
        label = result.playerScore > 21 ? 'bust' : result.dealerScore > 21 ? 'dealer bust' : `${result.playerScore} to ${result.dealerScore}`;
        detail = `Your hand **${result.player.join(', ')}** (${result.playerScore}) against dealer **${result.dealer.join(', ')}** (${result.dealerScore}).`;
    } else {
        throw new Error('choose coinflip, dice, roulette, slots or blackjack');
    }
    db.transaction(() => {
        accounts.burn(guildId, userId, wager, 'Casino wager', userId);
        if (payout > 0) accounts.mint(guildId, userId, payout, 'Casino payout', userId);
        db.audit(guildId, userId, 'casino_result', { game: key, choice: value, wager, payout, label });
    });
    return { game: key, wager, payout, profit: payout - wager, label, detail, balance: db.walletBalance(guildId, userId) };
}
function lotteryStatus(guildId) {
    const profile = requireStyle(guildId);
    ensure(guildId);
    const row = db.get('SELECT * FROM lottery WHERE guild_id = ?', [guildId]);
    const tickets = db.get('SELECT COALESCE(SUM(tickets), 0) AS total, COUNT(*) AS holders FROM lottery_tickets WHERE guild_id = ?', [guildId]);
    return {
        jackpot: Number(row.jackpot_cents) || 0,
        ticketPrice: Number(row.ticket_price_cents) || Number(profile.lotteryTicket) || 0,
        drawAt: row.draw_at,
        tickets: Number(tickets.total) || 0,
        holders: Number(tickets.holders) || 0,
    };
}
function buyLottery(guildId, userId, displayName, count) {
    const profile = requireStyle(guildId);
    ensure(guildId);
    const tickets = Math.max(1, Math.min(100, Math.trunc(Number(count) || 1)));
    const row = db.get('SELECT * FROM lottery WHERE guild_id = ?', [guildId]);
    const cost = tickets * Number(row.ticket_price_cents);
    if (db.walletBalance(guildId, userId) < cost) throw new Error('insufficient wallet balance');
    accounts.ensureUser(guildId, userId, displayName);
    const at = nowIso();
    const net = Math.floor(cost * (10000 - Number(profile.lotteryCutBps)) / 10000);
    db.transaction(() => {
        db.post(guildId, 'lottery_ticket', userId, 'Lottery tickets', [
            accounts.walletEntry(guildId, userId, -cost),
            accounts.systemEntry(guildId, 'lottery_escrow', cost),
        ]);
        db.run('INSERT INTO lottery_tickets (guild_id, user_id, tickets, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET tickets = tickets + excluded.tickets, updated_at = excluded.updated_at',
            [guildId, String(userId), tickets, at]);
        db.run('UPDATE lottery SET jackpot_cents = jackpot_cents + ?, updated_at = ? WHERE guild_id = ?', [net, at, guildId]);
        db.audit(guildId, userId, 'lottery_purchase', { tickets, cost, net });
    });
    return { tickets, cost, jackpot: Number(db.get('SELECT jackpot_cents FROM lottery WHERE guild_id = ?', [guildId]).jackpot_cents) };
}
function drawLottery(guildId, actorId) {
    const profile = requireStyle(guildId);
    ensure(guildId);
    return db.transaction(() => {
        const row = db.get('SELECT * FROM lottery WHERE guild_id = ?', [guildId]);
        const entries = db.all('SELECT * FROM lottery_tickets WHERE guild_id = ? AND tickets > 0', [guildId]);
        const totalTickets = entries.reduce((sum, entry) => sum + Number(entry.tickets), 0);
        const escrow = accounts.systemEntry(guildId, 'lottery_escrow', 0);
        const held = db.balanceOf(guildId, 'system', 'market', 'lottery_escrow');
        const jackpot = Math.min(Number(row.jackpot_cents) || 0, Math.max(0, held));
        if (!totalTickets) {
            const at = nowIso();
            db.run('UPDATE lottery SET draw_at = ?, updated_at = ? WHERE guild_id = ?', [plusDays(profile.lotteryDays), at, guildId]);
            return { winnerId: null, jackpot: 0, tickets: 0, rescheduled: true, drawAt: db.get('SELECT draw_at FROM lottery WHERE guild_id = ?', [guildId]).draw_at };
        }
        let ticket = randomBetween(1, totalTickets);
        let winner = entries[0];
        for (const entry of entries) {
            ticket -= Number(entry.tickets);
            if (ticket <= 0) {
                winner = entry;
                break;
            }
        }
        const at = nowIso();
        const payout = Math.max(0, jackpot);
        const remainder = Math.max(0, held - payout);
        const postings = [
            { accountId: escrow.accountId, delta: -held },
            accounts.walletEntry(guildId, winner.user_id, payout),
        ];
        if (remainder > 0) postings.push(accounts.governmentEntry(guildId, remainder));
        db.post(guildId, 'lottery_draw', actorId || winner.user_id, 'Reichslotterie draw', postings);
        db.run('DELETE FROM lottery_tickets WHERE guild_id = ?', [guildId]);
        db.run('UPDATE lottery SET jackpot_cents = ?, draw_at = ?, status = ?, last_winner_id = ?, updated_at = ? WHERE guild_id = ?',
            [Number(profile.lotterySeed) || 0, plusDays(profile.lotteryDays), 'open', String(winner.user_id), at, guildId]);
        db.audit(guildId, actorId || winner.user_id, 'lottery_draw', { winnerId: winner.user_id, payout, remainder, tickets: totalTickets });
        return { winnerId: winner.user_id, jackpot: payout, tickets: totalTickets, rescheduled: false, drawAt: plusDays(profile.lotteryDays) };
    });
}
function runCycle(guildId) {
    const profile = style.forGuild(guildId);
    if (!profile) return null;
    ensure(guildId);
    const row = db.get('SELECT * FROM lottery WHERE guild_id = ?', [guildId]);
    if (!row || Date.parse(row.draw_at) > Date.now()) return null;
    const tickets = db.get('SELECT COALESCE(SUM(tickets), 0) AS total FROM lottery_tickets WHERE guild_id = ?', [guildId]);
    if (!Number(tickets.total)) {
        db.run('UPDATE lottery SET draw_at = ?, updated_at = ? WHERE guild_id = ?', [plusDays(profile.lotteryDays), nowIso(), guildId]);
        return null;
    }
    return drawLottery(guildId, 'cycle');
}
function shopList(guildId) {
    requireStyle(guildId);
    ensure(guildId);
    return db.all('SELECT * FROM shop_items WHERE guild_id = ? AND active = 1 ORDER BY price_cents, id', [guildId]);
}
function buyItem(guildId, userId, displayName, query) {
    requireStyle(guildId);
    ensure(guildId);
    const term = String(query || '').trim();
    if (!term) throw new Error('specify an item id or name');
    const numeric = Number(term);
    const item = Number.isInteger(numeric) && numeric > 0
        ? db.get('SELECT * FROM shop_items WHERE guild_id = ? AND id = ? AND active = 1', [guildId, numeric])
        : db.get('SELECT * FROM shop_items WHERE guild_id = ? AND lower(name) = lower(?) AND active = 1', [guildId, term]);
    if (!item) throw new Error('item not found');
    if (Number(item.stock) <= 0) throw new Error('that item is out of stock');
    const guild = db.getGuild(guildId);
    const total = Number(item.price_cents) + Math.round(Number(item.price_cents) * Number(guild.vat_bps) / 10000);
    accounts.ensureUser(guildId, userId, displayName);
    if (db.walletBalance(guildId, userId) < total) throw new Error('insufficient wallet balance');
    const at = nowIso();
    db.transaction(() => {
        db.post(guildId, 'shop_purchase', userId, `Purchase: ${item.name}`, [
            accounts.walletEntry(guildId, userId, -total),
            accounts.governmentEntry(guildId, total),
        ]);
        db.run('UPDATE shop_items SET stock = stock - 1, updated_at = ? WHERE id = ?', [at, item.id]);
        db.run('INSERT INTO user_items (guild_id, user_id, item_id, quantity, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at',
            [guildId, String(userId), item.id, at]);
        if (item.item_type === 'property') {
            db.run('INSERT INTO properties (guild_id, user_id, item_id, name, kind, value_cents, income_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [guildId, String(userId), item.id, item.name, 'property', Number(item.value_cents) || Number(item.price_cents), Number(item.income_cents) || 0, at]);
        }
        db.audit(guildId, userId, 'shop_purchase', { itemId: item.id, item: item.name, total });
    });
    return { item, total, tax: total - Number(item.price_cents), balance: db.walletBalance(guildId, userId) };
}
function inventory(guildId, userId) {
    return db.all(`SELECT ui.quantity, si.* FROM user_items ui JOIN shop_items si ON si.id = ui.item_id AND si.guild_id = ui.guild_id
        WHERE ui.guild_id = ? AND ui.user_id = ? AND ui.quantity > 0 ORDER BY si.category, si.name`, [guildId, String(userId)]);
}
function properties(guildId, userId) {
    return db.all('SELECT * FROM properties WHERE guild_id = ? AND user_id = ? ORDER BY value_cents DESC, id', [guildId, String(userId)]);
}
function useItem(guildId, userId, query) {
    const term = String(query || '').trim();
    const numeric = Number(term);
    const item = Number.isInteger(numeric) && numeric > 0
        ? db.get('SELECT * FROM shop_items WHERE guild_id = ? AND id = ?', [guildId, numeric])
        : db.get('SELECT * FROM shop_items WHERE guild_id = ? AND lower(name) = lower(?)', [guildId, term]);
    if (!item) throw new Error('item not found');
    const held = db.get('SELECT * FROM user_items WHERE guild_id = ? AND user_id = ? AND item_id = ?', [guildId, String(userId), item.id]);
    if (!held || Number(held.quantity) <= 0) throw new Error('you do not hold that item');
    if (item.item_type !== 'consumable') throw new Error('that item cannot be used');
    db.run('UPDATE user_items SET quantity = quantity - 1, updated_at = ? WHERE guild_id = ? AND user_id = ? AND item_id = ?',
        [nowIso(), guildId, String(userId), item.id]);
    return { item, remaining: Number(held.quantity) - 1 };
}
function netWorthRows(guildId) {
    const cash = db.all(`SELECT p.user_id, p.display_name,
        COALESCE(SUM(CASE WHEN a.kind = 'wallet' THEN a.balance WHEN a.kind = 'deposit' THEN a.balance WHEN a.kind = 'loan' THEN -a.balance ELSE 0 END), 0) AS cash_cents
        FROM profiles p LEFT JOIN accounts a ON a.guild_id = p.guild_id AND a.owner_type = 'user' AND a.owner_id = p.user_id
        WHERE p.guild_id = ? GROUP BY p.user_id`, [guildId]);
    const shares = db.all(`SELECT h.user_id, COALESCE(SUM(h.shares * c.last_price_cents), 0) AS share_cents
        FROM share_holdings h JOIN companies c ON c.id = h.company_id AND c.guild_id = h.guild_id
        WHERE h.guild_id = ? AND h.shares > 0 GROUP BY h.user_id`, [guildId]);
    const homes = db.all('SELECT user_id, COALESCE(SUM(value_cents), 0) AS property_cents FROM properties WHERE guild_id = ? GROUP BY user_id', [guildId]);
    const shareMap = new Map(shares.map(row => [String(row.user_id), Number(row.share_cents) || 0]));
    const homeMap = new Map(homes.map(row => [String(row.user_id), Number(row.property_cents) || 0]));
    return cash.map(row => {
        const wallet = Number(row.cash_cents) || 0;
        const share = shareMap.get(String(row.user_id)) || 0;
        const property = homeMap.get(String(row.user_id)) || 0;
        return {
            userId: String(row.user_id),
            name: row.display_name || String(row.user_id),
            cash: wallet,
            shares: share,
            properties: property,
            total: wallet + share + property,
        };
    }).sort((a, b) => b.total - a.total);
}
function leaderboard(guildId, limit) {
    return netWorthRows(guildId).slice(0, Math.max(1, Math.min(25, Number(limit) || 10)));
}
function wealth(guildId, userId, displayName) {
    accounts.ensureUser(guildId, userId, displayName);
    const rows = netWorthRows(guildId);
    return rows.find(row => row.userId === String(userId)) || {
        userId: String(userId),
        name: displayName || String(userId),
        cash: db.netWorth(guildId, userId),
        shares: 0,
        properties: 0,
        total: db.netWorth(guildId, userId),
    };
}
function createBet(guildId, actorId, title, optionA, optionB) {
    requireStyle(guildId);
    const name = String(title || '').trim();
    const a = String(optionA || '').trim();
    const b = String(optionB || '').trim();
    if (!name || !a || !b) throw new Error('usage: bet create "title" "option A" "option B"');
    const at = nowIso();
    const result = db.run('INSERT INTO bets (guild_id, title, option_a, option_b, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, name.slice(0, 180), a.slice(0, 80), b.slice(0, 80), 'open', at]);
    db.audit(guildId, actorId, 'bet_create', { betId: Number(result.lastInsertRowid), title: name });
    return db.get('SELECT * FROM bets WHERE id = ?', [Number(result.lastInsertRowid)]);
}
function openBets(guildId) {
    return db.all('SELECT * FROM bets WHERE guild_id = ? AND status = ? ORDER BY id DESC LIMIT 15', [guildId, 'open']);
}
function betStats(guildId, betId) {
    const rows = db.all('SELECT choice, COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS entries FROM bet_entries WHERE guild_id = ? AND bet_id = ? GROUP BY choice', [guildId, Number(betId)]);
    const map = { a: { total: 0, entries: 0 }, b: { total: 0, entries: 0 } };
    for (const row of rows) map[row.choice] = { total: Number(row.total) || 0, entries: Number(row.entries) || 0 };
    return map;
}
function enterBet(guildId, userId, displayName, betId, choice, amount) {
    requireStyle(guildId);
    const bet = db.get('SELECT * FROM bets WHERE guild_id = ? AND id = ?', [guildId, Number(betId)]);
    if (!bet || bet.status !== 'open') throw new Error('open wager not found');
    const side = String(choice || '').toLowerCase();
    if (!['a', 'b'].includes(side)) throw new Error('choose side a or b');
    const wager = Math.trunc(Number(amount) || 0);
    if (wager < 100) throw new Error('minimum wager is RM 1.00');
    accounts.ensureUser(guildId, userId, displayName);
    if (db.walletBalance(guildId, userId) < wager) throw new Error('insufficient wallet balance');
    db.transaction(() => {
        db.post(guildId, 'bet_entry', userId, `Wager: ${bet.title}`, [
            accounts.walletEntry(guildId, userId, -wager),
            accounts.systemEntry(guildId, 'bet_escrow', wager),
        ]);
        db.run('INSERT INTO bet_entries (bet_id, guild_id, user_id, choice, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [bet.id, guildId, String(userId), side, wager, nowIso()]);
        db.audit(guildId, userId, 'bet_entry', { betId: bet.id, side, amount: wager });
    });
    return { bet, side, amount: wager };
}
function settleBet(guildId, actorId, betId, winning) {
    requireStyle(guildId);
    const bet = db.get('SELECT * FROM bets WHERE guild_id = ? AND id = ?', [guildId, Number(betId)]);
    if (!bet || bet.status !== 'open') throw new Error('open wager not found');
    const side = String(winning || '').toLowerCase();
    if (!['a', 'b'].includes(side)) throw new Error('choose winning side a or b');
    const entries = db.all('SELECT * FROM bet_entries WHERE guild_id = ? AND bet_id = ?', [guildId, bet.id]);
    const total = entries.reduce((sum, entry) => sum + Number(entry.amount_cents), 0);
    const winners = entries.filter(entry => entry.choice === side);
    const winningTotal = winners.reduce((sum, entry) => sum + Number(entry.amount_cents), 0);
    const at = nowIso();
    let paidTotal = 0;
    db.transaction(() => {
        const payouts = [];
        if (winningTotal > 0) {
            for (const entry of winners) {
                const payout = Math.floor(total * Number(entry.amount_cents) / winningTotal);
                if (payout > 0) payouts.push({ userId: entry.user_id, payout });
            }
        } else {
            for (const entry of entries) payouts.push({ userId: entry.user_id, payout: Number(entry.amount_cents) });
        }
        const paid = payouts.reduce((sum, row) => sum + row.payout, 0);
        paidTotal = paid;
        const remainder = Math.max(0, total - paid);
        const postings = [{ accountId: accounts.systemEntry(guildId, 'bet_escrow', 0).accountId, delta: -total }];
        for (const row of payouts) postings.push(accounts.walletEntry(guildId, row.userId, row.payout));
        if (remainder > 0) postings.push(accounts.governmentEntry(guildId, remainder));
        if (total > 0) db.post(guildId, 'bet_settlement', actorId, `Wager settled: ${bet.title}`, postings);
        db.run('UPDATE bets SET status = ?, winning_option = ?, settled_at = ? WHERE id = ?', ['settled', side, at, bet.id]);
        db.audit(guildId, actorId, 'bet_settlement', { betId: bet.id, side, total, paid, remainder });
    });
    return {
        bet,
        side,
        total,
        paid: paidTotal,
        winners: winners.length,
    };
}
function report(guildId) {
    const guild = db.getGuild(guildId);
    const live = market.live(guildId);
    const gov = government.summary(guildId);
    const bankView = { ...bank.summary(guildId), ...bank.health(guildId) };
    const stocks = securities.marketView(guildId);
    const companiesCount = db.get('SELECT COUNT(*) AS n FROM companies WHERE guild_id = ? AND status = ?', [guildId, 'active']);
    const lottery = style.forGuild(guildId) ? lotteryStatus(guildId) : null;
    return {
        guild,
        live,
        gov,
        bank: bankView,
        stocks,
        companies: Number(companiesCount && companiesCount.n) || 0,
        moneySupply: accounts.moneySupply(guildId),
        lottery,
    };
}
function economyHistory(guildId, limit) {
    return market.history(guildId, Math.max(1, Math.min(48, Number(limit) || 12)));
}
function transactions(guildId, userId, limit) {
    return db.all(`SELECT t.id, t.kind, t.memo, t.created_at, e.delta FROM transactions t
        JOIN ledger_entries e ON e.tx_id = t.id AND e.guild_id = t.guild_id
        JOIN accounts a ON a.id = e.account_id
        WHERE t.guild_id = ? AND a.owner_type = 'user' AND a.owner_id = ? AND a.kind = 'wallet'
        ORDER BY t.id DESC LIMIT ?`, [guildId, String(userId), Math.max(1, Math.min(25, Number(limit) || 12))]);
}

module.exports = {
    ensure,
    daily,
    civilWork,
    rob,
    casino,
    lotteryStatus,
    buyLottery,
    drawLottery,
    runCycle,
    shopList,
    buyItem,
    inventory,
    properties,
    useItem,
    leaderboard,
    wealth,
    createBet,
    openBets,
    betStats,
    enterBet,
    settleBet,
    report,
    economyHistory,
    transactions,
};
