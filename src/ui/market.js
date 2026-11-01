'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const db = require('../db');
const market = require('../economy/market');
const cycle = require('../economy/cycle');
const { theme, applyGuild, panel, text, fitText, fillRound, strokeRound } = require('./theme');
const { sparkline, meter } = require('./charts');
const { drawOrnament } = require('./ornaments');
const { formatMoney, formatCompact, formatPct, formatDateTime } = require('../money');

function renderMarket(guildId) {
    applyGuild(guildId);
    const guild = db.getGuild(guildId);
    const live = market.live(guildId);
    const state = cycle.status(guildId);
    const history = market.history(guildId, 24);
    const goods = [...live.goods].sort((a, b) => Number(b.stock) - Number(a.stock));
    const maxStock = Math.max(1, ...goods.map(good => Number(good.stock) || 0));
    const totalStockValue = goods.reduce((sum, good) => sum + Number(good.stock) * Number(good.price_cents), 0);
    const priceSeries = history.length ? history.map(s => s.price_index) : [live.priceIndex];
    const canvas = createCanvas(theme.width, 950);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, theme.width, 950);
    const glow = ctx.createRadialGradient(1180, 20, 10, 1180, 20, 650);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, theme.width, 520);
    drawOrnament(ctx, theme.width, 950);
    const margin = 56;
    text(ctx, theme.motif === 'empire' ? 'REICHSMARKT · 1914' : theme.motif === 'soviet' ? 'ГОСУДАРСТВЕННЫЙ РЫНОК · СССР' : 'GOODS MARKET', margin, 38, 10, theme.gold);
    fitText(ctx, guild.name || `Guild ${guildId}`, 760, 38, theme.text, margin, 60);
    const headerRight = theme.motif === 'default' ? theme.width - margin : theme.width - 180;
    text(ctx, `CYCLE ${state.tick}  ·  ${guild.currency_code}`, headerRight, 52, 11, theme.muted, 'right');
    text(ctx, `Next update ${state.due ? 'due now' : formatDateTime(state.nextAt)}`, headerRight, 74, 11, theme.faint, 'right');
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(margin, 118);
    ctx.lineTo(theme.width - margin, 118);
    ctx.stroke();

    const leftW = 900;
    const top = 140;
    panel(ctx, margin, top, leftW, 700, 'Traded output', 'Price, base change, available stock and current demand');
    const colName = margin + 24;
    const colPrice = margin + 430;
    const colChange = margin + 570;
    const barX = margin + 620;
    const barW = 185;
    const colStock = margin + 874;
    text(ctx, 'GOOD', colName, top + 78, 9, theme.faint);
    text(ctx, 'PRICE', colPrice, top + 78, 9, theme.faint, 'right');
    text(ctx, 'BASE CHANGE', colChange, top + 78, 9, theme.faint, 'right');
    text(ctx, 'STOCK', colStock, top + 78, 9, theme.faint, 'right');
    let y = top + 108;
    for (const good of goods) {
        const change = Number(good.change_bps) / 100;
        const stock = Number(good.stock) || 0;
        text(ctx, good.label, colName, y, 12, theme.text);
        text(ctx, formatMoney(good.price_cents, guild.currency_code), colPrice, y, 12, theme.text, 'right');
        text(ctx, formatPct(change), colChange, y, 11, change >= 0 ? theme.accent : theme.danger, 'right');
        ctx.fillStyle = 'rgba(255,255,255,0.055)';
        ctx.fillRect(barX, y + 4, barW, 6);
        ctx.fillStyle = stock > 0 ? theme.gold : 'rgba(255,255,255,0.08)';
        ctx.fillRect(barX, y + 4, barW * Math.min(1, stock / maxStock), 6);
        text(ctx, stock.toLocaleString('en-US'), colStock, y, 12, theme.muted, 'right');
        y += 54;
    }
    text(ctx, `Inventory value ${formatCompact(totalStockValue, guild.currency_code)} · ${goods.length} traded goods`, margin + 24, top + 672, 10, theme.faint);

    const sideX = margin + leftW + 18;
    const sideW = theme.width - margin - sideX;
    panel(ctx, sideX, top, sideW, 338, 'Consumer prices', 'Price index rebased to 100.00');
    const index = Number(live.priceIndex) / 100;
    const inflation = Number(live.inflationBps) / 100;
    text(ctx, index.toFixed(2), sideX + 24, top + 76, 38, theme.text);
    text(ctx, formatPct(inflation), sideX + 24, top + 124, 12, inflation >= 0 ? theme.warning : theme.blue);
    sparkline(ctx, priceSeries, sideX + 24, top + 160, sideW - 48, 118, theme.gold);
    const minIndex = Math.min(...priceSeries) / 100;
    const maxIndex = Math.max(...priceSeries) / 100;
    text(ctx, minIndex.toFixed(2), sideX + 24, top + 288, 10, theme.faint);
    text(ctx, maxIndex.toFixed(2), sideX + sideW - 24, top + 288, 10, theme.faint, 'right');
    text(ctx, 'Observed range over the last 24 cycles', sideX + 24, top + 306, 10, theme.faint);

    const bottomY = top + 356;
    const bottomH = 344;
    panel(ctx, sideX, bottomY, sideW, bottomH, 'Market pressure', 'Largest deviations from base price');
    const pressure = [...goods].sort((a, b) => Math.abs(Number(b.change_bps)) - Math.abs(Number(a.change_bps))).slice(0, 6);
    let py = bottomY + 82;
    for (const good of pressure) {
        const change = Number(good.change_bps) / 100;
        text(ctx, good.label, sideX + 24, py, 11, theme.text);
        text(ctx, formatPct(change), sideX + sideW - 24, py, 11, change >= 0 ? theme.accent : theme.danger, 'right');
        const ratio = Math.min(1, Math.abs(change) / 25);
        meter(ctx, sideX + 24, py + 22, sideW - 48, ratio, 1, change >= 0 ? theme.accent : theme.danger);
        py += 40;
    }
    text(ctx, `Demand ${goods.reduce((sum, good) => sum + Number(good.last_sales_volume || 0), 0).toLocaleString('en-US')} units in the last cycle`, sideX + 24, bottomY + bottomH - 30, 10, theme.faint);

    text(ctx, `${guild.currency_name} · stock is corporate inventory · change is measured from the base price`, margin, 890, 10, theme.faint);
    text(ctx, 'State ledger · server-scoped', theme.width - margin, 890, 10, theme.faint, 'right');
    return {
        buffer: canvas.toBuffer('image/png'),
        filename: `market-${String(guild.name || guildId).replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase() || guildId}.png`,
    };
}

module.exports = { renderMarket };
