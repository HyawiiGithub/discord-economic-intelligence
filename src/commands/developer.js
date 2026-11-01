'use strict';

const db = require('../db');
const permissions = require('../permissions');
const community = require('../economy/community');
const style = require('../style');
const { currencyPreset } = require('../config');
const { embed, field, send, COLORS } = require('./helpers');
const { parsePercent, formatBps, formatDateTime } = require('../money');

function requireDeveloper(ctx) {
    if (!permissions.isDeveloper(ctx.userId)) throw new permissions.PermissionError('developer authority is required');
}
function guildRow(id) {
    const row = db.get('SELECT * FROM guilds WHERE guild_id = ?', [String(id)]);
    if (!row) throw new Error('guild not found');
    return row;
}
function integrity(guildId) {
    const values = guildId ? [String(guildId)] : [];
    const imbalance = db.all(`SELECT guild_id, SUM(delta) AS total FROM ledger_entries ${guildId ? 'WHERE guild_id = ?' : ''} GROUP BY guild_id HAVING ABS(SUM(delta)) > 0`, values);
    const mismatches = db.all(`SELECT a.id, a.guild_id, a.owner_type, a.owner_id, a.kind, a.balance,
        COALESCE(SUM(e.delta), 0) AS ledger_balance
        FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
        ${guildId ? 'WHERE a.guild_id = ?' : ''}
        GROUP BY a.id HAVING a.balance <> ledger_balance ORDER BY ABS(a.balance - ledger_balance) DESC LIMIT 20`, values);
    let pragma = [];
    try {
        pragma = db.raw().prepare('PRAGMA integrity_check').all();
    } catch (error) {
        pragma = [{ integrity_check: error.message }];
    }
    return { imbalance, mismatches, pragma };
}
async function sys(ctx) {
    requireDeveloper(ctx);
    const sub = String(ctx.args[0] || 'guilds').toLowerCase();
    if (sub === 'guilds') {
        const rows = db.all('SELECT guild_id, name, style_key, model, cycle_minutes, last_cycle_tick FROM guilds ORDER BY guild_id LIMIT 25');
        const emb = embed('Developer · registered servers', rows.length
            ? rows.map(row => `**${row.guild_id}** · ${row.name || 'unnamed'}\n${row.style_key || 'plain'} · ${row.model} · cycle ${row.last_cycle_tick || 0}`).join('\n\n')
            : 'No servers registered.', COLORS.gold);
        await send(ctx, { embeds: [emb] });
        return;
    }
    if (sub === 'guild') {
        const id = ctx.args[1];
        if (!id) throw new Error('usage: sys guild <guild_id>');
        const row = guildRow(id);
        const emb = embed('Developer · server inspection', `**${row.name}** · ${row.guild_id}`, COLORS.gold);
        field(emb, 'Theme', row.style_key || 'none', true);
        field(emb, 'Model', row.model, true);
        field(emb, 'Currency', `${row.currency_name} (${row.currency_code})`, true);
        field(emb, 'Cycle', `${row.cycle_minutes} minutes · #${row.last_cycle_tick || 0}`, true);
        field(emb, 'Institutions', `${row.central_bank_name} · ${row.government_name}`, false);
        field(emb, 'Taxes', `income ${formatBps(row.income_tax_bps)} · corporate ${formatBps(row.corporate_tax_bps)} · payroll ${formatBps(row.payroll_tax_bps)} · VAT ${formatBps(row.vat_bps)}`, false);
        field(emb, 'Last cycle', row.last_cycle_at ? formatDateTime(row.last_cycle_at) : 'never', true);
        field(emb, 'Update channels', String(db.get('SELECT COUNT(*) AS n FROM channel_bindings WHERE guild_id = ?', [row.guild_id]).n), true);
        await send(ctx, { embeds: [emb] });
        return;
    }
    if (sub === 'integrity' || sub === 'check') {
        const result = integrity(ctx.args[1]);
        const emb = embed('Developer · integrity check', ctx.args[1] ? `Server ${ctx.args[1]}` : 'All registered servers', result.imbalance.length || result.mismatches.length ? COLORS.warning : COLORS.accent);
        field(emb, 'Ledger imbalance', result.imbalance.length ? result.imbalance.map(row => `${row.guild_id}: ${row.total}`).join('\n') : 'none', false);
        field(emb, 'Account mismatches', result.mismatches.length
            ? result.mismatches.map(row => `#${row.id} ${row.owner_type}/${row.owner_id}/${row.kind}: ${row.balance} vs ${row.ledger_balance}`).join('\n')
            : 'none', false);
        field(emb, 'SQLite integrity', result.pragma.map(row => row.integrity_check).join('\n').slice(0, 1000), false);
        await send(ctx, { embeds: [emb] });
        return;
    }
    if (sub === 'reconcile' || sub === 'repair') {
        const id = ctx.args[1];
        if (!id) throw new Error('usage: sys reconcile <guild_id>');
        guildRow(id);
        const result = db.transaction(() => {
            const rows = db.all(`SELECT a.id, a.balance, COALESCE(SUM(e.delta), 0) AS ledger_balance
                FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
                WHERE a.guild_id = ? GROUP BY a.id HAVING a.balance <> ledger_balance`, [String(id)]);
            for (const row of rows) {
                db.run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [Number(row.ledger_balance) || 0, new Date().toISOString(), row.id]);
            }
            db.audit(id, ctx.userId, 'developer_reconcile', { accounts: rows.length });
            return rows.length;
        });
        await send(ctx, { embeds: [embed('Developer · accounts reconciled', `Repaired **${result}** account balance(s) from the ledger.`, COLORS.accent)] });
        return;
    }
    if (sub === 'bugs') {
        const id = ctx.args[1];
        if (!id) throw new Error('usage: sys bugs <guild_id>');
        const rows = db.all('SELECT id, command, summary, status, html_path, created_at FROM bug_reports WHERE guild_id = ? ORDER BY id DESC LIMIT 15', [String(id)]);
        const emb = embed('Developer · bug reports', rows.length
            ? rows.map(row => `**#${row.id}** · ${row.status} · ${row.command || 'general'}\n${row.summary}\n${row.html_path || 'no html'}`).join('\n\n')
            : 'No bug reports for that server.', COLORS.gold);
        return send(ctx, { embeds: [emb] });
    }
    if (sub === 'jarvis') {
        const action = String(ctx.args[1] || '').toLowerCase();
        const id = ctx.args[2];
        if (action !== 'reset' || !id) throw new Error('usage: sys jarvis reset <guild_id> [user_id]');
        guildRow(id);
        const userId = ctx.args[3];
        const result = userId
            ? db.run('DELETE FROM jarvis_usage WHERE guild_id = ? AND user_id = ?', [String(id), String(userId)])
            : db.run('DELETE FROM jarvis_usage WHERE guild_id = ?', [String(id)]);
        if (userId) db.run('DELETE FROM jarvis_messages WHERE guild_id = ? AND user_id = ?', [String(id), String(userId)]);
        else db.run('DELETE FROM jarvis_messages WHERE guild_id = ?', [String(id)]);
        db.audit(id, ctx.userId, 'developer_jarvis_reset', { userId: userId || null, rows: Number(result.changes) });
        await send(ctx, { embeds: [embed('Developer · Jarvis reset', `Cleared **${Number(result.changes)}** usage record(s).`, COLORS.accent)] });
        return;
    }
    if (sub === 'set') {
        const id = ctx.args[1];
        const key = String(ctx.args[2] || '').toLowerCase();
        const value = ctx.args.slice(3).join(' ');
        if (!id || !key || !value) throw new Error('usage: sys set <guild_id> <key> <value>');
        guildRow(id);
        const patch = {};
        if (key === 'style' || key === 'theme') {
            if (!style.preset(value) && value !== 'none') throw new Error('unknown style');
            patch.style_key = value;
        } else if (key === 'currency') {
            const currency = currencyPreset(value.toUpperCase());
            patch.currency_code = currency.code;
            patch.currency_name = currency.name;
            patch.currency_symbol = currency.symbol;
        } else if (key === 'prefix') patch.prefix = value;
        else if (key === 'bankname') patch.central_bank_name = value;
        else if (key === 'govname') patch.government_name = value;
        else if (key === 'cycle') patch.cycle_minutes = Math.max(1, Number(value) || 60);
        else if (key === 'workcooldown') patch.work_cooldown_min = Math.max(1, Number(value) || 1);
        else if (key === 'starter') patch.starter_balance = Math.max(0, Math.trunc(Number(value) || 0));
        else if (key === 'jarvis') patch.jarvis_limit = Math.max(1, Math.trunc(Number(value) || 5));
        else if (['income_tax', 'corporate_tax', 'payroll_tax', 'vat', 'wealth_tax', 'policy_rate', 'reserve_ratio'].includes(key)) {
            const column = key === 'income_tax' ? 'income_tax_bps'
                : key === 'corporate_tax' ? 'corporate_tax_bps'
                    : key === 'payroll_tax' ? 'payroll_tax_bps'
                        : key === 'vat' ? 'vat_bps'
                            : key === 'wealth_tax' ? 'wealth_tax_bps'
                                : key === 'policy_rate' ? 'policy_rate_bps' : 'reserve_ratio_bps';
            patch[column] = Math.round(parsePercent(value) * 100);
        } else {
            throw new Error('unknown developer setting');
        }
        db.updateGuild(id, patch);
        db.audit(id, ctx.userId, 'developer_set', { key, value });
        if (patch.style_key) community.ensure(id);
        await send(ctx, { embeds: [embed('Developer · setting updated', `Server **${id}** · **${key}** = **${value}**.`, COLORS.gold)] });
        return;
    }
    if (sub === 'vacuum') {
        db.raw().exec('PRAGMA wal_checkpoint(TRUNCATE)');
        db.raw().exec('VACUUM');
        await send(ctx, { embeds: [embed('Developer · database maintained', 'WAL checkpoint and VACUUM completed.', COLORS.accent)] });
        return;
    }
    await send(ctx, { embeds: [embed('Developer systems', [
        '`sys guilds` · `sys guild <id>`',
        '`sys integrity [id]` · `sys reconcile <id>`',
        '`sys bugs <id>` · `sys jarvis reset <id> [user]`',
        '`sys set <id> <key> <value>`',
        '`sys vacuum`',
    ].join('\n'), COLORS.gold)] });
}

module.exports = { sys, integrity };
