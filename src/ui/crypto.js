'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const db = require('../db');
const cryptoMarket = require('../economy/crypto');
const cycle = require('../economy/cycle');
const { theme, applyGuild, panel, text, fitText, fillRound, strokeRound } = require('./theme');
const { lineChart, sparkline } = require('./charts');
const { drawOrnament } = require('./ornaments');
const { formatMoney, formatCompact, formatDateTime } = require('../money');

function pct(value) {
    const n = Number(value) || 0;
    return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function kpi(ctx, x, y, w, h, label, value, detail, color) {
    fillRound(ctx, x, y, w, h, 15, theme.surface);
    strokeRound(ctx, x, y, w, h, 15, theme.border, 1);
    text(ctx, label.toUpperCase(), x + 20, y + 18, 9, theme.muted);
    fitText(ctx, value, w - 40, 24, color || theme.text, x + 20, y + 42);
    if (detail) fitText(ctx, detail, w - 40, 10, theme.faint, x + 20, y + 80);
}
function renderCrypto(guildId) {
    applyGuild(guildId);
    const guild = db.getGuild(guildId);
    if (!guild) throw new Error('guild not found');
    const assets = cryptoMarket.list(guildId);
    const state = cycle.status(guildId);
    const totalCap = assets.reduce((sum, asset) => sum + Number(asset.marketCap || 0), 0);
    const liquid = assets.reduce((sum, asset) => sum + Number(asset.reserve_cents || 0), 0);
    const top = assets[0];
    const topHistory = top ? top.history : [];
    const canvas = createCanvas(theme.width, 950);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, theme.width, 950);
    const glow = ctx.createRadialGradient(1160, 20, 10, 1160, 20, 680);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, theme.width, 520);
    drawOrnament(ctx, theme.width, 950);
    const margin = 56;
    text(ctx, theme.motif === 'empire' ? 'KAISERLICHE KRYPTOBÖRSE · 1914' : theme.motif === 'soviet' ? 'КРИПТОРЫНОК · СССР' : 'CRYPTO MARKET', margin, 38, 10, theme.accent);
    fitText(ctx, guild.name || `Guild ${guildId}`, 760, 38, theme.text, margin, 60);
    const headerRight = theme.motif === 'default' ? theme.width - margin : theme.width - 180;
    text(ctx, `CYCLE ${state.tick}  ·  ${guild.currency_code}`, headerRight, 52, 11, theme.muted, 'right');
    text(ctx, `Next update ${state.due ? 'due now' : formatDateTime(state.nextAt)}`, headerRight, 74, 11, theme.faint, 'right');
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(margin, 118);
    ctx.lineTo(theme.width - margin, 118);
    ctx.stroke();

    const gap = 16;
    const cardW = (theme.width - margin * 2 - gap * 3) / 4;
    const best = [...assets].sort((a, b) => b.change - a.change)[0];
    kpi(ctx, margin, 140, cardW, 108, 'Assets', String(assets.length), 'coins and memecoins', theme.text);
    kpi(ctx, margin + cardW + gap, 140, cardW, 108, 'Market value', formatCompact(totalCap, guild.currency_code), 'circulating supply at last price', theme.gold);
    kpi(ctx, margin + (cardW + gap) * 2, 140, cardW, 108, 'Pool liquidity', formatCompact(liquid, guild.currency_code), 'available for redemptions', theme.blue);
    kpi(ctx, margin + (cardW + gap) * 3, 140, cardW, 108, 'Best performer', best ? `${best.symbol} ${pct(best.change)}` : 'none', best ? best.name : 'no assets listed', best && best.change >= 0 ? theme.accent : theme.danger);

    const tableY = 278;
    const tableH = 580;
    panel(ctx, margin, tableY, 900, tableH, 'Digital assets', 'Local clearing tokens, memecoins and liquidity pools');
    const headers = ['ASSET', 'PRICE', 'CHANGE', 'MARKET VALUE', 'PATH'];
    const cols = [margin + 24, margin + 410, margin + 570, margin + 700, margin + 748];
    headers.forEach((header, index) => text(ctx, header, cols[index], tableY + 68, 9, theme.faint, index === 0 || index === 4 ? 'left' : 'right'));
    let y = tableY + 92;
    if (!assets.length) text(ctx, 'No digital assets are listed yet.', margin + 24, y, 14, theme.muted);
    for (const asset of assets.slice(0, 9)) {
        text(ctx, `${asset.symbol}  ${asset.name}`, cols[0], y, 12, theme.text);
        text(ctx, formatMoney(asset.price_cents, guild.currency_code, { decimals: Number(asset.price_cents) < 100 ? 4 : 2 }), cols[1], y, 12, theme.text, 'right');
        text(ctx, pct(asset.change), cols[2], y, 12, asset.change >= 0 ? theme.accent : theme.danger, 'right');
        text(ctx, formatCompact(asset.marketCap, guild.currency_code), cols[3], y, 12, theme.muted, 'right');
        if (asset.history.length > 1) sparkline(ctx, asset.history.map(row => row.price_cents), cols[4], y - 6, 120, 22, asset.change >= 0 ? theme.accent : theme.danger);
        y += 48;
    }
    text(ctx, 'Memecoins are volatile by design. Fees accrue to the treasury.', margin + 24, tableY + tableH - 28, 10, theme.faint);

    const sideX = margin + 900 + gap;
    const sideW = theme.width - margin - sideX;
    panel(ctx, sideX, tableY, sideW, 310, 'Price history', top ? `${top.symbol} · ${top.name}` : 'No asset');
    if (topHistory.length > 1) {
        lineChart(ctx, {
            x: sideX + 18,
            y: tableY + 54,
            w: sideW - 36,
            h: 230,
            data: topHistory.map((row, index) => ({ label: `C${index}`, value: row.price_cents })),
            currency: guild.currency_code,
            color: theme.accent,
            primaryLabel: 'Price',
        });
    } else {
        text(ctx, 'The first price observation is recorded.', sideX + 24, tableY + 112, 13, theme.muted);
    }
    const deskY = tableY + 326;
    panel(ctx, sideX, deskY, sideW, tableH - 326, 'Meme desk', 'Volatility and liquidity by asset');
    let my = deskY + 72;
    for (const asset of [...assets].sort((a, b) => Number(b.volatility_bps) - Number(a.volatility_bps)).slice(0, 6)) {
        text(ctx, asset.symbol, sideX + 24, my, 12, theme.text);
        text(ctx, asset.kind, sideX + 90, my, 12, theme.muted);
        text(ctx, `${(Number(asset.volatility_bps) / 100).toFixed(2)}% vol`, sideX + sideW - 24, my, 12, Number(asset.volatility_bps) > 2000 ? theme.danger : theme.warning, 'right');
        my += 30;
    }
    text(ctx, 'Digital assets · server-scoped clearing layer', margin, 924, 10, theme.faint);
    text(ctx, `${guild.currency_name} · ${guild.currency_code}`, theme.width - margin, 924, 10, theme.faint, 'right');
    return {
        buffer: canvas.toBuffer('image/png'),
        filename: `crypto-${String(guild.name || guildId).replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase() || guildId}.png`,
        assets,
    };
}

module.exports = { renderCrypto };
