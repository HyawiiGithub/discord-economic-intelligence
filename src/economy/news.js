'use strict';

const db = require('../db');
const jarvis = require('../jarvis');
const { nowIso } = require('../money');
const { GOODS, SECTORS } = require('../config');

const SIGNAL_KEYS = ['news', 'announcements'];
const POSITIVE = ['growth', 'boom', 'investment', 'subsidy', 'expansion', 'discovery', 'treaty', 'victory', 'demand', 'profit', 'harvest', 'innovation', 'deal', 'surplus', 'recovery', 'aid', 'agreement'];
const NEGATIVE = ['strike', 'shortage', 'crisis', 'embargo', 'war', 'sanction', 'default', 'fire', 'flood', 'collapse', 'layoff', 'famine', 'inflation', 'recession', 'closure', 'attack', 'corruption', 'scandal', 'delay'];
const KEYWORDS = {
    food: ['food', 'grain', 'harvest', 'farm', 'agriculture', 'famine', 'crop', 'livestock'],
    energy: ['energy', 'oil', 'gas', 'coal', 'power', 'electricity', 'fuel', 'grid', 'opec'],
    manufactured: ['steel', 'factory', 'manufactur', 'machine', 'industrial', 'metal', 'production'],
    logistics: ['rail', 'shipping', 'port', 'transport', 'road', 'freight', 'logistics', 'supply chain'],
    consumer: ['retail', 'consumer', 'shop', 'goods', 'trade', 'market', 'sales'],
    technology: ['tech', 'chip', 'software', 'research', 'innovation', 'automation', 'semiconductor'],
    financial: ['bank', 'credit', 'loan', 'bond', 'currency', 'finance', 'stock', 'market'],
    healthcare: ['health', 'hospital', 'medicine', 'pharma', 'care', 'disease'],
    construction: ['construction', 'housing', 'building', 'infrastructure', 'cement'],
    hospitality: ['tourism', 'hotel', 'restaurant', 'hospitality', 'travel'],
};
const SECTOR_GOOD = {
    agriculture: 'food',
    energy: 'energy',
    manufacturing: 'manufactured',
    logistics: 'logistics',
    retail: 'consumer',
    technology: 'technology',
    finance: 'financial',
    healthcare: 'healthcare',
    construction: 'construction',
    hospitality: 'hospitality',
};

