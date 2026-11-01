'use strict';

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { toMinor, formatMoney, formatBps, formatCompact } = require('../money');
const style = require('../style');
const cards = require('../ui/cards');

const COLORS = {
    accent: 0x4ade80,
    danger: 0xfb7185,
    gold: 0xe8c16a,
    warning: 0xfbbf24,
    blue: 0x7dd3fc,
    surface: 0x111822,
    muted: 0x8b97a8,
};
function embed(title, description, color) {
    return new EmbedBuilder()
        .setColor(color == null ? COLORS.accent : color)
        .setTitle(title)
        .setDescription(description || null);
}
function field(target, name, value, inline) {
    return target.addFields({ name, value: String(value), inline: !!inline });
}
function tokenize(text) {
    const out = [];
    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match;
    while ((match = regex.exec(String(text || '')))) {
        out.push(match[1] != null ? match[1] : match[2] != null ? match[2] : match[3]);
    }
    return out;
}
function parseAmount(value) {
    return toMinor(value, false);
}
function parseUserId(value) {
    const text = String(value || '');
    const mention = text.match(/^<@!?(\d{5,25})>$/);
    if (mention) return mention[1];
    const id = text.replace(/[<@!>]/g, '').trim();
    return /^\d{5,25}$/.test(id) ? id : null;
}
function guildOf(ctx) {
    return ctx.guild;
}
function fmt(ctx, minor) {
    return formatMoney(minor, ctx.guildRow.currency_code);
}
function pct(ctx, bps) {
    return formatBps(bps);
}
function compact(ctx, minor) {
    return formatCompact(minor, ctx.guildRow.currency_code);
}
function applyStyle(guildId, payload) {
    const theme = style.forGuild(guildId);
    if (!theme || !payload || !Array.isArray(payload.embeds)) return payload;
    for (const emb of payload.embeds) {
        if (!emb) continue;
        if (typeof emb.setColor === 'function' && typeof emb.setFooter === 'function') {
            const previous = emb.data && emb.data.footer && emb.data.footer.text;
            emb.setColor(theme.color);
            emb.setFooter({ text: previous ? `${theme.footer} · ${previous}` : theme.footer });
        } else {
            emb.color = theme.color;
            emb.footer = { text: theme.footer };
        }
    }
    return payload;
}
function attachCard(ctx, payload) {
    if (!payload || payload.noCard || payload.files || !Array.isArray(payload.embeds) || payload.embeds.length !== 1) return;
    const embed = payload.embeds[0];
    if (!embed) return;
    const data = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;
    if (!data || !data.title) return;
    try {
        const image = cards.renderEmbed(ctx.guildId, data);
        payload.files = [new AttachmentBuilder(image.buffer, { name: image.filename })];
        if (typeof embed.setImage === 'function') embed.setImage(`attachment://${image.filename}`);
    } catch (error) {
        console.error('[ui:card]', error.message);
    }
}
async function send(ctx, payload) {
    if (!payload || (!payload.content && !payload.embeds && !payload.files)) return;
    applyStyle(ctx.guildId, payload);
    const noCard = payload.noCard;
    if (!noCard) attachCard(ctx, payload);
    delete payload.noCard;
    if (ctx.interaction) {
        if (ctx.interaction.deferred || ctx.interaction.replied) return ctx.interaction.editReply(payload);
        return ctx.interaction.reply(payload);
    }
    return ctx.message.reply(payload);
}
function error(ctx, message) {
    return send(ctx, { embeds: [embed('Unable to complete', message, COLORS.danger)] });
}
async function decorate(ctx) {
    ctx.guildRow = ctx.guildRow || ctx.db.getGuild(ctx.guildId);
    return ctx;
}
async function resolveMember(ctx, value) {
    const id = parseUserId(value);
    if (id) {
        const cached = ctx.guild.members.cache.get(id);
        if (cached) return cached;
        try { return await ctx.guild.members.fetch(id); } catch { return null; }
    }
    if (ctx.message && ctx.message.mentions && ctx.message.mentions.members) {
        return ctx.message.mentions.members.first() || null;
    }
    return null;
}
function userTag(member) {
    if (!member) return 'unknown member';
    return member.displayName || (member.user && member.user.username) || String(member.id);
}
function splitList(value, max) {
    return String(value || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean).slice(0, max || 20);
}
function requireGuild(ctx) {
    if (!ctx.guild) throw new Error('this command only works in a server');
}

module.exports = {
    COLORS,
    embed,
    field,
    tokenize,
    parseAmount,
    parseUserId,
    guildOf,
    fmt,
    pct,
    compact,
    send,
    error,
    decorate,
    resolveMember,
    userTag,
    splitList,
    requireGuild,
};
