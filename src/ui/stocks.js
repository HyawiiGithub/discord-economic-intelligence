'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const db = require('../db');
const market = require('../economy/market');
const securities = require('../economy/securities');
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
function renderStocks(guildId) {
    applyGuild(guildId);
    const guild = db.getGuild(guildId);
    if (!guild) throw new Error('guild not found');
    const view = securities.marketView(guildId);
    const state = cycle.status(guildId);
    const history = market.history(guildId, 24);
    const capSeries = history.length ? history.map(row => row.stock_market_cap_cents) : [view.totalMarketCap];
    const canvas = createCanvas(theme.width, 950);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, theme.width, 950);
    const glow = ctx.createRadialGradient(1120, 20, 10, 1120, 20, 680);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, theme.width, 520);
    drawOrnament(ctx, theme.width, 950);
    const margin = 56;
    text(ctx, theme.motif === 'empire' ? 'KAISERLICHE BÖRSE · 1914' : theme.motif === 'soviet' ? 'ГОСУДАРСТВЕННАЯ БИРЖА · СССР' : 'STOCK EXCHANGE', margin, 38, 10, theme.accent);
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
    const best = [...view.listed].sort((a, b) => b.change - a.change)[0];
    kpi(ctx, margin, 140, cardW, 108, 'Listed companies', String(view.listed.length), 'public equity', theme.text);
    kpi(ctx, margin + cardW + gap, 140, cardW, 108, 'Market capitalisation', formatCompact(view.totalMarketCap, guild.currency_code), 'last traded prices', theme.gold);
    kpi(ctx, margin + (cardW + gap) * 2, 140, cardW, 108, 'Top mover', best ? `${best.company.ticker} ${pct(best.change)}` : 'none', best ? best.company.name : 'no listed equity', best && best.change >= 0 ? theme.accent : theme.danger);
    kpi(ctx, margin + (cardW + gap) * 3, 140, cardW, 108, 'Cycle', String(state.tick), `every ${state.minutes} minutes`, theme.text);

    const tableY = 278;
    const tableH = 580;
    panel(ctx, margin, tableY, 900, tableH, 'Listed equities', 'Prices, daily change, market value and recorded price path');
    const headers = ['ISSUER', 'PRICE', 'CHANGE', 'MARKET CAP', 'PATH'];
    const cols = [margin + 24, margin + 410, margin + 570, margin + 700, margin + 748];
    headers.forEach((header, index) => text(ctx, header, cols[index], tableY + 68, 9, theme.faint, index === 0 || index === 4 ? 'left' : 'right'));
    let y = tableY + 92;
    if (!view.listed.length) {
        text(ctx, 'No public companies are listed yet.', margin + 24, y, 14, theme.muted);
    }
    for (const item of view.listed.slice(0, 9)) {
        text(ctx, `${item.company.ticker}  ${item.company.name}`, cols[0], y, 12, theme.text);
        text(ctx, formatMoney(item.quote.last, guild.currency_code), cols[1], y, 12, theme.text, 'right');
        text(ctx, pct(item.change), cols[2], y, 12, item.change >= 0 ? theme.accent : theme.danger, 'right');
        text(ctx, formatCompact(item.marketCap, guild.currency_code), cols[3], y, 12, theme.muted, 'right');
        const rows = securities.history(guildId, item.company.id, 18);
        if (rows.length > 1) sparkline(ctx, rows.map(row => row.price_cents), cols[4], y - 6, 120, 22, item.change >= 0 ? theme.accent : theme.danger);
        y += 48;
    }
    text(ctx, 'Stock prices are driven by company fundamentals and trade impact.', margin + 24, tableY + tableH - 28, 10, theme.faint);

    const sideX = margin + 900 + gap;
    const sideW = theme.width - margin - sideX;
    panel(ctx, sideX, tableY, sideW, 310, 'Market capitalisation', 'Listed equity value across completed cycles');
    lineChart(ctx, {
        x: sideX + 18,
        y: tableY + 54,
        w: sideW - 36,
        h: 230,
        data: capSeries.map((value, index) => ({ label: `C${index}`, value })),
        currency: guild.currency_code,
        color: theme.gold,
        primaryLabel: 'Market cap',
    });
    const moverY = tableY + 326;
    panel(ctx, sideX, moverY, sideW, tableH - 326, 'Movers', 'Largest recorded change');
    let my = moverY + 72;
    if (!view.movers.length) text(ctx, 'No listed companies yet.', sideX + 24, my, 13, theme.muted);
    for (const item of view.movers.slice(0, 6)) {
        text(ctx, item.company.ticker, sideX + 24, my, 12, theme.text);
        text(ctx, item.company.name, sideX + 90, my, 12, theme.muted);
        text(ctx, pct(item.change), sideX + sideW - 24, my, 12, item.change >= 0 ? theme.accent : theme.danger, 'right');
        my += 30;
    }
    text(ctx, 'Public equity · server-scoped order flow', margin, 924, 10, theme.faint);
    text(ctx, `${guild.currency_name} · ${guild.currency_code}`, theme.width - margin, 924, 10, theme.faint, 'right');
    return {
        buffer: canvas.toBuffer('image/png'),
        filename: `stocks-${String(guild.name || guildId).replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase() || guildId}.png`,
        view,
    };
}

module.exports = { renderStocks };
