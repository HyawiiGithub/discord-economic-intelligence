'use strict';

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./db');
const style = require('./style');
const community = require('./economy/community');
const cryptoMarket = require('./economy/crypto');
const { renderOverview } = require('./ui/overview');
const { renderMarket } = require('./ui/market');
const { renderStocks } = require('./ui/stocks');
const { renderCrypto } = require('./ui/crypto');
const cards = require('./ui/cards');
const { formatMoney, formatDateTime, nowIso } = require('./money');

const FEEDS = {
    overview: { label: 'Economic overview', description: 'Macro dashboard' },
    market: { label: 'Goods market', description: 'Prices, stock and demand' },
    stocks: { label: 'Stock exchange', description: 'Listed equity and price path' },
    crypto: { label: 'Crypto market', description: 'Coins, memecoins and liquidity' },
    lottery: { label: 'Lottery', description: 'Jackpot and next draw' },
    report: { label: 'Economy report', description: 'Output, prices and fiscal position' },
    audit: { label: 'Audit trail', description: 'Recent administrative actions' },
};
const KEYS = Object.keys(FEEDS);

function normalizeKey(key) {
    const value = String(key || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const aliases = {
        economy: 'overview',
        macro: 'overview',
        goods: 'market',
        prices: 'market',
        stock: 'stocks',
        stockmarket: 'stocks',
        equity: 'stocks',
        equities: 'stocks',
        coin: 'crypto',
        coins: 'crypto',
        memes: 'crypto',
        memecoins: 'crypto',
        lotteryfeed: 'lottery',
        economyreport: 'report',
        logs: 'audit',
    };
    const normalized = aliases[value] || value;
    return FEEDS[normalized] ? normalized : null;
}
function bind(guildId, key, channelId) {
    const feedKey = normalizeKey(key);
    if (!feedKey) throw new Error(`unknown feed; use ${KEYS.join(', ')}`);
    const id = String(channelId || '').replace(/[<#>]/g, '').trim();
    if (!/^\d{5,25}$/.test(id)) throw new Error('invalid channel id');
    db.run(`INSERT INTO channel_bindings (guild_id, feed_key, channel_id, message_id, updated_at)
        VALUES (?, ?, ?, NULL, ?)
        ON CONFLICT(guild_id, feed_key) DO UPDATE SET channel_id = excluded.channel_id, message_id = NULL, updated_at = excluded.updated_at`,
        [String(guildId), feedKey, id, nowIso()]);
    db.audit(guildId, null, 'feed_bind', { feed: feedKey, channelId: id });
    return get(guildId, feedKey);
}
function unbind(guildId, key) {
    const feedKey = normalizeKey(key);
    if (!feedKey) throw new Error('unknown feed');
    const result = db.run('DELETE FROM channel_bindings WHERE guild_id = ? AND feed_key = ?', [String(guildId), feedKey]);
    db.audit(guildId, null, 'feed_unbind', { feed: feedKey });
    return Number(result.changes) > 0;
}
function get(guildId, key) {
    return db.get('SELECT * FROM channel_bindings WHERE guild_id = ? AND feed_key = ?', [String(guildId), String(key)]);
}
function list(guildId) {
    return db.all('SELECT * FROM channel_bindings WHERE guild_id = ? ORDER BY feed_key', [String(guildId)]);
}
function clean(value) {
    return String(value == null ? '' : value);
}
function baseEmbed(guildId, title, description) {
    const selected = style.forGuild(guildId);
    return new EmbedBuilder()
        .setColor(selected ? selected.color : 0x4ade80)
        .setTitle(title)
        .setDescription(description || null)
        .setFooter({ text: selected ? selected.footer : 'Server-scoped ledger' })
        .setTimestamp(new Date());
}
function cardFeed(guildId, title, data) {
    const image = cards.renderEmbed(guildId, data);
    const emb = baseEmbed(guildId, title, data.description || null).setImage(`attachment://${image.filename}`);
    return { embeds: [emb], files: [new AttachmentBuilder(image.buffer, { name: image.filename })] };
}
function reportData(guildId) {
    const report = community.report(guildId);
    const latest = report.live.snapshot;
    return {
        title: 'Economy report',
        description: `Economic position for **${report.guild.name}**.`,
        fields: [
            { name: 'Output', value: formatMoney(latest ? latest.gdp_cents : 0, report.guild.currency_code), inline: true },
            { name: 'Inflation', value: `${(Number(report.live.inflationBps) / 100).toFixed(2)}%`, inline: true },
            { name: 'Unemployment', value: `${(Number(report.live.unemploymentBps) / 100).toFixed(2)}%`, inline: true },
            { name: 'Price index', value: (Number(report.live.priceIndex) / 100).toFixed(2), inline: true },
            { name: 'Treasury', value: formatMoney(report.gov.balance, report.guild.currency_code), inline: true },
            { name: 'Money supply', value: formatMoney(report.moneySupply, report.guild.currency_code), inline: true },
            { name: 'Companies', value: String(report.companies), inline: true },
            { name: 'Market capitalisation', value: formatMoney(report.stocks.totalMarketCap || 0, report.guild.currency_code), inline: true },
            { name: 'Bank status', value: report.bank.status || 'unknown', inline: true },
        ],
    };
}
function lotteryData(guildId) {
    const view = community.lotteryStatus(guildId);
    return {
        title: 'Imperial lottery',
        description: 'The next draw is conducted by the Reichsbank.',
        fields: [
            { name: 'Jackpot', value: formatMoney(view.jackpot, db.getGuild(guildId).currency_code), inline: true },
            { name: 'Ticket', value: formatMoney(view.ticketPrice, db.getGuild(guildId).currency_code), inline: true },
            { name: 'Tickets sold', value: String(view.tickets), inline: true },
            { name: 'Participants', value: String(view.holders), inline: true },
            { name: 'Draw', value: formatDateTime(view.drawAt), inline: false },
        ],
    };
}
function auditData(guildId) {
    const rows = db.recentAudit(guildId, 14);
    return {
        title: 'Audit trail',
        description: rows.length ? 'Recent administrative actions.' : 'No audit entries.',
        fields: rows.slice(0, 10).map(row => ({
            name: `${row.action} · ${row.created_at ? row.created_at.slice(11, 19) : ''}`,
            value: `${row.actor_id || 'system'}${row.detail ? ` · ${String(row.detail).slice(0, 160)}` : ''}`,
            inline: false,
        })),
    };
}
function payloadFor(guildId, key) {
    const guild = db.getGuild(guildId);
    if (!guild) throw new Error('guild not found');
    if (key === 'overview') {
        const out = renderOverview(guildId);
        const emb = baseEmbed(guildId, 'Economic overview', `**${guild.name}** · cycle **${Number(guild.last_cycle_tick) || 0}** · ${guild.currency_name}`)
            .setImage(`attachment://${out.filename}`);
        return { embeds: [emb], files: [new AttachmentBuilder(out.buffer, { name: out.filename })] };
    }
    if (key === 'market') {
        const out = renderMarket(guildId);
        const emb = baseEmbed(guildId, 'Goods market', 'Prices adjust to stock and recorded demand.')
            .setImage(`attachment://${out.filename}`);
        return { embeds: [emb], files: [new AttachmentBuilder(out.buffer, { name: out.filename })] };
    }
    if (key === 'stocks') {
        const out = renderStocks(guildId);
        const emb = baseEmbed(guildId, 'Stock exchange', 'Listed equity and recorded price path.')
            .setImage(`attachment://${out.filename}`);
        return { embeds: [emb], files: [new AttachmentBuilder(out.buffer, { name: out.filename })] };
    }
    if (key === 'crypto') {
        cryptoMarket.ensure(guildId);
        const out = renderCrypto(guildId);
        const emb = baseEmbed(guildId, 'Crypto market', 'Coins, memecoins and local liquidity pools.')
            .setImage(`attachment://${out.filename}`);
        return { embeds: [emb], files: [new AttachmentBuilder(out.buffer, { name: out.filename })] };
    }
    if (key === 'lottery') return cardFeed(guildId, 'Imperial lottery', lotteryData(guildId));
    if (key === 'report') return cardFeed(guildId, 'Economy report', reportData(guildId));
    if (key === 'audit') return cardFeed(guildId, 'Audit trail', auditData(guildId));
    throw new Error('unknown feed');
}
async function publish(client, guildId, key) {
    const binding = get(guildId, key);
    if (!binding) return null;
    const channel = client.channels.cache.get(binding.channel_id) || await client.channels.fetch(binding.channel_id).catch(() => null);
    if (!channel || typeof channel.send !== 'function') return null;
    const payload = payloadFor(guildId, key);
    if (binding.message_id) {
        const message = await channel.messages.fetch(binding.message_id).catch(() => null);
        if (message) {
            try {
                await message.edit(payload);
                return message;
            } catch (error) {
                console.error(`[feed:${key}:${guildId}] edit failed: ${error.message}`);
            }
        }
    }
    try {
        const message = await channel.send(payload);
        db.run('UPDATE channel_bindings SET message_id = ?, updated_at = ? WHERE guild_id = ? AND feed_key = ?',
            [String(message.id), nowIso(), String(guildId), String(key)]);
        return message;
    } catch (error) {
        console.error(`[feed:${key}:${guildId}]`, error.message);
        return null;
    }
}
async function updateGuild(client, guildId, keys) {
    const selected = keys && keys.length ? keys : KEYS;
    const results = [];
    for (const key of selected) {
        const binding = get(guildId, key);
        if (!binding) continue;
        const message = await publish(client, guildId, key);
        if (message) results.push({ key, messageId: message.id });
    }
    return results;
}
async function updateAll(client) {
    const rows = db.all('SELECT DISTINCT guild_id, feed_key FROM channel_bindings');
    const results = [];
    for (const row of rows) {
        const message = await publish(client, row.guild_id, row.feed_key);
        if (message) results.push({ guildId: row.guild_id, key: row.feed_key, messageId: message.id });
    }
    return results;
}

module.exports = {
    FEEDS,
    KEYS,
    normalizeKey,
    bind,
    unbind,
    get,
    list,
    payloadFor,
    publish,
    updateGuild,
    updateAll,
};
