'use strict';

const { theme, text, fitText } = require('./theme');
const { formatCompact, formatPct } = require('../money');

function smoothPath(ctx, points) {
    if (!points.length) return;
    if (points.length === 1) {
        ctx.moveTo(points[0].x, points[0].y);
        return;
    }
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
}
function rangeOf(values) {
    const nums = values.map(v => Number(v) || 0);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (min === max) return { min: min - 1, max: max + 1 };
    const pad = (max - min) * 0.12;
    return { min: min - pad, max: max + pad };
}
function yFor(value, range, top, height) {
    return top + height - ((Number(value) - range.min) / (range.max - range.min)) * height;
}
function drawGrid(ctx, x, y, w, h, rows) {
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= rows; i += 1) {
        const yy = y + (h / rows) * i;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
    }
}
function lineChart(ctx, opts) {
    const x = opts.x;
    const y = opts.y;
    const w = opts.w;
    const h = opts.h;
    const data = opts.data || [];
    if (!data.length) {
        text(ctx, 'No observations yet', x + w / 2, y + h / 2, 13, theme.faint, 'center', 'middle');
        return;
    }
    const padLeft = 64;
    const padRight = opts.secondary ? 58 : 18;
    const padTop = 22;
    const padBottom = 34;
    const plotX = x + padLeft;
    const plotY = y + padTop;
    const plotW = Math.max(10, w - padLeft - padRight);
    const plotH = Math.max(10, h - padTop - padBottom);
    const primary = data.map(d => Number(d.value) || 0);
    const primaryRange = rangeOf(primary);
    drawGrid(ctx, plotX, plotY, plotW, plotH, 4);
    if (data.length < 2) {
        const yy = plotY + plotH * 0.56;
        ctx.strokeStyle = opts.color || theme.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plotX, yy);
        ctx.lineTo(plotX + plotW, yy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(plotX + plotW / 2, yy, 4, 0, Math.PI * 2);
        ctx.fillStyle = theme.background;
        ctx.fill();
        ctx.strokeStyle = opts.color || theme.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        text(ctx, formatCompact(primary[0], opts.currency), plotX + plotW / 2 + 12, yy - 20, 13, theme.text, 'center');
        text(ctx, 'First observation recorded. Trend appears after the next cycle.', plotX + plotW / 2, plotY + plotH + 12, 10, theme.faint, 'center');
        return;
    }
    for (let i = 0; i <= 4; i += 1) {
        const value = primaryRange.max - ((primaryRange.max - primaryRange.min) / 4) * i;
        text(ctx, formatCompact(value, opts.currency), plotX - 12, plotY + (plotH / 4) * i, 10, theme.faint, 'right', 'middle');
    }
    const points = data.map((d, i) => ({
        x: plotX + (data.length === 1 ? plotW / 2 : (plotW / (data.length - 1)) * i),
        y: yFor(d.value, primaryRange, plotY, plotH),
    }));
    const gradient = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
    gradient.addColorStop(0, theme.accentSoft);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    smoothPath(ctx, points);
    ctx.lineTo(points[points.length - 1].x, plotY + plotH);
    ctx.lineTo(points[0].x, plotY + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    smoothPath(ctx, points);
    ctx.strokeStyle = opts.color || theme.accent;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = theme.background;
        ctx.fill();
        ctx.strokeStyle = opts.color || theme.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    if (opts.secondary && opts.secondary.length) {
        const secondary = opts.secondary.map(d => Number(d.value) || 0);
        const secondaryRange = rangeOf(secondary);
        const secondPoints = secondary.map((value, i) => ({
            x: plotX + (secondary.length === 1 ? plotW / 2 : (plotW / (secondary.length - 1)) * i),
            y: yFor(value, secondaryRange, plotY, plotH),
        }));
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        smoothPath(ctx, secondPoints);
        ctx.strokeStyle = opts.secondaryColor || theme.gold;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
        for (let i = 0; i <= 4; i += 1) {
            const value = secondaryRange.max - ((secondaryRange.max - secondaryRange.min) / 4) * i;
            text(ctx, value.toFixed(0), plotX + plotW + 10, plotY + (plotH / 4) * i, 10, 'rgba(232,193,106,0.7)', 'left', 'middle');
        }
        const last = secondary[secondary.length - 1];
        text(ctx, `${last.toFixed(0)}`, plotX + plotW + 10, secondPoints[secondPoints.length - 1].y - 10, 10, theme.gold, 'left', 'middle');
    }
    const labels = data.length <= 2 ? data : [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];
    for (const item of labels) {
        const index = data.indexOf(item);
        const px = plotX + (data.length === 1 ? plotW / 2 : (plotW / (data.length - 1)) * index);
        text(ctx, item.label || '', px, plotY + plotH + 12, 10, theme.faint, index === 0 ? 'left' : index === data.length - 1 ? 'right' : 'center');
    }
    if (opts.secondary) {
        ctx.save();
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(x + 16, y + 8, 3, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, opts.primaryLabel || 'Output', x + 25, y + 2, 10, theme.muted);
        ctx.fillStyle = theme.gold;
        ctx.beginPath();
        ctx.arc(x + 96, y + 8, 3, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, opts.secondaryLabel || 'Prices', x + 105, y + 2, 10, theme.muted);
        ctx.restore();
    }
}
function sparkline(ctx, values, x, y, w, h, color) {
    const data = (values || []).map(v => Number(v) || 0);
    if (data.length < 2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x + w, y + h / 2);
        ctx.stroke();
        return;
    }
    const range = rangeOf(data);
    const points = data.map((value, i) => ({
        x: x + (w / (data.length - 1)) * i,
        y: y + h - ((value - range.min) / (range.max - range.min)) * h,
    }));
    ctx.beginPath();
    smoothPath(ctx, points);
    ctx.strokeStyle = color || theme.accent;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
}
function meter(ctx, x, y, w, value, max, color) {
    const ratio = Math.max(0, Math.min(1, Number(value) / Math.max(1, Number(max))));
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = color || theme.accent;
    ctx.fillRect(x, y, w * ratio, 6);
}
function legend(ctx, x, y, items) {
    let cursor = x;
    for (const item of items) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(cursor + 4, y + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `400 10px ${theme.font}`;
        const label = item.label;
        text(ctx, label, cursor + 12, y, 10, theme.muted);
        cursor += 24 + ctx.measureText(label).width;
    }
}
function changeText(value) {
    return formatPct((Number(value) || 0) * 100, 2);
}
module.exports = {
    smoothPath,
    lineChart,
    sparkline,
    meter,
    legend,
    changeText,
    rangeOf,
    yFor,
};
