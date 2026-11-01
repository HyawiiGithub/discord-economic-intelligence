'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const db = require('../db');
const market = require('../economy/market');
const government = require('../economy/government');
const securities = require('../economy/securities');
const cycle = require('../economy/cycle');
const { theme, applyGuild, panel, text, fitText, pill, fillRound, strokeRound } = require('./theme');
const { lineChart, sparkline, meter } = require('./charts');
const { drawOrnament } = require('./ornaments');
const { formatMoney, formatCompact, formatBps, formatDate, formatDateTime } = require('../money');

function change(value, places) {
    const n = Number(value) || 0;
    return `${n > 0 ? '+' : ''}${n.toFixed(places == null ? 2 : places)}%`;
}
function kpiCard(ctx, x, y, w, h, label, value, delta, deltaColor, spark, sparkColor) {
    fillRound(ctx, x, y, w, h, 16, theme.surface);
    strokeRound(ctx, x, y, w, h, 16, theme.border, 1);
    text(ctx, label.toUpperCase(), x + 22, y + 20, 10, theme.muted);
    text(ctx, value, x + 22, y + 48, 29, theme.text);
    if (delta) text(ctx, delta, x + 22, y + 94, 12, deltaColor || theme.muted);
    if (spark && spark.length > 1) sparkline(ctx, spark, x + w - 112, y + 66, 88, 34, sparkColor || theme.accent);
}
function renderOverview(guildId) {
    applyGuild(guildId);
    const guild = db.getGuild(guildId);
    if (!guild) throw new Error('guild not found');
    const live = market.live(guildId);
    const gov = government.summary(guildId);
    const stocks = securities.marketView(guildId);
    const state = cycle.status(guildId);
    const history = market.history(guildId, 24);
    const snapshots = history.length ? history : [{ tick: 0, gdp_cents: 0, price_index: 10000, money_supply_cents: live.moneySupply, treasury_cents: live.treasury, stock_market_cap_cents: live.stockMarketCap }];
    const last = live.snapshot || snapshots[snapshots.length - 1];
    const canvas = createCanvas(theme.width, theme.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, theme.width, theme.height);
    const gradient = ctx.createRadialGradient(240, -120, 10, 240, -120, 700);
    gradient.addColorStop(0, theme.glow);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, theme.width, 500);
    drawOrnament(ctx, theme.width, theme.height);
    const margin = 56;
    const contentW = theme.width - margin * 2;

    text(ctx, theme.motif === 'empire' ? 'WIRTSCHAFTSBERICHT · 1914' : theme.motif === 'soviet' ? 'ЭКОНОМИЧЕСКИЙ ОТЧЁТ · СССР' : 'ECONOMIC OVERVIEW', margin, 38, 10, theme.accent);
    fitText(ctx, guild.name || `Guild ${guildId}`, 760, 38, theme.text, margin, 60);
    const headerRight = theme.motif === 'default' ? theme.width - margin : theme.width - 180;
    text(ctx, `${guild.model.replace(/_/g, ' ').toUpperCase()}  ·  CYCLE ${state.tick}`, headerRight, 52, 11, theme.muted, 'right');
    text(ctx, `${formatDate(last.at || new Date().toISOString())}  ·  ${guild.currency_code}`, headerRight, 74, 11, theme.faint, 'right');
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(margin, 118);
    ctx.lineTo(theme.width - margin, 118);
    ctx.stroke();

    const gap = 18;
    const cardW = (contentW - gap * 3) / 4;
    const cardY = 140;
    const cardH = 128;
    const gdpDelta = live.gdpChangeBps / 100;
    const inflation = live.inflationBps / 100;
    const unemployment = live.unemploymentBps / 100;
    kpiCard(ctx, margin, cardY, cardW, cardH, 'Output', formatCompact(last.gdp_cents || 0, guild.currency_code),
        change(gdpDelta, 2), gdpDelta >= 0 ? theme.accent : theme.danger,
        snapshots.map(s => s.gdp_cents), theme.accent);
    kpiCard(ctx, margin + (cardW + gap), cardY, cardW, cardH, 'Inflation', change(inflation, 2), 'consumer price index',
        inflation > 0 ? theme.warning : inflation < 0 ? theme.blue : theme.muted,
        snapshots.map(s => s.price_index), theme.gold);
    kpiCard(ctx, margin + (cardW + gap) * 2, cardY, cardW, cardH, 'Unemployment', change(unemployment, 2), `${live.employed} of ${live.workforce} employed`,
        theme.muted, [], theme.muted);
    kpiCard(ctx, margin + (cardW + gap) * 3, cardY, cardW, cardH, 'Money supply', formatCompact(live.moneySupply, guild.currency_code), 'wallet, deposits and corporate cash',
        theme.muted, snapshots.map(s => s.money_supply_cents), theme.blue);

    const chartY = 292;
    const chartH = 360;
    const chartW = 900;
    panel(ctx, margin, chartY, chartW, chartH, 'Output and prices', 'Expenditure-based output and consumer price index');
    lineChart(ctx, {
        x: margin + 18,
        y: chartY + 68,
        w: chartW - 36,
        h: chartH - 92,
        data: snapshots.map(s => ({ label: `C${s.tick}`, value: s.gdp_cents })),
        secondary: snapshots.map(s => ({ label: `C${s.tick}`, value: s.price_index / 100 })),
        currency: guild.currency_code,
        color: theme.accent,
        secondaryColor: theme.gold,
        primaryLabel: 'Output',
        secondaryLabel: 'Price index',
    });
    text(ctx, 'Price index rebased to 100.00', margin + 24, chartY + chartH - 24, 10, theme.faint);

    const sideX = margin + chartW + gap;
    const sideW = contentW - chartW - gap;
    panel(ctx, sideX, chartY, sideW, chartH, guild.central_bank_name || 'State bank', 'Monetary conditions and reserve position');
    const bank = live.bank || {};
    const rows = [
        ['Policy rate', formatBps(bank.policyRateBps), theme.text],
        ['Deposit rate', formatBps(bank.depositRateBps), theme.text],
        ['Reserve requirement', formatBps(bank.reserveRatioBps), theme.text],
    ];
    let ry = chartY + 78;
    for (const [label, value, color] of rows) {
        text(ctx, label, sideX + 24, ry, 12, theme.muted);
        text(ctx, value, sideX + sideW - 24, ry, 12, color, 'right');
        ry += 28;
    }
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(sideX + 24, ry + 4);
    ctx.lineTo(sideX + sideW - 24, ry + 4);
    ctx.stroke();
    ry += 22;
    const bankRows = [
        ['Vault', formatCompact(bank.vault, guild.currency_code)],
        ['Deposits', formatCompact(bank.deposits, guild.currency_code)],
        ['Loans', formatCompact(bank.loans, guild.currency_code)],
        ['Capital', formatCompact(bank.capital, guild.currency_code)],
    ];
    for (const [label, value] of bankRows) {
        text(ctx, label, sideX + 24, ry, 12, theme.muted);
        text(ctx, value, sideX + sideW - 24, ry, 13, theme.text, 'right');
        ry += 30;
    }
    text(ctx, 'Reserve coverage', sideX + 24, ry + 4, 11, theme.muted);
    text(ctx, `${(Number(bank.reserveBps || 0) / 100).toFixed(2)}%`, sideX + sideW - 24, ry + 4, 11, theme.text, 'right');
    meter(ctx, sideX + 24, ry + 26, sideW - 48, Number(bank.reserveBps || 0), 10000, bank.status === 'sound' ? theme.accent : theme.warning);
    pill(ctx, bank.status || 'sound', sideX + 24, ry + 48, bank.status === 'sound' ? theme.accent : theme.warning);
    text(ctx, `${bank.depositCount || 0} deposit accounts  ·  ${bank.loanCount || 0} active loans`, sideX + 24, ry + 90, 10, theme.faint);

    const bottomY = 674;
    const bottomH = 258;
    panel(ctx, margin, bottomY, 900, bottomH, 'Goods market', 'Traded output, prices and available stock');
    const colX = [margin + 24, margin + 390, margin + 570, margin + 720];
    const headers = ['GOOD', 'PRICE', 'CHANGE', 'STOCK'];
    headers.forEach((header, i) => text(ctx, header, colX[i], bottomY + 70, 9, theme.faint, i === 0 ? 'left' : 'right'));
    const goods = [...(live.goods || [])].sort((a, b) => Math.abs(b.change_bps) - Math.abs(a.change_bps)).slice(0, 5);
    let gy = bottomY + 94;
    for (const good of goods) {
        text(ctx, good.label, colX[0], gy, 12, theme.text);
        text(ctx, formatMoney(good.price_cents, guild.currency_code), colX[1], gy, 12, theme.text, 'right');
        const pct = Number(good.change_bps) / 100;
        text(ctx, change(pct, 2), colX[2], gy, 12, pct >= 0 ? theme.accent : theme.danger, 'right');
        text(ctx, Number(good.stock).toLocaleString('en-US'), colX[3], gy, 12, theme.muted, 'right');
        gy += 31;
    }

    const rightX = margin + 900 + gap;
    const rightW = contentW - 900 - gap;
    panel(ctx, rightX, bottomY, rightW, bottomH, 'Public accounts', 'Fiscal position and listed equity');
    const fiscal = [
        ['Treasury balance', formatCompact(gov.balance, guild.currency_code)],
        ['Recorded revenue', formatCompact(gov.revenue, guild.currency_code)],
        ['Recorded spending', formatCompact(gov.spending, guild.currency_code)],
        ['Listed companies', String(stocks.listed.length)],
        ['Market capitalisation', formatCompact(stocks.totalMarketCap, guild.currency_code)],
    ];
    let fy = bottomY + 78;
    for (const [label, value] of fiscal) {
        text(ctx, label, rightX + 24, fy, 12, theme.muted);
        text(ctx, value, rightX + rightW - 24, fy, 12, theme.text, 'right');
        fy += 29;
    }
    text(ctx, 'Price index trend', rightX + 24, bottomY + 220, 10, theme.faint);
    sparkline(ctx, snapshots.map(s => s.price_index), rightX + 180, bottomY + 218, rightW - 204, 18, theme.gold);

    text(ctx, `${guild.currency_name}  ·  cycle every ${state.minutes} minutes  ·  next update ${state.due ? 'due now' : formatDateTime(state.nextAt)}`, margin, theme.height - 34, 10, theme.faint);
    text(ctx, 'State ledger · values are server-scoped', theme.width - margin, theme.height - 34, 10, theme.faint, 'right');
    return {
        buffer: canvas.toBuffer('image/png'),
        filename: `economy-${String(guild.name || guildId).replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase() || guildId}.png`,
        snapshot: last,
    };
}

module.exports = { renderOverview };
