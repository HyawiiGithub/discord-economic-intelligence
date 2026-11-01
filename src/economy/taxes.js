'use strict';

const db = require('../db');
const { applyBps, formatBps } = require('../money');

function rates(guildId) {
    const guild = db.getGuild(guildId);
    return {
        income: Number(guild.income_tax_bps) || 0,
        corporate: Number(guild.corporate_tax_bps) || 0,
        payroll: Number(guild.payroll_tax_bps) || 0,
        vat: Number(guild.vat_bps) || 0,
        wealth: Number(guild.wealth_tax_bps) || 0,
    };
}
function income(guildId, gross) {
    const value = Math.max(0, Math.trunc(Number(gross) || 0));
    const tax = applyBps(value, rates(guildId).income);
    return { gross: value, tax, net: value - tax };
}
function payroll(guildId, gross) {
    const value = Math.max(0, Math.trunc(Number(gross) || 0));
    return applyBps(value, rates(guildId).payroll);
}
function corporate(guildId, profit) {
    const value = Math.max(0, Math.trunc(Number(profit) || 0));
    return applyBps(value, rates(guildId).corporate);
}
function vat(guildId, net) {
    const value = Math.max(0, Math.trunc(Number(net) || 0));
    return applyBps(value, rates(guildId).vat);
}
function dividend(guildId, gross) {
    return income(guildId, gross);
}
function effectiveBurden(guildId) {
    const r = rates(guildId);
    return Math.round((r.income * 0.35 + r.corporate * 0.25 + r.payroll * 0.2 + r.vat * 0.2));
}
function summaryText(guildId) {
    const r = rates(guildId);
    return [
        `Income tax **${formatBps(r.income)}**`,
        `Corporate tax **${formatBps(r.corporate)}**`,
        `Payroll tax **${formatBps(r.payroll)}**`,
        `VAT **${formatBps(r.vat)}**`,
        `Wealth tax **${formatBps(r.wealth)}**`,
    ].join('\n');
}

module.exports = {
    rates,
    income,
    payroll,
    corporate,
    vat,
    dividend,
    effectiveBurden,
    summaryText,
};
