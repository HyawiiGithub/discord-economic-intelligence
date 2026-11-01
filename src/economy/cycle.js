'use strict';

const db = require('../db');
const bank = require('./bank');
const government = require('./government');
const companies = require('./companies');
const securities = require('./securities');
const market = require('./market');
const community = require('./community');
const crypto = require('./crypto');

const running = new Set();

function dueAt(guild) {
    const minutes = Math.max(1, Number(guild.cycle_minutes) || 60);
    if (!guild.last_cycle_at) return new Date(0).toISOString();
    return new Date(new Date(guild.last_cycle_at).getTime() + minutes * 60000).toISOString();
}
function isDue(guild) {
    return Date.now() >= new Date(dueAt(guild)).getTime();
}
function runCycle(guildId) {
    const guild = db.getGuild(guildId);
    if (!guild) throw new Error('guild not found');
    const news = require('./news');
    const tick = (Number(guild.last_cycle_tick) || 0) + 1;
    return db.transaction(() => {
        const bankResult = bank.runCycle(guildId);
        const governmentResult = government.runCycle(guildId);
        const newsResult = news.runCycle(guildId);
        const companyResult = companies.runCycle(guildId, tick);
        const stockResult = securities.runCycle(guildId, tick);
        const marketResult = market.runCycle(guildId);
        news.decay(guildId);
        const communityResult = community.runCycle(guildId);
        const cryptoResult = crypto.runCycle(guildId, tick);
        db.updateGuild(guildId, {
            last_cycle_at: marketResult.snapshot.at,
            last_cycle_tick: tick,
        });
        db.audit(guildId, null, 'cycle', {
            tick,
            gdp: marketResult.snapshot.gdp_cents,
            priceIndex: marketResult.snapshot.price_index,
            loans: bankResult.loansServiced,
            bonds: governmentResult.bondsServiced,
            listed: stockResult.length,
            companies: companyResult.length,
            lottery: communityResult ? communityResult.jackpot : 0,
            crypto: cryptoResult.length,
            news: newsResult.length,
        });
        return {
            tick,
            at: marketResult.snapshot.at,
            snapshot: marketResult.snapshot,
            goods: marketResult.changes,
            bank: bankResult,
            government: governmentResult,
            companies: companyResult,
            securities: stockResult,
            lottery: communityResult,
            crypto: cryptoResult,
            news: newsResult,
            guildId: String(guildId),
            nextAt: dueAt(db.getGuild(guildId)),
        };
    });
}
function maybeRun(guildId) {
    const guild = db.getGuild(guildId);
    if (!guild || running.has(String(guildId)) || !isDue(guild)) return null;
    running.add(String(guildId));
    try {
        return runCycle(guildId);
    } finally {
        running.delete(String(guildId));
    }
}
function runAll() {
    const guilds = db.all('SELECT guild_id FROM guilds');
    const results = [];
    for (const guild of guilds) {
        try {
            const result = maybeRun(guild.guild_id);
            if (result) results.push(result);
        } catch (error) {
            db.audit(guild.guild_id, null, 'cycle_error', { message: error.message });
        }
    }
    return results;
}
function startScheduler(client) {
    const interval = setInterval(() => {
        const results = runAll();
        if (client && typeof client.emit === 'function' && results.length) {
            client.emit('economy:cycles', results);
        }
    }, 60000);
    interval.unref();
    return interval;
}
function status(guildId) {
    const guild = db.getGuild(guildId);
    return {
        tick: Number(guild.last_cycle_tick) || 0,
        lastAt: guild.last_cycle_at,
        nextAt: dueAt(guild),
        due: isDue(guild),
        minutes: Number(guild.cycle_minutes) || 60,
    };
}

module.exports = {
    dueAt,
    isDue,
    runCycle,
    maybeRun,
    runAll,
    startScheduler,
    status,
};
