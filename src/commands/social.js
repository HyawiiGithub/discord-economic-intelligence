'use strict';

const db = require('../db');
const social = require('../economy/social');
const { embed, field, send, COLORS, resolveMember, userTag } = require('./helpers');
const { formatDateTime } = require('../money');

function roleNames(member) {
    if (!member || !member.roles || !member.roles.cache) return [];
    return [...member.roles.cache.values()]
        .filter(role => role && role.name && role.name !== '@everyone')
        .sort((a, b) => (Number(b.position) || 0) - (Number(a.position) || 0))
        .map(role => role.name);
}
function targetOf(ctx) {
    return ctx.args[0] ? resolveMember(ctx, ctx.args[0]) : Promise.resolve(ctx.member);
}
async function rep(ctx) {
    const target = await targetOf(ctx);
    if (!target) return send(ctx, { embeds: [embed('Member not found', 'Mention a member or provide a user id.', COLORS.warning)] });
    let score = 1;
    let reasonStart = 1;
    const marker = String(ctx.args[1] || '').toLowerCase();
    if (['-', 'negative', 'down', 'bad'].includes(marker)) {
        score = -1;
        reasonStart = 2;
    } else if (['+', 'positive', 'up', 'good'].includes(marker)) {
        score = 1;
        reasonStart = 2;
    }
    const reason = ctx.args.slice(reasonStart).join(' ').trim() || (score > 0 ? 'Positive standing' : 'Negative standing');
    const result = social.giveRep(ctx.guildId, ctx.userId, target.id, score, reason);
    const emb = embed('Reputation recorded', `${score > 0 ? 'Positive' : 'Negative'} standing recorded for **${userTag(target)}**.`, score > 0 ? COLORS.gold : COLORS.danger);
    field(emb, 'New score', String(result.summary.score), true);
    field(emb, 'Reason', result.reason, false);
    field(emb, 'Cooldown', `${social.REP_COOLDOWN_HOURS} hours per member`, true);
    await send(ctx, { embeds: [emb] });
}
async function reputation(ctx) {
    const target = await targetOf(ctx);
    if (!target) return send(ctx, { embeds: [embed('Member not found', 'Mention a member or provide a user id.', COLORS.warning)] });
    const data = social.summary(ctx.guildId, target.id);
    const emb = embed('Reputation', `Public standing for **${userTag(target)}**.`, data.score >= 0 ? COLORS.gold : COLORS.danger);
    field(emb, 'Score', String(data.score), true);
    field(emb, 'Positive', String(data.positive), true);
    field(emb, 'Negative', String(data.negative), true);
    field(emb, 'Messages observed', String(data.activity.messageCount), true);
    field(emb, 'Reactions received', String(data.activity.reactionsReceived), true);
    field(emb, 'Last seen', data.activity.lastMessageAt ? formatDateTime(data.activity.lastMessageAt) : 'no recorded message', true);
    field(emb, 'Recent notes', data.recent.length
        ? data.recent.map(item => `${item.score > 0 ? '+' : '-'} ${item.reason || 'no reason'} · <@${item.giver_id}>`).join('\n')
        : 'No reputation notes yet.', false);
    await send(ctx, { embeds: [emb] });
}
async function profile(ctx) {
    const target = await targetOf(ctx);
    if (!target) return send(ctx, { embeds: [embed('Member not found', 'Mention a member or provide a user id.', COLORS.warning)] });
    const data = social.summary(ctx.guildId, target.id);
    const roles = roleNames(target);
    const emb = embed('Member profile', `Server identity for **${userTag(target)}**.`, COLORS.gold);
    field(emb, 'Roles', roles.length ? roles.join(', ') : 'No roles', false);
    field(emb, 'Joined', target.joinedAt ? formatDateTime(target.joinedAt.toISOString()) : 'unknown', true);
    field(emb, 'Account created', target.user && target.user.createdAt ? formatDateTime(target.user.createdAt.toISOString()) : 'unknown', true);
    field(emb, 'Messages observed', String(data.activity.messageCount), true);
    field(emb, 'Reputation', String(data.score), true);
    field(emb, 'Last seen', data.activity.lastMessageAt ? formatDateTime(data.activity.lastMessageAt) : 'no recorded message', true);
    field(emb, 'Recent history', data.events.length
        ? data.events.map(event => `${event.kind.replace(/_/g, ' ')}${event.at ? ` · ${formatDateTime(event.at)}` : ''}`).join('\n')
        : 'No tracked join or role events yet.', false);
    await send(ctx, { embeds: [emb] });
}
async function topReputation(ctx) {
    const rows = social.leaderboard(ctx.guildId, Number(ctx.args[0]) || 10);
    const emb = embed('Reputation ranking', rows.length
        ? rows.map((row, index) => `**${index + 1}.** <@${row.target_id}> · ${row.score >= 0 ? '+' : ''}${row.score} · ${row.total} ratings`).join('\n')
        : 'No reputation has been recorded yet.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function activity(ctx) {
    const target = await targetOf(ctx);
    if (!target) return send(ctx, { embeds: [embed('Member not found', 'Mention a member or provide a user id.', COLORS.warning)] });
    const row = db.activityFor(ctx.guildId, target.id);
    const events = db.memberEvents(ctx.guildId, target.id, 12);
    const emb = embed('Member activity', `Observed server activity for **${userTag(target)}**.`, COLORS.gold);
    field(emb, 'Messages', String(row ? row.message_count : 0), true);
    field(emb, 'Reactions received', String(row ? row.reactions_received : 0), true);
    field(emb, 'First seen', row && row.first_seen_at ? formatDateTime(row.first_seen_at) : 'not recorded', true);
    field(emb, 'Last message', row && row.last_message_at ? formatDateTime(row.last_message_at) : 'not recorded', true);
    field(emb, 'Last channel', row && row.last_channel_id ? `<#${row.last_channel_id}>` : 'unknown', true);
    field(emb, 'Role history', events.length
        ? events.map(event => `${event.kind.replace(/_/g, ' ')} · ${formatDateTime(event.created_at)}`).join('\n')
        : 'No role or join events recorded by this bot yet.', false);
    await send(ctx, { embeds: [emb] });
}

module.exports = { rep, reputation, profile, topReputation, activity };
