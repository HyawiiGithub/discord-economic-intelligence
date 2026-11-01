'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const db = require('../db');
const { theme, applyGuild, panel, text, fitText, fillRound, strokeRound } = require('./theme');
const { drawOrnament } = require('./ornaments');
const { formatDateTime, nowIso } = require('../money');

function clean(value) {
    return String(value == null ? '' : value)
        .replace(/<@!?(\d{5,25})>/g, '@member')
        .replace(/<@&(\d{5,25})>/g, '@role')
        .replace(/<#(\d{5,25})>/g, '#channel')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/\u200b/g, '')
        .trim();
}
function wrap(ctx, value, maxWidth, size, maxLines) {
    const lines = [];
    const paragraphs = clean(value).split(/\n/);
    ctx.font = `${size}px ${theme.font}`;
    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
            lines.push('');
            continue;
        }
        const words = paragraph.split(/\s+/);
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (ctx.measureText(candidate).width <= maxWidth || !current) {
                current = candidate;
            } else {
                lines.push(current);
                current = word;
            }
        }
        if (current) lines.push(current);
    }
    if (maxLines && lines.length > maxLines) {
        const cut = lines.slice(0, maxLines);
        cut[cut.length - 1] = `${cut[cut.length - 1].slice(0, Math.max(0, cut[cut.length - 1].length - 1))}…`;
        return cut;
    }
    return lines;
}
function metricColumns(count) {
    if (count <= 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    return 4;
}
function drawEmpireOrnament(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = theme.borderStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(22, 22, width - 44, height - 44);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, width - 60, height - 60);
    const corners = [
        [22, 22, 1, 1],
        [width - 22, 22, -1, 1],
        [22, height - 22, 1, -1],
        [width - 22, height - 22, -1, -1],
    ];
    ctx.strokeStyle = theme.borderStrong;
    ctx.lineWidth = 2;
    for (const [x, y, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x + sx * 20, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * 20);
        ctx.stroke();
    }
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = theme.borderStrong;
    ctx.lineWidth = 0.8;
    for (let line = 0; line < 8; line += 1) {
        const base = height - 128 + line * 13;
        ctx.beginPath();
        for (let x = 38; x <= width - 38; x += 6) {
            const y = base + Math.sin(x / 82 + line * 0.7) * 4.2 + Math.sin(x / 23 + line) * 1.6;
            if (x === 38) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const sealX = width - 112;
    const sealY = 88;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 38, 0, Math.PI * 2);
    ctx.strokeStyle = theme.borderStrong;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sealX, sealY, 30, 0, Math.PI * 2);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, theme.seal || '1914', sealX, sealY - 6, 13, theme.accent, 'center', 'middle');
    text(ctx, 'REICH', sealX, sealY + 18, 8, theme.muted, 'center', 'middle');
    ctx.restore();
}
function drawReichsmarkOrnament(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = theme.borderStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, width - 48, height - 48);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.arc(width - 120, 92, 42 + i * 8, 0, Math.PI * 2);
        ctx.stroke();
    }
    text(ctx, theme.seal || 'RM', width - 120, 84, 18, theme.accent, 'center', 'middle');
    ctx.restore();
}
function drawBackground(ctx, width, height) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.72, -90, 10, width * 0.72, -90, 850);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, 560);
    drawOrnament(ctx, width, height);
}
function drawHeader(ctx, guild, data, width, height) {
    const margin = 58;
    text(ctx, (theme.label || 'SERVER LEDGER').toUpperCase(), margin, 46, 10, theme.accent);
    fitText(ctx, clean(data.title || 'Ledger'), 940, 38, theme.text, margin, 68);
    const meta = `${clean(guild.name || 'Server')}  ·  ${guild.currency_code || 'USD'}`;
    text(ctx, meta, width - 174, 50, 12, theme.muted, 'right');
    text(ctx, formatDateTime(nowIso()), width - 174, 72, 10, theme.faint, 'right');
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(margin, 142);
    ctx.lineTo(width - margin, 142);
    ctx.stroke();
    return 166;
}
function drawMetricRow(ctx, metrics, y, width) {
    const margin = 58;
    const gap = 16;
    const columns = metricColumns(metrics.length);
    const cardW = (width - margin * 2 - gap * (columns - 1)) / columns;
    const cardH = 112;
    metrics.forEach((metric, index) => {
        const x = margin + (cardW + gap) * index;
        fillRound(ctx, x, y, cardW, cardH, 15, theme.surface);
        strokeRound(ctx, x, y, cardW, cardH, 15, theme.border, 1);
        text(ctx, clean(metric.name).toUpperCase(), x + 20, y + 18, 9, theme.muted);
        const value = clean(metric.value);
        fitText(ctx, value, cardW - 40, value.length > 22 ? 16 : value.length > 17 ? 20 : 24, metric.color || theme.text, x + 20, y + 42);
        if (metric.detail) fitText(ctx, clean(metric.detail), cardW - 40, 10, theme.faint, x + 20, y + 80);
    });
    return y + cardH + 20;
}
function splitFields(fields) {
    const metrics = [];
    const rest = [];
    for (const item of fields) {
        const value = clean(item.value);
        const short = item.inline && value.length <= 34 && !value.includes('\n') && metrics.length < 4;
        if (short) metrics.push({ name: item.name, value });
        else rest.push(item);
    }
    return { metrics, rest };
}
function drawFieldBlocks(ctx, fields, x, y, width, height) {
    if (!fields.length) return;
    const columns = fields.length > 3 || fields.some(field => clean(field.value).length > 70) ? 2 : 1;
    const gap = 28;
    const colW = (width - gap * (columns - 1)) / columns;
    const half = Math.ceil(fields.length / (columns === 2 ? 2 : 1));
    const groups = columns === 2 ? [fields.slice(0, half), fields.slice(half)] : [fields];
    for (let col = 0; col < groups.length; col += 1) {
        let cursor = y;
        for (const field of groups[col]) {
            if (cursor > y + height - 30) break;
            const label = clean(field.name).toUpperCase();
            const lines = wrap(ctx, field.value, colW, 13, 9);
            const blockH = 20 + lines.length * 19 + 18;
            if (cursor + blockH > y + height) break;
            text(ctx, label, x + col * (colW + gap), cursor, 9, theme.accent);
            let lineY = cursor + 18;
            for (const line of lines) {
                text(ctx, line, x + col * (colW + gap), lineY, 13, theme.text);
                lineY += 19;
            }
            ctx.strokeStyle = theme.border;
            ctx.beginPath();
            ctx.moveTo(x + col * (colW + gap), lineY + 5);
            ctx.lineTo(x + col * (colW + gap) + colW, lineY + 5);
            ctx.stroke();
            cursor = lineY + 18;
        }
    }
}
function estimateFields(ctx, fields, width) {
    if (!fields.length) return 0;
    const columns = fields.length > 3 || fields.some(field => clean(field.value).length > 70) ? 2 : 1;
    const gap = 28;
    const colW = (width - gap * (columns - 1)) / columns;
    const half = Math.ceil(fields.length / (columns === 2 ? 2 : 1));
    const groups = columns === 2 ? [fields.slice(0, half), fields.slice(half)] : [fields];
    let tallest = 0;
    for (const group of groups) {
        let height = 0;
        for (const field of group) {
            const lines = wrap(ctx, field.value, colW, 13, 9);
            height += 20 + lines.length * 19 + 18;
        }
        tallest = Math.max(tallest, height);
    }
    return tallest;
}
function renderEmbed(guildId, data, options) {
    applyGuild(guildId);
    const guild = db.getGuild(guildId) || { name: 'Server', currency_code: 'USD' };
    const width = theme.width;
    const measureCanvas = createCanvas(width, 1000);
    const measure = measureCanvas.getContext('2d');
    const { metrics, rest } = splitFields(data.fields || []);
    const description = clean(data.description || '');
    const bodyY = metrics.length ? 298 : 166;
    const innerW = width - 116 - 48;
    const descriptionLines = description ? wrap(measure, description, innerW, 15, 20) : [];
    const descriptionH = descriptionLines.length * 25 + (rest.length ? 22 : 0);
    const fieldsH = estimateFields(measure, rest, innerW);
    const needed = 72 + descriptionH + fieldsH;
    const bodyH = Math.max(310, Math.min(670, needed + 40));
    const height = Math.max(700, Math.min(1000, bodyY + bodyH + 82));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    drawBackground(ctx, width, height);
    let cursor = drawHeader(ctx, guild, data, width, height);
    if (metrics.length) cursor = drawMetricRow(ctx, metrics, cursor, width);
    const margin = 58;
    const actualBodyH = height - bodyY - 82;
    panel(ctx, margin, bodyY, width - margin * 2, actualBodyH, clean(options && options.panelTitle ? options.panelTitle : 'Ledger detail'), theme.label || 'Server-scoped ledger');
    let innerY = bodyY + 72;
    const contentW = width - margin * 2 - 48;
    if (description) {
        const maxLines = rest.length ? Math.max(3, Math.floor((actualBodyH - 110) / 36)) : Math.max(4, Math.floor((actualBodyH - 92) / 23));
        const lines = wrap(ctx, description, contentW, rest.length ? 14 : 16, maxLines);
        for (const line of lines) {
            text(ctx, line, margin + 24, innerY, rest.length ? 14 : 16, theme.text);
            innerY += rest.length ? 24 : 26;
        }
        innerY += rest.length ? 12 : 0;
    }
    if (rest.length) {
        const remaining = bodyY + actualBodyH - innerY - 18;
        if (remaining > 30) drawFieldBlocks(ctx, rest, margin + 24, innerY, contentW, remaining);
    }
    if (!description && !rest.length) {
        text(ctx, 'No ledger entries to display.', margin + 24, innerY, 14, theme.muted);
    }
    const footerText = clean(data.footer && data.footer.text ? data.footer.text : (theme.label || 'Server-scoped ledger'));
    fitText(ctx, footerText, width - margin * 2, 10, theme.faint, margin, height - 46);
    text(ctx, `${guild.currency_code || 'USD'}  ·  ${guild.central_bank_name || 'State Bank'}`, width - margin, height - 46, 10, theme.faint, 'right');
    const slug = clean(data.title || 'ledger').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36) || 'ledger';
    return {
        buffer: canvas.toBuffer('image/png'),
        filename: `${slug}-${Date.now().toString(36)}.png`,
    };
}
function renderCard(guildId, spec) {
    const data = {
        title: spec.title,
        description: spec.description || '',
        fields: spec.fields || [],
        footer: { text: spec.footer || '' },
    };
    return renderEmbed(guildId, data, { panelTitle: spec.panelTitle });
}

module.exports = {
    renderEmbed,
    renderCard,
    clean,
};
