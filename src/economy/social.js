'use strict';

const db = require('../db');
const { nowIso } = require('../money');

const REP_COOLDOWN_HOURS = 12;

function summary(guildId, userId) {
    const row = db.get(`SELECT COALESCE(SUM(score), 0) AS score,
        COALESCE(SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END), 0) AS positive,
        COALESCE(SUM(CASE WHEN score < 0 THEN 1 ELSE 0 END), 0) AS negative,
        COUNT(*) AS total
        FROM reputation_events WHERE guild_id = ? AND target_id = ?`, [String(guildId), String(userId)]);
    const recent = db.all(`SELECT giver_id, score, reason, created_at FROM reputation_events
        WHERE guild_id = ? AND target_id = ? ORDER BY id DESC LIMIT 6`, [String(guildId), String(userId)]);
    const activity = db.activityFor(guildId, userId) || {
        message_count: 0,
        reactions_received: 0,
        first_seen_at: null,
        last_message_at: null,
        last_channel_id: null,
    };
    const events = db.memberEvents(guildId, userId, 10).map(event => {
        let detail = null;
        try { detail = event.detail ? JSON.parse(event.detail) : null; } catch {}
        return { kind: event.kind, detail, at: event.created_at };
    });
    return {
        score: Number(row && row.score) || 0,
        positive: Number(row && row.positive) || 0,
        negative: Number(row && row.negative) || 0,
        total: Number(row && row.total) || 0,
        recent: recent.map(item => ({ ...item, score: Number(item.score) || 0 })),
        activity: {
            messageCount: Number(activity.message_count) || 0,
            reactionsReceived: Number(activity.reactions_received) || 0,
            firstSeenAt: activity.first_seen_at,
            lastMessageAt: activity.last_message_at,
            lastChannelId: activity.last_channel_id,
        },
        events,
    };
}
function giveRep(guildId, giverId, targetId, scoreRef, reason) {
    if (String(giverId) === String(targetId)) throw new Error('you cannot give reputation to yourself');
    const score = Number(scoreRef) < 0 ? -1 : 1;
    const last = db.get(`SELECT created_at FROM reputation_events
        WHERE guild_id = ? AND giver_id = ? AND target_id = ? ORDER BY id DESC LIMIT 1`,
        [String(guildId), String(giverId), String(targetId)]);
    if (last && Date.now() - new Date(last.created_at).getTime() < REP_COOLDOWN_HOURS * 3600000) {
        const next = new Date(new Date(last.created_at).getTime() + REP_COOLDOWN_HOURS * 3600000).toISOString();
        throw new Error(`you already rated this member recently; next rating available ${next}`);
    }
    const text = String(reason || '').trim().slice(0, 240);
    db.run('INSERT INTO reputation_events (guild_id, giver_id, target_id, score, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [String(guildId), String(giverId), String(targetId), score, text, nowIso()]);
    db.audit(guildId, giverId, 'reputation', { targetId: String(targetId), score, reason: text });
    return { score, reason: text, summary: summary(guildId, targetId) };
}
function leaderboard(guildId, limit) {
    return db.all(`SELECT target_id, COALESCE(SUM(score), 0) AS score,
        COALESCE(SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END), 0) AS positive,
        COALESCE(SUM(CASE WHEN score < 0 THEN 1 ELSE 0 END), 0) AS negative,
        COUNT(*) AS total
        FROM reputation_events WHERE guild_id = ?
        GROUP BY target_id ORDER BY score DESC, total DESC LIMIT ?`,
        [String(guildId), Math.max(1, Math.min(25, Number(limit) || 10))])
        .map(row => ({ ...row, score: Number(row.score) || 0, positive: Number(row.positive) || 0, negative: Number(row.negative) || 0, total: Number(row.total) || 0 }));
}
function react(guildId, userId, delta) {
    db.run(`INSERT INTO member_activity (guild_id, user_id, display_name, message_count, reactions_received, first_seen_at)
        VALUES (?, ?, '', 0, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET reactions_received = reactions_received + excluded.reactions_received`,
        [String(guildId), String(userId), Number(delta) || 0, nowIso()]);
}

module.exports = {
    REP_COOLDOWN_HOURS,
    summary,
    giveRep,
    leaderboard,
    react,
};
