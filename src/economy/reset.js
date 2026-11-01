'use strict';

const db = require('../db');
const community = require('./community');
const cryptoMarket = require('./crypto');

const ECONOMY_TABLES = [
    'ledger_entries',
    'transactions',
    'loan_payments',
    'loans',
    'bonds',
    'jobs',
    'employment',
    'company_flows',
    'stock_prices',
    'share_holdings',
    'inventory',
    'companies',
    'snapshots',
    'goods_market',
    'user_items',
    'properties',
    'shop_items',
    'lottery_tickets',
    'lottery',
    'bet_entries',
    'bets',
    'crypto_trades',
    'crypto_prices',
    'crypto_holdings',
    'crypto_assets',
    'accounts',
    'profiles',
    'jarvis_usage',
    'jarvis_messages',
    'member_activity',
    'member_events',
    'reputation_events',
    'message_history',
    'news_signals',
    'audit_log',
];

function resetGuild(guildId) {
    const id = String(guildId);
    const guild = db.getGuild(id);
    if (!guild) throw new Error('guild not found');
    db.transaction(() => {
        for (const table of ECONOMY_TABLES) {
            db.run(`DELETE FROM ${table} WHERE guild_id = ?`, [id]);
        }
        db.run('UPDATE guilds SET last_cycle_at = NULL, last_cycle_tick = 0, updated_at = ? WHERE guild_id = ?', [new Date().toISOString(), id]);
        db.ensureInstitutionAccounts(id);
        db.ensureGoods(id);
        if (guild.style_key && guild.style_key !== 'none') community.ensure(id);
        cryptoMarket.ensure(id);
        db.audit(id, null, 'economy_reset', {});
    });
    return true;
}

module.exports = { resetGuild, ECONOMY_TABLES };
