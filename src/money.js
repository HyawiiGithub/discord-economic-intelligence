'use strict';

const { currencyPreset } = require('./config');

const MINOR = 100;

function nowIso() {
    return new Date().toISOString();
}
function clampInt(value, min, max) {
    const n = Math.trunc(Number(value) || 0);
    return Math.max(min, Math.min(max, n));
}
function toMinor(value, allowNegative) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('invalid amount');
        const minor = Math.round(value * MINOR);
        if (!allowNegative && minor < 0) throw new Error('amount cannot be negative');
        return minor;
    }
    let text = String(value == null ? '' : value).trim();
    if (!text) throw new Error('amount is required');
    let multiplier = 1;
    const suffix = text.match(/([kmb])$/i);
    if (suffix) {
        const s = suffix[1].toLowerCase();
        multiplier = s === 'k' ? 1e3 : s === 'm' ? 1e6 : 1e9;
        text = text.slice(0, -1).trim();
    }
    const negative = text.startsWith('-');
    text = text.replace(/^[+-]/, '').replace(/[,\s_]/g, '').replace(/[^0-9.]/g, '');
    if (!/^\d*(?:\.\d*)?$/.test(text) || text === '' || text === '.') throw new Error('invalid amount');
    const [wholeRaw, fracRaw = ''] = text.split('.');
    const whole = wholeRaw || '0';
    if (whole.length > 15) throw new Error('amount too large');
    const frac = (fracRaw + '00').slice(0, 2);
    const base = Number(whole) * MINOR + Number(frac);
    const scaled = Math.round(base * multiplier);
    const minor = negative ? -scaled : scaled;
    if (!allowNegative && minor < 0) throw new Error('amount cannot be negative');
    return minor;
}
function fromMinor(minor) {
    return Math.trunc(Number(minor) || 0) / MINOR;
}
function currencyOf(code) {
    return currencyPreset(code || 'USD');
}
function formatMoney(minor, code, options) {
    const cur = currencyOf(code);
    const n = fromMinor(minor);
    const abs = Math.abs(n);
    const decimals = options && Number.isInteger(options.decimals) ? Math.max(0, Math.min(8, options.decimals)) : 2;
    const body = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${n < 0 ? '-' : ''}${cur.symbol || cur.code} ${body}`;
}
function formatCompact(minor, code) {
    const cur = currencyOf(code);
    const n = fromMinor(minor);
    const abs = Math.abs(n);
    const scale = abs >= 1e12 ? ['tn', 1e12] : abs >= 1e9 ? ['bn', 1e9] : abs >= 1e6 ? ['m', 1e6] : abs >= 1e3 ? ['k', 1e3] : ['', 1];
    const value = n / scale[1];
    const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
    return `${value < 0 ? '-' : ''}${cur.symbol || cur.code} ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${scale[0]}`;
}
function formatBps(bps) {
    return `${(Number(bps || 0) / 100).toFixed(2)}%`;
}
function bpsOfRate(value) {
    return clampInt(Math.round(Number(value) * 100), -10000, 100000);
}
function rateOfBps(bps) {
    return Number(bps || 0) / 10000;
}
function applyBps(amount, bps) {
    return Math.round(Number(amount || 0) * Number(bps || 0) / 10000);
}
function splitTax(gross, bps) {
    const tax = applyBps(gross, bps);
    return { gross, tax, net: gross - tax };
}
function safeDiv(a, b, fallback) {
    const denominator = Number(b);
    if (!Number.isFinite(denominator) || denominator === 0) return Number(fallback) || 0;
    return Number(a) / denominator;
}
function pctChange(current, previous) {
    const prev = Number(previous) || 0;
    if (!prev) return 0;
    return ((Number(current) || 0) - prev) / Math.abs(prev);
}
function formatPct(value, places) {
    const n = Number(value) || 0;
    return `${n >= 0 ? '+' : ''}${n.toFixed(places == null ? 2 : places)}%`;
}
function formatDate(value) {
    try {
        return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch {
        return String(value || '').slice(0, 10);
    }
}
function formatDateTime(value) {
    try {
        return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
    } catch {
        return String(value || '');
    }
}
function ageMinutes(value) {
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, (Date.now() - t) / 60000);
}
function addMinutes(value, minutes) {
    return new Date(new Date(value).getTime() + Number(minutes || 0) * 60000).toISOString();
}
function addDays(value, days) {
    return new Date(new Date(value).getTime() + Number(days || 0) * 86400000).toISOString();
}
function startOfDay(value) {
    const d = value ? new Date(value) : new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
function plusDaysIso(value, days) {
    const d = new Date(new Date(value).getTime() + Number(days || 0) * 86400000);
    return d.toISOString();
}
function parsePercent(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) throw new Error('percentage is required');
    const number = Number(text.replace('%', ''));
    if (!Number.isFinite(number)) throw new Error('invalid percentage');
    return number;
}
function clampPercent(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return Number(min) || 0;
    return Math.max(min, Math.min(max, n));
}
function round(value, places) {
    const p = Math.pow(10, places == null ? 2 : places);
    return Math.round((Number(value) || 0) * p) / p;
}

module.exports = {
    MINOR,
    nowIso,
    clampInt,
    toMinor,
    fromMinor,
    currencyOf,
    formatMoney,
    formatCompact,
    formatBps,
    bpsOfRate,
    rateOfBps,
    applyBps,
    splitTax,
    safeDiv,
    pctChange,
    formatPct,
    formatDate,
    formatDateTime,
    ageMinutes,
    addMinutes,
    addDays,
    startOfDay,
    plusDaysIso,
    parsePercent,
    clampPercent,
    round,
};