function bind(guildId, key, channelId) {
    const signalKey = String(key || '').toLowerCase();
    if (!SIGNAL_KEYS.includes(signalKey)) throw new Error(`signal channel must be one of: ${SIGNAL_KEYS.join(', ')}`);
    const id = String(channelId || '').replace(/[<#>]/g, '').trim();
    if (!/^\d{5,25}$/.test(id)) throw new Error('invalid channel id');
    db.run(`INSERT INTO signal_channels (guild_id, signal_key, channel_id, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, signal_key) DO UPDATE SET channel_id = excluded.channel_id, updated_at = excluded.updated_at`,
        [String(guildId), signalKey, id, nowIso()]);
    db.audit(guildId, null, 'signal_channel_bind', { key: signalKey, channelId: id });
    return db.get('SELECT * FROM signal_channels WHERE guild_id = ? AND signal_key = ?', [String(guildId), signalKey]);
}
function unbind(guildId, key) {
    return Number(db.run('DELETE FROM signal_channels WHERE guild_id = ? AND signal_key = ?', [String(guildId), String(key).toLowerCase()]).changes) > 0;
}
function list(guildId) {
    return db.all('SELECT * FROM signal_channels WHERE guild_id = ? ORDER BY signal_key', [String(guildId)]);
}
function isSignalChannel(guildId, channelId) {
    return !!db.get('SELECT * FROM signal_channels WHERE guild_id = ? AND channel_id = ?', [String(guildId), String(channelId)]);
}
function storeMessage(guildId, channelId, message) {
    const result = db.run(`INSERT OR IGNORE INTO message_history
        (guild_id, channel_id, message_id, author_id, author_name, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [String(guildId), String(channelId), String(message.id), String(message.authorId), String(message.authorName || '').slice(0, 120), String(message.content || '').slice(0, 4000), message.createdAt || nowIso()]);
    return Number(result.changes) > 0;
}
async function backfillChannel(client, guildId, channelId, limit) {
    if (!client) return 0;
    const channel = client.channels.cache.get(String(channelId)) || await client.channels.fetch(String(channelId)).catch(() => null);
    if (!channel || !channel.messages) return 0;
    const messages = await channel.messages.fetch({ limit: Math.max(1, Math.min(100, Number(limit) || 100)) }).catch(() => null);
    if (!messages) return 0;
    let stored = 0;
    for (const message of messages.values()) {
        if (!message.author || message.author.bot) continue;
        const inserted = storeMessage(guildId, channelId, {
            id: message.id,
            authorId: message.author.id,
            authorName: message.member ? message.member.displayName : message.author.username,
            content: message.content,
            createdAt: message.createdAt ? message.createdAt.toISOString() : undefined,
        });
        if (inserted) stored += 1;
    }
    return stored;
}
async function backfillBound(client, guildId) {
    let stored = 0;
    for (const row of list(guildId)) {
        stored += await backfillChannel(client, guildId, row.channel_id, 100).catch(() => 0);
    }
    return stored;
}
async function ingest(guildId, channelId, message) {
    if (!storeMessage(guildId, channelId, message)) return null;
    if (!isSignalChannel(guildId, channelId) || !String(message.content || '').trim()) return null;
    const at = nowIso();
    const result = db.run(`INSERT OR IGNORE INTO news_signals
        (guild_id, channel_id, message_id, author_id, author_name, headline, content, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [String(guildId), String(channelId), String(message.id), String(message.authorId), String(message.authorName || '').slice(0, 120), String(message.content || '').split('\n')[0].slice(0, 180), String(message.content || '').slice(0, 4000), at]);
    const id = Number(result.lastInsertRowid);
    if (!id) return null;
    analyze(id).catch(error => {
        console.error('[news:analyze]', error.message);
    });
    return id;
}
function heuristic(content) {
    const text = String(content || '').toLowerCase();
    const positive = POSITIVE.filter(word => text.includes(word)).length;
    const negative = NEGATIVE.filter(word => text.includes(word)).length;
    const goods = [];
    for (const [good, words] of Object.entries(KEYWORDS)) {
        if (words.some(word => text.includes(word))) goods.push(good);
    }
    if (!goods.length) goods.push(...Object.keys(GOODS));
    const sectors = goods.map(good => Object.keys(SECTOR_GOOD).find(sector => SECTOR_GOOD[sector] === good)).filter(Boolean);
    if (/war|invasion|embargo|famine|default|collapse/.test(text)) {
        return { sentiment: 'negative', impactBps: -1200, goods, sectors, summary: 'Severe negative supply or confidence shock.' };
    }
    if (positive > negative) {
        return { sentiment: 'positive', impactBps: Math.min(900, 120 + positive * 110), goods, sectors, summary: 'Positive demand, supply or confidence signal.' };
    }
    if (negative > positive) {
        return { sentiment: 'negative', impactBps: -Math.min(900, 120 + negative * 110), goods, sectors, summary: 'Negative supply, cost or confidence signal.' };
    }
    return { sentiment: 'neutral', impactBps: 0, goods, sectors, summary: 'No directional economic signal detected.' };
}
function parseAnalysis(text) {
    const value = String(text || '').replace(/```json/gi, '```').replace(/```/g, '');
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
        const data = JSON.parse(value.slice(start, end + 1));
        const sentiment = ['positive', 'negative', 'neutral'].includes(String(data.sentiment)) ? String(data.sentiment) : 'neutral';
        const impactBps = Math.max(-1500, Math.min(1500, Math.trunc(Number(data.impactBps) || 0)));
        const goods = Array.isArray(data.goods) ? data.goods.filter(good => GOODS[good]).slice(0, 10) : [];
        const sectors = Array.isArray(data.sectors) ? data.sectors.filter(sector => SECTORS[sector]).slice(0, 10) : [];
        return { sentiment, impactBps, goods, sectors, summary: String(data.summary || '').slice(0, 240) };
    } catch {
        return null;
    }
}
async function analyze(id) {
    const signal = db.get('SELECT * FROM news_signals WHERE id = ?', [Number(id)]);
    if (!signal || signal.status !== 'pending') return;
    const fallback = heuristic(signal.content);
    let result = fallback;
    try {
        const modelText = await jarvis.complete([
            { role: 'system', content: 'You are a market-intelligence analyst. Return only valid JSON. Do not add markdown.' },
            { role: 'user', content: [
                'Classify this server announcement for economic market impact.',
                'Return JSON with exactly: sentiment (positive|negative|neutral), impactBps (-1500 to 1500), goods (array of goods keys), sectors (array of sector keys), summary (one sentence).',
                `Goods keys: ${Object.keys(GOODS).join(', ')}`,
                `Sectors: ${Object.keys(SECTORS).join(', ')}`,
                `Announcement: ${signal.content}`,
            ].join('\n') },
        ], { model: jarvis.modelName(), maxTokens: 500, temperature: 0.1, timeout: 60000 });
        const parsed = parseAnalysis(modelText);
        if (parsed) result = parsed;
    } catch (error) {
        db.audit(signal.guild_id, null, 'news_analysis_fallback', { signalId: signal.id, error: error.message });
    }
    if (!result.goods.length) result.goods = Object.keys(GOODS);
    if (!result.sectors.length) result.sectors = Object.keys(SECTORS);
    db.run(`UPDATE news_signals SET sentiment = ?, impact_bps = ?, goods = ?, sectors = ?, summary = ?, status = 'ready'
        WHERE id = ?`,
        [result.sentiment, result.impactBps, JSON.stringify(result.goods), JSON.stringify(result.sectors), result.summary, signal.id]);
    db.audit(signal.guild_id, null, 'news_analysis', { signalId: signal.id, sentiment: result.sentiment, impactBps: result.impactBps, goods: result.goods, sectors: result.sectors });
}
function runCycle(guildId) {
    const signals = db.all(`SELECT * FROM news_signals WHERE guild_id = ? AND status = 'ready' AND processed_at IS NULL ORDER BY id LIMIT 30`, [String(guildId)]);
    const goodsPressure = {};
    const sectorPressure = {};
    for (const signal of signals) {
        let goods = [];
        let sectors = [];
        try { goods = JSON.parse(signal.goods || '[]'); } catch {}
        try { sectors = JSON.parse(signal.sectors || '[]'); } catch {}
        for (const good of goods) goodsPressure[good] = (goodsPressure[good] || 0) + Number(signal.impact_bps);
        for (const sector of sectors) sectorPressure[sector] = (sectorPressure[sector] || 0) + Number(signal.impact_bps);
    }
    for (const good of Object.keys(GOODS)) {
        const pressure = Math.max(-1800, Math.min(1800, Math.round(goodsPressure[good] || 0)));
        db.run('UPDATE goods_market SET news_pressure_bps = ?, updated_at = ? WHERE guild_id = ? AND good_key = ?', [pressure, nowIso(), guildId, good]);
    }
    for (const [sector, pressure] of Object.entries(sectorPressure)) {
        db.run('UPDATE companies SET news_pressure_bps = ?, updated_at = ? WHERE guild_id = ? AND sector = ?', [Math.max(-1500, Math.min(1500, Math.round(pressure))), nowIso(), guildId, sector]);
    }
    if (signals.length) {
        db.run(`UPDATE news_signals SET status = 'processed', processed_at = ? WHERE id IN (${signals.map(() => '?').join(',')})`, [nowIso(), ...signals.map(signal => signal.id)]);
    }
    return signals;
}
function decay(guildId) {
    db.run('UPDATE goods_market SET news_pressure_bps = 0 WHERE guild_id = ?', [String(guildId)]);
    db.run('UPDATE companies SET news_pressure_bps = 0 WHERE guild_id = ?', [String(guildId)]);
}
function search(guildId, query, limit) {
    const term = String(query || '').trim();
    if (!term) return db.all('SELECT * FROM message_history WHERE guild_id = ? ORDER BY id DESC LIMIT ?', [String(guildId), Math.max(1, Math.min(50, Number(limit) || 20))]);
    return db.all(`SELECT * FROM message_history WHERE guild_id = ? AND lower(content) LIKE ? ORDER BY id DESC LIMIT ?`,
        [String(guildId), `%${term.toLowerCase()}%`, Math.max(1, Math.min(50, Number(limit) || 20))]);
}
function signals(guildId, limit) {
    return db.all('SELECT * FROM news_signals WHERE guild_id = ? ORDER BY id DESC LIMIT ?', [String(guildId), Math.max(1, Math.min(50, Number(limit) || 20))])
        .map(row => ({
            ...row,
            goods: (() => { try { return JSON.parse(row.goods || '[]'); } catch { return []; } })(),
            sectors: (() => { try { return JSON.parse(row.sectors || '[]'); } catch { return []; } })(),
        }));
}

module.exports = {
    SIGNAL_KEYS,
    bind,
    unbind,
    list,
    isSignalChannel,
    storeMessage,
    backfillChannel,
    backfillBound,
    ingest,
    analyze,
    runCycle,
    decay,
    search,
    signals,
    heuristic,
};
