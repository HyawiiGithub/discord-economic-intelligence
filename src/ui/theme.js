'use strict';

const path = require('node:path');
const { GlobalFonts } = require('@napi-rs/canvas');
const style = require('../style');

const FONT_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Aldrich-Regular.ttf');
const CYRILLIC_FONT_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');
try { GlobalFonts.registerFromPath(FONT_PATH, 'Aldrich'); } catch {}
try { GlobalFonts.registerFromPath(CYRILLIC_FONT_PATH, 'Noto Sans'); } catch {}

const BASE_THEME = {
    width: 1500,
    height: 1000,
    background: '#070a0e',
    surface: '#0d1219',
    surfaceAlt: '#111822',
    border: 'rgba(255,255,255,0.075)',
    borderStrong: 'rgba(255,255,255,0.14)',
    text: '#f5f7fa',
    muted: '#8b97a8',
    faint: '#566173',
    accent: '#4ade80',
    accentSoft: 'rgba(74,222,128,0.13)',
    gold: '#e8c16a',
    danger: '#fb7185',
    warning: '#fbbf24',
    blue: '#7dd3fc',
    glow: 'rgba(74,222,128,0.08)',
    motif: 'default',
    seal: '',
    label: '',
    font: 'Aldrich',
};
const theme = { ...BASE_THEME };

function applyGuild(guildId, guildRow) {
    Object.assign(theme, BASE_THEME);
    const guildStyle = style.forGuild(guildId, guildRow);
    if (!guildStyle) return theme;
    if (guildStyle.theme) Object.assign(theme, guildStyle.theme);
    theme.label = guildStyle.label;
    return theme;
}

function font(size, weight) {
    return `${weight || 400} ${size}px ${theme.font}`;
}
function colorForChange(value) {
    const n = Number(value) || 0;
    return n > 0 ? theme.accent : n < 0 ? theme.danger : theme.muted;
}
function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}
function fillRound(ctx, x, y, w, h, r, fill) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
}
function strokeRound(ctx, x, y, w, h, r, stroke, width) {
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width || 1;
    ctx.stroke();
}
function panel(ctx, x, y, w, h, title, subtitle) {
    fillRound(ctx, x, y, w, h, 18, theme.surface);
    strokeRound(ctx, x, y, w, h, 18, theme.border, 1);
    if (title) {
        ctx.fillStyle = theme.text;
        ctx.font = font(17);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(title, x + 24, y + 22);
    }
    if (subtitle) {
        ctx.fillStyle = theme.muted;
        ctx.font = font(12);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(subtitle, x + 24, y + 46);
    }
}
function text(ctx, value, x, y, size, color, align, baseline) {
    ctx.fillStyle = color || theme.text;
    ctx.font = font(size || 14);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'top';
    ctx.fillText(String(value), x, y);
}
function fitText(ctx, value, maxWidth, size, color, x, y, align) {
    let label = String(value);
    ctx.font = font(size);
    while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
        label = `${label.slice(0, -2)}…`;
    }
    text(ctx, label, x, y, size, color, align || 'left');
}
function pill(ctx, label, x, y, color) {
    ctx.font = font(11);
    const w = ctx.measureText(label).width + 22;
    const h = 26;
    fillRound(ctx, x, y, w, h, 13, color === theme.danger ? 'rgba(251,113,133,0.12)' : theme.accentSoft);
    text(ctx, label, x + 11, y + 7, 11, color || theme.accent);
    return w;
}
function disclaimer(ctx, value) {
    text(ctx, value, theme.width - 64, theme.height - 34, 10, theme.faint, 'right');
}

module.exports = {
    theme,
    applyGuild,
    font,
    colorForChange,
    roundRect,
    fillRound,
    strokeRound,
    panel,
    text,
    fitText,
    pill,
    disclaimer,
};
