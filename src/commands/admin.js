'use strict';

const db = require('../db');
const permissions = require('../permissions');
const cycle = require('../economy/cycle');
const community = require('../economy/community');
const news = require('../economy/news');
const feeds = require('../feeds');
const bugfix = require('../bugfix');
const style = require('../style');
const jarvis = require('../jarvis');
const { modelPreset, normalizeModel, currencyPreset, POWER_KEYS, POWER_LABELS, OFFICES } = require('../config');
const { embed, field, send, COLORS, fmt, parseAmount, parseUserId, resolveMember, userTag } = require('./helpers');
const { formatBps, formatDateTime, parsePercent, nowIso, formatMoney } = require('../money');

function requireConfig(ctx) {
    permissions.requirePower(ctx.guildId, ctx.member, 'config');
}
async function config(ctx) {
    const sub = String(ctx.args[0] || 'show').toLowerCase();
    if (sub === 'show' || sub === 'view') return show(ctx);
    if (sub === 'help' || sub === '?') {
        const emb = embed('Configuration guide', `Operational settings for **${ctx.guild.name}**. Use \`config show\` to inspect current values.`, COLORS.gold);
        field(emb, 'Visual identity', [
            '`config model <market|social_market|mixed|state_led>`',
            '`config style <reichsmark|german_empire_1914|ussr|none>`',
            '`config currency <CODE>` · `config prefix <prefix>`',
            '`config bankname <name>` · `config govname <name>`',
        ].join('\n'), false);
        field(emb, 'Update channels', [
            '`config channel <overview|market|stocks|crypto|lottery|report|audit> #channel`',
            '`config channel <feed> off`',
            '`config channels` · `config refresh`',
            'Each bound feed posts once and edits the same message on every cycle.',
        ].join('\n'), false);
        field(emb, 'Taxes and monetary policy', [
            '`config tax <income|corporate|payroll|vat|wealth> <percent>`',
            '`config rate <percent>` · `config reserve <percent>`',
        ].join('\n'), false);
        field(emb, 'Schedule and access', [
            '`config cycle <minutes>` · `config workcooldown <minutes>`',
            '`config starter <amount>` · `config jarvis <uses>`',
            '`powers` · `appoint @member <office> [days]`',
        ].join('\n'), false);
        return send(ctx, { embeds: [emb] });
    }
    requireConfig(ctx);
    const guild = db.getGuild(ctx.guildId);
    if (sub === 'model') {
        const model = normalizeModel(ctx.args[1]);
        if (!model) return send(ctx, { embeds: [embed('Unknown model', 'Use `market`, `social_market`, `mixed` or `state_led`.', COLORS.danger)] });
        const preset = modelPreset(model);
        db.updateGuild(ctx.guildId, {
            model,
            income_tax_bps: preset.income_tax_bps,
            corporate_tax_bps: preset.corporate_tax_bps,
            payroll_tax_bps: preset.payroll_tax_bps,
            vat_bps: preset.vat_bps,
            policy_rate_bps: preset.policy_rate_bps,
            reserve_ratio_bps: preset.reserve_ratio_bps,
            welfare_bps: preset.welfare_bps,
            central_bank_independence: preset.central_bank_independence,
            market_openness: preset.market_openness,
        });
        db.audit(ctx.guildId, ctx.userId, 'config_model', { model });
        return send(ctx, { embeds: [embed('Economic model updated', `**${preset.label}**\n${preset.description}`, COLORS.accent)] });
    }
    if (sub === 'currency') {
        const code = String(ctx.args[1] || '').toUpperCase();
        if (!/^[A-Z]{3}$/.test(code)) return send(ctx, { embeds: [embed('Invalid currency', 'Use a three-letter currency code, such as USD or EUR.', COLORS.danger)] });
        const currency = currencyPreset(code);
        db.updateGuild(ctx.guildId, { currency_code: currency.code, currency_name: currency.name, currency_symbol: currency.symbol });
        db.audit(ctx.guildId, ctx.userId, 'config_currency', { code });
        return send(ctx, { embeds: [embed('Currency updated', `The server now uses **${currency.name} (${currency.code})**. Balances are not converted automatically.`, COLORS.accent)] });
    }
    if (sub === 'channel' || sub === 'feed') {
        const key = String(ctx.args[1] || '').trim().toLowerCase();
        const target = String(ctx.args[2] || '').trim();
        if (!feeds.normalizeKey(key)) {
            return send(ctx, { embeds: [embed('Feed keys', `Use ${feeds.KEYS.map(item => `\`${item}\``).join(', ')}.`, COLORS.warning)] });
        }
        if (target === 'off' || target === 'none' || target === 'disable') {
            const removed = feeds.unbind(ctx.guildId, key);
            return send(ctx, { embeds: [embed('Update channel removed', removed ? `The **${key}** feed is no longer bound.` : 'No binding existed.', COLORS.muted)] });
        }
        const id = target.replace(/[<#>]/g, '').trim();
        if (!/^\d{5,25}$/.test(id)) {
            return send(ctx, { embeds: [embed('Channel required', `Use \`config channel ${key} #channel\` or \`config channel ${key} off\`.`, COLORS.warning)] });
        }
        const channel = ctx.guild.channels.cache.get(id) || await ctx.guild.channels.fetch(id).catch(() => null);
        if (!channel) return send(ctx, { embeds: [embed('Channel not found', 'That channel is not available to the bot.', COLORS.danger)] });
        feeds.bind(ctx.guildId, key, id);
        if (ctx.client) await feeds.publish(ctx.client, ctx.guildId, key);
        db.audit(ctx.guildId, ctx.userId, 'config_feed_channel', { feed: key, channelId: id });
        return send(ctx, { embeds: [embed('Update channel bound', `The **${key}** feed now posts and edits its message in <#${id}>.`, COLORS.gold)] });
    }
    if (sub === 'refresh') {
        const result = ctx.client ? await feeds.updateGuild(ctx.client, ctx.guildId) : [];
        db.audit(ctx.guildId, ctx.userId, 'config_refresh_feeds', { updated: result.length });
        return send(ctx, { embeds: [embed('Update channels refreshed', `Updated **${result.length}** bound feed(s).`, COLORS.gold)] });
    }
    if (sub === 'channels' || sub === 'feeds') {
        const rows = feeds.list(ctx.guildId);
        const description = rows.length
            ? rows.map(row => `**${row.feed_key}** · <#${row.channel_id}> · ${row.message_id ? `message ${row.message_id}` : 'will post on next update'}`).join('\n')
            : 'No update channels are bound.';
        const emb = embed('Update channels', description, COLORS.gold);
        field(emb, 'Available feeds', feeds.KEYS.map(key => `\`${key}\``).join(' · '), false);
        field(emb, 'Bind or remove', '`config channel <feed> #channel`\n`config channel <feed> off`\n`config refresh`', false);
        return send(ctx, { embeds: [emb] });
    }
    if (sub === 'news' || sub === 'announcements' || sub === 'intel') {
        const key = sub === 'intel' ? String(ctx.args[1] || '').toLowerCase() : sub;
        const target = sub === 'intel' ? String(ctx.args[2] || '') : String(ctx.args[1] || '');
        if (!news.SIGNAL_KEYS.includes(key)) {
            return send(ctx, { embeds: [embed('Signal channels', 'Use `config news #channel`, `config announcements #channel` or `config intel <news|announcements> #channel`.', COLORS.warning)] });
        }
        if (target === 'off' || target === 'none' || target === 'disable') {
            news.unbind(ctx.guildId, key);
            return send(ctx, { embeds: [embed('Signal channel removed', `The **${key}** signal channel is no longer bound.`, COLORS.muted)] });
        }
        const id = target.replace(/[<#>]/g, '').trim();
        if (!/^\d{5,25}$/.test(id)) {
            return send(ctx, { embeds: [embed('Channel required', `Use \`config ${key} #channel\` or \`config ${key} off\`.`, COLORS.warning)] });
        }
        news.bind(ctx.guildId, key, id);
        if (ctx.client) news.backfillChannel(ctx.client, ctx.guildId, id, 100).catch(error => console.error('[news:backfill]', error.message));
        db.audit(ctx.guildId, ctx.userId, 'config_signal_channel', { key, channelId: id });
        return send(ctx, { embeds: [embed('Signal channel bound', `Jarvis now reads **${key}** messages from <#${id}> and uses them as market intelligence.`, COLORS.gold)] });
    }
    if (sub === 'signals') {
        const rows = news.list(ctx.guildId);
        return send(ctx, { embeds: [embed('Signal channels', rows.length ? rows.map(row => `**${row.signal_key}** · <#${row.channel_id}>`).join('\n') : 'No news or announcement channels bound.', COLORS.gold)] });
    }
    if (sub === 'style' || sub === 'theme') {
        const key = String(ctx.args[1] || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (key === 'none' || key === 'default' || key === 'off') {
            const plain = currencyPreset('USD');
            db.updateGuild(ctx.guildId, {
                style_key: 'none',
                currency_code: plain.code,
                currency_name: plain.name,
                currency_symbol: plain.symbol,
                central_bank_name: 'State Bank',
                government_name: 'Treasury',
                prefix: '-',
            });
            db.audit(ctx.guildId, ctx.userId, 'config_style', { style: 'none' });
            return send(ctx, { embeds: [embed('Theme disabled', 'This server now uses the plain institutional interface.', COLORS.muted)] });
        }
        const selected = style.preset(key);
        if (!selected) {
            return send(ctx, { embeds: [embed('Unknown theme', 'Use `reichsmark`, `german_empire_1914`, `ussr` or `none`.', COLORS.danger)] });
        }
        const currency = currencyPreset(selected.currency);
        const patch = {
            style_key: selected.key,
            style_custom: null,
            currency_code: currency.code,
            currency_name: currency.name,
            currency_symbol: currency.symbol,
            central_bank_name: selected.bankName,
            government_name: selected.governmentName,
            prefix: selected.prefix,
            work_cooldown_min: 10,
        };
        if (selected.applyModel) {
            const preset = modelPreset(selected.model);
            Object.assign(patch, {
                model: selected.model,
                income_tax_bps: preset.income_tax_bps,
                corporate_tax_bps: preset.corporate_tax_bps,
                payroll_tax_bps: preset.payroll_tax_bps,
                vat_bps: preset.vat_bps,
                policy_rate_bps: preset.policy_rate_bps,
                reserve_ratio_bps: preset.reserve_ratio_bps,
                welfare_bps: preset.welfare_bps,
                central_bank_independence: preset.central_bank_independence,
                market_openness: preset.market_openness,
            });
        }
        db.updateGuild(ctx.guildId, patch);
        community.ensure(ctx.guildId);
        db.audit(ctx.guildId, ctx.userId, 'config_style', { style: selected.key });
        return send(ctx, { embeds: [embed('Theme updated', `This server now uses **${selected.label}**.\nCurrency **${selected.currency}**, institution **${selected.bankName}**, prefix **${selected.prefix}**.`, selected.color)] });
    }
    if (sub === 'tax') {
        const kind = String(ctx.args[1] || '').toLowerCase();
        const columns = { income: 'income_tax_bps', corporate: 'corporate_tax_bps', payroll: 'payroll_tax_bps', vat: 'vat_bps', wealth: 'wealth_tax_bps' };
        const column = columns[kind];
        if (!column) return send(ctx, { embeds: [embed('Tax type', 'Use `income`, `corporate`, `payroll`, `vat` or `wealth`.', COLORS.warning)] });
        const percent = parsePercent(ctx.args[2]);
        if (percent < 0 || percent > 100) return send(ctx, { embeds: [embed('Invalid tax rate', 'Use a percentage from 0 to 100.', COLORS.warning)] });
        const bps = Math.round(percent * 100);
        db.updateGuild(ctx.guildId, { [column]: bps });
        db.audit(ctx.guildId, ctx.userId, 'config_tax', { kind, bps });
        return send(ctx, { embeds: [embed('Tax rate updated', `**${kind}** is now **${formatBps(bps)}**.`, COLORS.accent)] });
    }
    if (sub === 'rate') {
        const percent = parsePercent(ctx.args[1]);
        if (percent < -1 || percent > 50) return send(ctx, { embeds: [embed('Invalid policy rate', 'Use a percentage from -1 to 50.', COLORS.warning)] });
        const bps = Math.round(percent * 100);
        db.updateGuild(ctx.guildId, { policy_rate_bps: bps });
        db.audit(ctx.guildId, ctx.userId, 'config_policy_rate', { bps });
        return send(ctx, { embeds: [embed('Policy rate updated', `The policy rate is now **${formatBps(bps)}**.`, COLORS.accent)] });
    }
    if (sub === 'reserve') {
        const percent = parsePercent(ctx.args[1]);
        if (percent < 0 || percent > 50) return send(ctx, { embeds: [embed('Invalid reserve ratio', 'Use a percentage from 0 to 50.', COLORS.warning)] });
        const bps = Math.round(percent * 100);
        db.updateGuild(ctx.guildId, { reserve_ratio_bps: bps });
        db.audit(ctx.guildId, ctx.userId, 'config_reserve', { bps });
        return send(ctx, { embeds: [embed('Reserve requirement updated', `The reserve requirement is now **${formatBps(bps)}**.`, COLORS.accent)] });
    }
    if (sub === 'cycle') {
        const minutes = Math.max(1, Math.min(10080, Math.trunc(Number(ctx.args[1]) || Number(guild.cycle_minutes) || 60)));
        db.updateGuild(ctx.guildId, { cycle_minutes: minutes });
        db.audit(ctx.guildId, ctx.userId, 'config_cycle', { minutes });
        return send(ctx, { embeds: [embed('Cycle schedule updated', `A cycle now runs every **${minutes} minutes**.`, COLORS.accent)] });
    }
    if (sub === 'starter') {
        const amount = parseAmount(ctx.args[1]);
        if (amount < 0 || amount > 100000000) return send(ctx, { embeds: [embed('Invalid starter balance', 'Use an amount from 0 to 1,000,000.', COLORS.warning)] });
        db.updateGuild(ctx.guildId, { starter_balance: amount });
        db.audit(ctx.guildId, ctx.userId, 'config_starter', { amount });
        return send(ctx, { embeds: [embed('Starter balance updated', `New households receive **${fmt(ctx, amount)}**. Existing households are unaffected.`, COLORS.accent)] });
    }
    if (sub === 'jarvis') {
        const limit = Math.max(1, Math.min(50, Math.trunc(Number(ctx.args[1]) || 5)));
        db.updateGuild(ctx.guildId, { jarvis_limit: limit });
        db.audit(ctx.guildId, ctx.userId, 'config_jarvis', { limit });
        return send(ctx, { embeds: [embed('Jarvis limit updated', `Each person receives **${limit}** uses per day.`, COLORS.accent)] });
    }
    if (sub === 'prefix') {
        const prefix = String(ctx.args[1] || '').trim();
        if (!prefix || prefix.length > 3 || /\s/.test(prefix)) return send(ctx, { embeds: [embed('Invalid prefix', 'Use 1 to 3 characters with no spaces.', COLORS.warning)] });
        db.updateGuild(ctx.guildId, { prefix });
        db.audit(ctx.guildId, ctx.userId, 'config_prefix', { prefix });
        return send(ctx, { embeds: [embed('Prefix updated', `Commands now use **${prefix}**.`, COLORS.accent)] });
    }
    if (sub === 'bankname') {
        const name = ctx.args.slice(1).join(' ').slice(0, 60);
        if (!name) return send(ctx, { embeds: [embed('Usage', '`-config bankname <name>`', COLORS.warning)] });
        db.updateGuild(ctx.guildId, { central_bank_name: name });
        db.audit(ctx.guildId, ctx.userId, 'config_bank_name', { name });
        return send(ctx, { embeds: [embed('State bank renamed', `The institution is now **${name}**.`, COLORS.accent)] });
    }
    if (sub === 'govname') {
        const name = ctx.args.slice(1).join(' ').slice(0, 60);
        if (!name) return send(ctx, { embeds: [embed('Usage', '`-config govname <name>`', COLORS.warning)] });
        db.updateGuild(ctx.guildId, { government_name: name });
        db.audit(ctx.guildId, ctx.userId, 'config_government_name', { name });
        return send(ctx, { embeds: [embed('Treasury renamed', `The fiscal authority is now **${name}**.`, COLORS.accent)] });
    }
    if (sub === 'workcooldown') {
        const minutes = Math.max(1, Math.min(10080, Math.trunc(Number(ctx.args[1]) || Number(guild.work_cooldown_min) || 480)));
        db.updateGuild(ctx.guildId, { work_cooldown_min: minutes });
        db.audit(ctx.guildId, ctx.userId, 'config_work_cooldown', { minutes });
        return send(ctx, { embeds: [embed('Work cooldown updated', `Each person can work every **${minutes} minutes**.`, COLORS.accent)] });
    }
    return send(ctx, { embeds: [embed('Configuration', [
        '`-config model <market|social_market|mixed|state_led>`',
        '`-config style <reichsmark|german_empire_1914|ussr|none>`',
        '`-config channel <feed> #channel|off` · `-config channels` · `-config refresh`',
        '`-config news #channel|off` · `-config announcements #channel|off` · `-config signals`',
        '`-config currency <CODE>`',
        '`-config tax <income|corporate|payroll|vat|wealth> <percent>`',
        '`-config rate <percent>` · `-config reserve <percent>`',
        '`-config cycle <minutes>` · `-config workcooldown <minutes>`',
        '`-config starter <amount>` · `-config jarvis <uses>`',
        '`-config prefix <prefix>` · `-config bankname <name>` · `-config govname <name>`',
    ].join('\n'), COLORS.surface)] });
}
async function show(ctx) {
    const guild = db.getGuild(ctx.guildId);
    const state = cycle.status(ctx.guildId);
    const emb = embed('Economic configuration', `**${guild.name}** · ${guild.model.replace(/_/g, ' ')}`, COLORS.accent);
    const guildStyle = style.forGuild(ctx.guildId, guild);
    field(emb, 'Theme', guildStyle ? guildStyle.label : 'plain institutional', true);
    field(emb, 'Update channels', `${feeds.list(ctx.guildId).length} bound`, true);
    field(emb, 'Signal channels', `${news.list(ctx.guildId).length} bound`, true);
    field(emb, 'Currency', `${guild.currency_name} (${guild.currency_code})`, true);
    field(emb, 'Prefix', guild.prefix, true);
    field(emb, 'Cycle', `${guild.cycle_minutes} minutes · #${state.tick}`, true);
    field(emb, 'Income tax', formatBps(guild.income_tax_bps), true);
    field(emb, 'Corporate tax', formatBps(guild.corporate_tax_bps), true);
    field(emb, 'Payroll tax', formatBps(guild.payroll_tax_bps), true);
    field(emb, 'VAT', formatBps(guild.vat_bps), true);
    field(emb, 'Wealth tax', formatBps(guild.wealth_tax_bps), true);
    field(emb, 'Policy rate', formatBps(guild.policy_rate_bps), true);
    field(emb, 'Reserve requirement', formatBps(guild.reserve_ratio_bps), true);
    field(emb, 'Starter balance', fmt(ctx, guild.starter_balance), true);
    field(emb, 'Work cooldown', `${guild.work_cooldown_min} minutes`, true);
    field(emb, 'Jarvis', `${guild.jarvis_limit} uses per person per day`, true);
    field(emb, 'Institutions', `${guild.central_bank_name} · ${guild.government_name}`, false);
    field(emb, 'Next cycle', state.due ? 'due now' : formatDateTime(state.nextAt), false);
    await send(ctx, { embeds: [emb] });
}
async function powers(ctx) {
    const sub = String(ctx.args[0] || '').toLowerCase();
    if (sub === 'role') {
        requireConfig(ctx);
        const roleId = parseUserId(ctx.args[1]);
        if (!roleId) return send(ctx, { embeds: [embed('Usage', '`-powers role @role <powers>`', COLORS.warning)] });
        const list = ctx.args.slice(2).join(',').split(/[,\s]+/).filter(Boolean);
        const result = permissions.grantRolePower(ctx.guildId, roleId, list, ctx.userId);
        return send(ctx, { embeds: [embed('Role authority updated', `<@&${result.roleId}> now holds **${result.powers.join(', ')}**.`, COLORS.accent)] });
    }
    if (sub === 'revoke') {
        requireConfig(ctx);
        const roleId = parseUserId(ctx.args[1]);
        if (!roleId) return send(ctx, { embeds: [embed('Usage', '`-powers revoke @role`', COLORS.warning)] });
        permissions.revokeRolePower(ctx.guildId, roleId, ctx.userId);
        return send(ctx, { embeds: [embed('Role authority revoked', `<@&${roleId}> no longer holds delegated powers.`, COLORS.muted)] });
    }
    if (sub === 'list') {
        const rows = permissions.listRolePowers(ctx.guildId);
        return send(ctx, { embeds: [embed('Role authorities', rows.length
            ? rows.map(row => `<@&${row.role_id}> · ${row.powers.join(', ')}`).join('\n')
            : 'No delegated role powers. Administrators and the server owner hold full authority.', COLORS.accent)] });
    }
    const view = permissions.rolePowerView(ctx.guildId, ctx.member);
    const emb = embed('Your authority', view.full ? 'You hold full administrative authority.' : view.powers.length ? 'You hold delegated authority.' : 'You hold ordinary membership authority.', COLORS.accent);
    field(emb, 'Powers', view.powers.length ? view.powers.map(power => `\`${power}\` ${POWER_LABELS[power] || ''}`).join('\n') : 'None', false);
    if (view.appointment) field(emb, 'Office', `${view.appointment.label} · expires ${view.appointment.expires_at || 'never'}`, false);
    field(emb, 'Reference', POWER_KEYS.map(key => `\`${key}\` ${POWER_LABELS[key]}`).join('\n'), false);
    await send(ctx, { embeds: [emb] });
}
async function appoint(ctx) {
    requireConfig(ctx);
    const member = await resolveMember(ctx, ctx.args[0]);
    if (!member) return send(ctx, { embeds: [embed('Usage', '`-appoint @member <office> [days]`', COLORS.warning)] });
    const office = String(ctx.args[1] || '').toLowerCase();
    const result = permissions.appoint(ctx.guildId, member.id, office, ctx.userId, { days: Number(ctx.args[2]) || 0 });
    await send(ctx, { embeds: [embed('Appointment made', `**${userTag(member)}** is now **${result.label}** with **${result.powers.join(', ')}** authority.`, COLORS.accent)] });
}
async function dismiss(ctx) {
    requireConfig(ctx);
    const member = await resolveMember(ctx, ctx.args[0]);
    if (!member) return send(ctx, { embeds: [embed('Usage', '`-dismiss @member`', COLORS.warning)] });
    const removed = permissions.dismiss(ctx.guildId, member.id, ctx.userId);
    await send(ctx, { embeds: [embed('Appointment ended', removed ? `**${userTag(member)}** no longer holds an appointed office.` : `**${userTag(member)}** held no appointment.`, COLORS.muted)] });
}
async function appointments(ctx) {
    const rows = permissions.listAppointments(ctx.guildId);
    const emb = embed('Appointments', rows.length
        ? rows.map(row => `<@${row.user_id}> · **${row.label}** · ${row.powers.join(', ')}${row.expires_at ? ` · expires ${row.expires_at.slice(0, 10)}` : ''}`).join('\n')
        : 'No appointed offices.', COLORS.accent);
    field(emb, 'Available offices', Object.entries(OFFICES).map(([key, office]) => `\`${key}\` ${office.label}`).join('\n'), false);
    await send(ctx, { embeds: [emb] });
}
async function auditLog(ctx) {
    permissions.requirePower(ctx.guildId, ctx.member, 'audit');
    const limit = Math.max(1, Math.min(30, Number(ctx.args[0]) || 15));
    const rows = db.recentAudit(ctx.guildId, limit);
    const emb = embed('Audit trail', rows.length
        ? rows.map(row => `\`${row.created_at.slice(11, 19)}\` **${row.action}** · ${row.actor_id || 'system'}${row.detail ? ` · ${String(row.detail).slice(0, 100)}` : ''}`).join('\n')
        : 'No audit entries.', COLORS.muted);
    await send(ctx, { embeds: [emb] });
}
async function cycleCommand(ctx) {
    if (String(ctx.args[0] || '').toLowerCase() === 'run') {
        requireConfig(ctx);
        const result = cycle.runCycle(ctx.guildId);
        const emb = embed('Cycle completed', `Cycle **${result.tick}** recorded.`, COLORS.accent);
        field(emb, 'Output', fmt(ctx, result.snapshot.gdp_cents), true);
        field(emb, 'Price index', (Number(result.snapshot.price_index) / 100).toFixed(2), true);
        field(emb, 'Loans serviced', String(result.bank.loansServiced), true);
        field(emb, 'Bonds serviced', String(result.government.bondsServiced), true);
        field(emb, 'Next cycle', formatDateTime(result.nextAt), false);
        if (ctx.client) await feeds.updateGuild(ctx.client, ctx.guildId);
        return send(ctx, { embeds: [emb] });
    }
    const state = cycle.status(ctx.guildId);
    const emb = embed('Cycle status', `Cycle **${state.tick}** for **${ctx.guild.name}**.`, COLORS.accent);
    field(emb, 'Last cycle', state.lastAt ? formatDateTime(state.lastAt) : 'not yet run', false);
    field(emb, 'Next cycle', state.due ? 'due now' : formatDateTime(state.nextAt), false);
    field(emb, 'Interval', `${state.minutes} minutes`, true);
    field(emb, 'Jarvis', `${jarvis.usageFor(ctx.guildId, ctx.userId).used} uses today`, true);
    await send(ctx, { embeds: [emb] });
}
async function jarvisStatus(ctx) {
    const info = jarvis.status();
    const usage = jarvis.usageFor(ctx.guildId, ctx.userId);
    const emb = embed('Jarvis status', info.configured ? 'Live economic intelligence is configured.' : 'No model key is configured; Jarvis will answer with ledger briefs.', COLORS.accent);
    field(emb, 'Model', info.model, false);
    field(emb, 'Today', usage.unlimited ? `${usage.used} uses` : `${usage.used}/${usage.limit} uses`, true);
    field(emb, 'Remaining', usage.unlimited ? 'Unlimited' : String(usage.remaining), true);
    await send(ctx, { embeds: [emb], components: [bugfix.bugButton()] });
}

module.exports = {
    config,
    show,
    powers,
    appoint,
    dismiss,
    appointments,
    auditLog,
    cycleCommand,
    jarvisStatus,
};
