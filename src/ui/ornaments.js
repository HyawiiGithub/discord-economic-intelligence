'use strict';

const { theme, text } = require('./theme');

function drawEmpire(ctx, width, height) {
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

function drawReichsmark(ctx, width, height) {
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

function star(ctx, x, y, radius, points) {
    const count = points || 5;
    ctx.beginPath();
    for (let i = 0; i < count * 2; i += 1) {
        const angle = -Math.PI / 2 + (Math.PI * i) / count;
        const r = i % 2 === 0 ? radius : radius * 0.42;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}
function drawSoviet(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = theme.borderStrong;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(22, 22, width - 44, height - 44);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, width - 60, height - 60);
    const corners = [
        [22, 22, 1, 1], [width - 22, 22, -1, 1], [22, height - 22, 1, -1], [width - 22, height - 22, -1, -1],
    ];
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    for (const [x, y, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x + sx * 22, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * 22);
        ctx.stroke();
    }
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 0.8;
    for (let line = 0; line < 6; line += 1) {
        const base = height - 120 + line * 15;
        ctx.beginPath();
        for (let x = 38; x <= width - 38; x += 8) {
            const y = base + Math.sin(x / 95 + line) * 3.5;
            if (x === 38) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const sealX = width - 112;
    const sealY = 88;
    ctx.fillStyle = 'rgba(198,40,40,0.18)';
    star(ctx, sealX, sealY, 38, 5);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    text(ctx, theme.seal || 'СССР', sealX, sealY + 3, 10, theme.gold, 'center', 'middle');
    ctx.restore();
}
function drawOrnament(ctx, width, height) {
    if (theme.motif === 'empire') drawEmpire(ctx, width, height);
    else if (theme.motif === 'reichsmark') drawReichsmark(ctx, width, height);
    else if (theme.motif === 'soviet') drawSoviet(ctx, width, height);
}

module.exports = { drawOrnament };
