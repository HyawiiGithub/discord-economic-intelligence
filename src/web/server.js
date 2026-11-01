'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const db = require('../db');
const style = require('../style');
const market = require('../economy/market');
const securities = require('../economy/securities');
const government = require('../economy/government');
const community = require('../economy/community');
const cryptoMarket = require('../economy/crypto');
const companies = require('../economy/companies');
const accounts = require('../economy/accounts');
const social = require('../economy/social');
const news = require('../economy/news');
const resetEconomy = require('../economy/reset');
const permissions = require('../permissions');
const jarvis = require('../jarvis');
const feeds = require('../feeds');
const cycle = require('../economy/cycle');
const { DEVELOPER_IDS, modelPreset, normalizeModel, currencyPreset, POWER_KEYS, POWER_LABELS, OFFICES, SECTORS } = require('../config');

const PORT = Math.max(1, Number(process.env.ECON_WEB_PORT) || 8787);
const HOST = process.env.ECON_WEB_HOST || '127.0.0.1';
const API_TOKEN = process.env.ECON_API_TOKEN || '';
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || process.env.JARVIS_SESSION_SECRET || '';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const ORIGIN = process.env.ECON_WEB_ORIGIN || '*';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

function json(res, status, data, headers) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
        ...(headers || {}),
    });
    res.end(body);
}
function cors(req) {
    const origin = req.headers.origin || '';
    const allowed = ORIGIN === '*' || !ORIGIN || ORIGIN.split(',').map(value => value.trim()).includes(origin);
    return {
        'Access-Control-Allow-Origin': ORIGIN === '*' ? '*' : allowed ? origin : 'null',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}
function b64urlDecode(value) {
    return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function verifySessionToken(token) {
    if (!SESSION_SECRET) throw new Error('DASHBOARD_SESSION_SECRET is not configured');
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('invalid session token');
    const [header, payload, signature] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('invalid session signature');
    const claims = JSON.parse(b64urlDecode(payload).toString('utf8'));
    if (!claims.exp || Number(claims.exp) * 1000 <= Date.now()) throw new Error('session expired');
    return claims;
}
function sessionFrom(req) {
    const header = String(req.headers.authorization || '');
    const key = header.startsWith('Bearer ') ? header.slice(7) : String(req.headers['x-api-key'] || '');
    if (!key) throw new Error('authentication required');
    if (API_TOKEN && key === API_TOKEN) {
        return { legacy: true, developer: true, user: { id: 'legacy', username: 'API token' }, guilds: 'all' };
    }
    if (SESSION_SECRET) {
        const claims = verifySessionToken(key);
        const developer = DEVELOPER_IDS.includes(String(claims.sub)) || !!claims.developer;
        return { ...claims, developer, user: { id: String(claims.sub), username: claims.username || 'Discord user', avatar: claims.avatar || null }, guilds: Array.isArray(claims.guilds) ? claims.guilds : [] };
    }
    throw new Error('no dashboard authentication configured');
}
function permissionBits(value) {
    try { return BigInt(String(value || '0')); } catch { return 0n; }
}
function canManage(session, guildId) {
    if (!session) return false;
    if (session.legacy || session.developer) return true;
    const claim = (session.guilds || []).find(item => String(item.id) === String(guildId));
    if (!claim) return false;
    if (claim.owner) return true;
    const bits = permissionBits(claim.permissions);
    return (bits & MANAGE_GUILD) === MANAGE_GUILD || (bits & ADMINISTRATOR) === ADMINISTRATOR;
}
function canRead(session, guildId) {
    if (!session) return false;
    if (session.legacy || session.developer) return true;
    return (session.guilds || []).some(item => String(item.id) === String(guildId));
}
function guildPayload(guildId) {
    const guild = db.getGuild(guildId);
    if (!guild) return null;
    const selected = style.forGuild(guildId, guild);
    let styleCustom = null;
    try { styleCustom = guild.style_custom ? JSON.parse(guild.style_custom) : null; } catch {}
    return {
        guild: {
            id: guild.guild_id,
            name: guild.name,
            model: guild.model,
            currency: guild.currency_code,
            currencyName: guild.currency_name,
            prefix: guild.prefix,
            bank: guild.central_bank_name,
            government: guild.government_name,
            styleKey: guild.style_key,
            styleCustom,
            taxes: {
                incomeBps: guild.income_tax_bps,
                corporateBps: guild.corporate_tax_bps,
                payrollBps: guild.payroll_tax_bps,
                vatBps: guild.vat_bps,
                wealthBps: guild.wealth_tax_bps,
            },
            policyRateBps: guild.policy_rate_bps,
            reserveRatioBps: guild.reserve_ratio_bps,
            workCooldownMin: guild.work_cooldown_min,
            cycleMinutes: guild.cycle_minutes,
            starterCents: guild.starter_balance,
            jarvisLimit: guild.jarvis_limit,
            welfareBps: guild.welfare_bps,
            centralBankIndependence: guild.central_bank_independence,
            marketOpenness: guild.market_openness,
        },
        theme: selected ? {
            key: selected.key,
            label: selected.label,
            color: `#${selected.color.toString(16).padStart(6, '0')}`,
            ...selected.theme,
        } : {
            key: null,
            label: 'Plain institutional',
            color: '#4ade80',
            background: '#070a0e',
            surface: '#0d1219',
            accent: '#4ade80',
            gold: '#e8c16a',
            text: '#f5f7fa',
            muted: '#8b97a8',
        },
        cycle: cycle.status(guildId),
    };
}
function summary(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    const live = market.live(guildId);
    const gov = government.summary(guildId);
    const stocks = securities.marketView(guildId);
    const report = community.report(guildId);
    return {
        ...base,
        overview: {
            outputCents: live.snapshot ? live.snapshot.gdp_cents : 0,
            inflationBps: live.inflationBps,
            unemploymentBps: live.unemploymentBps,
            moneySupplyCents: live.moneySupply,
            treasuryCents: live.treasury,
            priceIndex: live.priceIndex,
            workforce: live.workforce,
            employed: live.employed,
            companies: live.companyCount,
            goods: live.goods,
            bank: live.bank,
            government: gov,
            stocks: {
                listed: stocks.listed.length,
                marketCapCents: stocks.totalMarketCap,
                top: stocks.top.map(item => ({ ticker: item.company.ticker, name: item.company.name, priceCents: item.quote.last, change: item.change, marketCapCents: item.marketCap })),
                movers: stocks.movers.map(item => ({ ticker: item.company.ticker, name: item.company.name, change: item.change })),
            },
            lottery: report.lottery || null,
        },
    };
}
function marketPayload(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    return { ...base, goods: market.goodsList(guildId), priceIndex: market.priceIndex(guildId), history: market.history(guildId, 36), inflationBps: market.inflationBps(guildId) };
}
function stocksPayload(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    const view = securities.marketView(guildId);
    return {
        ...base,
        listed: view.listed.map(item => ({
            id: item.company.id, name: item.company.name, ticker: item.company.ticker, sector: item.company.sector,
            lastCents: item.quote.last, bidCents: item.quote.bid, askCents: item.quote.ask, change: item.change,
            marketCapCents: item.marketCap, history: securities.history(guildId, item.company.id, 36).map(row => ({ tick: row.tick, priceCents: row.price_cents })),
        })),
        totalMarketCapCents: view.totalMarketCap,
        movers: view.movers.map(item => ({ ticker: item.company.ticker, name: item.company.name, change: item.change })),
    };
}
function cryptoPayload(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    const assets = cryptoMarket.list(guildId);
    return {
        ...base,
        assets: assets.map(asset => ({
            id: asset.id, symbol: asset.symbol, name: asset.name, kind: asset.kind, priceCents: asset.price_cents,
            change: asset.change, reserveCents: asset.reserve_cents, supply: asset.supply, marketCapCents: asset.marketCap,
            volatilityBps: asset.volatility_bps, history: asset.history.map(row => ({ tick: row.tick, priceCents: row.price_cents })),
        })),
    };
}
function socialPayload(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    const activity = db.all('SELECT user_id, display_name, message_count, reactions_received, first_seen_at, last_message_at, last_channel_id FROM member_activity WHERE guild_id = ? ORDER BY message_count DESC LIMIT 30', [guildId]);
    return { ...base, wealth: community.leaderboard(guildId, 20), reputation: social.leaderboard(guildId, 20), activity };
}
function configPayload(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    return { ...base, feeds: feeds.list(guildId), feedKeys: feeds.KEYS, styleChoices: style.choices(), powerKeys: POWER_KEYS, powerLabels: POWER_LABELS, offices: OFFICES, sectors: Object.entries(SECTORS).map(([value, info]) => ({ value, label: info.label })), signalChannels: news.list(guildId), signalKeys: news.SIGNAL_KEYS };
}
function reportPayload(guildId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    return { ...base, report: community.report(guildId), history: market.history(guildId, 36) };
}
function memberPayload(guildId, userId) {
    const base = guildPayload(guildId);
    if (!base) return null;
    const profile = db.get('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]);
    const summaryData = social.summary(guildId, userId);
    return {
        ...base,
        member: {
            id: String(userId),
            name: profile ? profile.display_name : String(userId),
            creditScore: profile ? profile.credit_score : 650,
            totalIncomeCents: profile ? profile.total_income : 0,
            totalTaxCents: profile ? profile.total_tax : 0,
            createdAt: profile ? profile.created_at : null,
            activity: summaryData.activity,
            reputation: summaryData,
            walletCents: db.walletBalance(guildId, userId),
            depositCents: db.depositBalance(guildId, userId),
            loanCents: db.loanBalance(guildId, 'user', userId),
            shares: securities.holdings(guildId, userId),
            crypto: cryptoMarket.portfolio(guildId, userId),
        },
    };
}
async function discordChannels(guildId) {
    if (!DISCORD_TOKEN) return [];
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/channels`, {
            headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return [];
        const channels = await response.json();
        return channels.sort((a, b) => (a.position || 0) - (b.position || 0)).map(channel => ({ id: channel.id, name: channel.name, type: channel.type, parentId: channel.parent_id || null }));
    } catch {
        return [];
    }
}
async function discordRoles(guildId) {
    if (!DISCORD_TOKEN) return [];
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/roles`, {
            headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return [];
        const roles = await response.json();
        return roles.filter(role => role.name !== '@everyone').sort((a, b) => b.position - a.position).map(role => ({ id: role.id, name: role.name, color: role.color, position: role.position, managed: role.managed }));
    } catch {
        return [];
    }
}
function cleanCustom(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const out = {};
    const strings = ['label', 'footer', 'bankName', 'governmentName', 'exchangeName'];
    for (const key of strings) if (typeof value[key] === 'string') out[key] = value[key].slice(0, 120);
    if (typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)) out.color = parseInt(value.color.slice(1), 16);
    if (value.theme && typeof value.theme === 'object') {
        const theme = {};
        for (const key of ['background', 'surface', 'surfaceAlt', 'text', 'muted', 'faint', 'accent', 'gold', 'danger', 'warning', 'blue', 'border', 'borderStrong', 'accentSoft', 'glow', 'motif', 'seal', 'font']) {
            if (typeof value.theme[key] === 'string') theme[key] = value.theme[key].slice(0, 80);
        }
        out.theme = theme;
    }
    if (value.titles && typeof value.titles === 'object') {
        out.titles = {};
        for (const [key, title] of Object.entries(value.titles)) {
            if (/^[a-z_]{2,30}$/.test(key) && typeof title === 'string') out.titles[key] = title.slice(0, 120);
        }
    }
    return out;
}
function patchConfig(guildId, body, actorId) {
    const guild = db.getGuild(guildId);
    if (!guild) throw new Error('guild not found');
    const patch = {};
    if (body.style_key !== undefined) {
        const key = String(body.style_key || '').toLowerCase();
        if (key !== 'none' && !style.preset(key)) throw new Error('unknown style preset');
        patch.style_key = key;
        if (!body.style_custom) patch.style_custom = null;
        const selected = style.preset(key);
        if (!selected) {
            const plain = currencyPreset('USD');
            Object.assign(patch, { currency_code: plain.code, currency_name: plain.name, currency_symbol: plain.symbol, central_bank_name: 'State Bank', government_name: 'Treasury', prefix: '-' });
        }
        if (selected) {
            const currency = currencyPreset(selected.currency);
            Object.assign(patch, {
                currency_code: currency.code, currency_name: currency.name, currency_symbol: currency.symbol,
                central_bank_name: selected.bankName, government_name: selected.governmentName, prefix: selected.prefix,
                work_cooldown_min: 10,
            });
            if (selected.applyModel) {
                const preset = modelPreset(selected.model);
                Object.assign(patch, {
                    model: selected.model,
                    income_tax_bps: preset.income_tax_bps, corporate_tax_bps: preset.corporate_tax_bps,
                    payroll_tax_bps: preset.payroll_tax_bps, vat_bps: preset.vat_bps,
                    policy_rate_bps: preset.policy_rate_bps, reserve_ratio_bps: preset.reserve_ratio_bps,
                    welfare_bps: preset.welfare_bps, central_bank_independence: preset.central_bank_independence,
                    market_openness: preset.market_openness,
                });
            }
        }
    }
    if (body.style_custom !== undefined) {
        const custom = cleanCustom(body.style_custom);
        patch.style_custom = custom ? JSON.stringify(custom) : null;
    }
    if (body.model !== undefined) {
        const model = normalizeModel(body.model);
        if (!model) throw new Error('unknown model');
        patch.model = model;
        if (body.apply_model_preset) {
            const preset = modelPreset(model);
            Object.assign(patch, { income_tax_bps: preset.income_tax_bps, corporate_tax_bps: preset.corporate_tax_bps, payroll_tax_bps: preset.payroll_tax_bps, vat_bps: preset.vat_bps, policy_rate_bps: preset.policy_rate_bps, reserve_ratio_bps: preset.reserve_ratio_bps, welfare_bps: preset.welfare_bps, central_bank_independence: preset.central_bank_independence, market_openness: preset.market_openness });
        }
    }
    if (body.currency !== undefined) {
        const currency = currencyPreset(String(body.currency).toUpperCase());
        Object.assign(patch, { currency_code: currency.code, currency_name: currency.name, currency_symbol: currency.symbol });
    }
    if (body.prefix !== undefined) patch.prefix = String(body.prefix).slice(0, 3);
    if (body.central_bank_name !== undefined) patch.central_bank_name = String(body.central_bank_name).slice(0, 80);
    if (body.government_name !== undefined) patch.government_name = String(body.government_name).slice(0, 80);
    const numeric = {
        income_tax_bps: [0, 10000], corporate_tax_bps: [0, 10000], payroll_tax_bps: [0, 10000], vat_bps: [0, 10000],
        wealth_tax_bps: [0, 10000], policy_rate_bps: [-100, 5000], reserve_ratio_bps: [0, 5000],
        cycle_minutes: [1, 10080], work_cooldown_min: [1, 10080], starter_balance: [0, 100000000],
        jarvis_limit: [1, 1000], welfare_bps: [0, 10000], central_bank_independence: [0, 100], market_openness: [0, 100],
    };
    for (const [key, [min, max]] of Object.entries(numeric)) {
        if (body[key] === undefined) continue;
        const value = Math.trunc(Number(body[key]));
        if (!Number.isFinite(value)) throw new Error(`invalid ${key}`);
        patch[key] = Math.max(min, Math.min(max, value));
    }
    db.updateGuild(guildId, patch);
    db.audit(guildId, actorId, 'dashboard_config', patch);
    if (patch.style_key) community.ensure(guildId);
    return configPayload(guildId);
}
async function readBody(req) {
    let raw = '';
    for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1024 * 1024) throw new Error('request body too large');
    }
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { throw new Error('invalid JSON body'); }
}
async function handle(req, res) {
    const headers = cors(req);
    if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'api') return json(res, 404, { error: 'not found' }, headers);
    if (segments[1] === 'health') return json(res, 200, { ok: true, service: 'economy-dashboard-api', time: new Date().toISOString() }, headers);
    let session;
    try {
        session = sessionFrom(req);
    } catch (error) {
        return json(res, 401, { error: error.message }, headers);
    }
    const availableGuilds = () => {
        const rows = db.all('SELECT guild_id, name, style_key, currency_code, currency_name, model, last_cycle_tick, last_cycle_at FROM guilds ORDER BY name');
        return rows.filter(row => canRead(session, row.guild_id)).map(row => ({
            id: row.guild_id, name: row.name, style: row.style_key, currency: row.currency_code,
            model: row.model, cycle: Number(row.last_cycle_tick) || 0, lastCycleAt: row.last_cycle_at,
            canManage: canManage(session, row.guild_id),
        }));
    };
    if (segments[1] === 'session') {
        return json(res, 200, { user: session.user, developer: !!session.developer, legacy: !!session.legacy, guilds: availableGuilds() }, headers);
    }
    if (segments[1] === 'guilds') return json(res, 200, { guilds: availableGuilds() }, headers);
    if (segments[1] !== 'guild' || !segments[2]) return json(res, 404, { error: 'not found' }, headers);
    const guildId = String(segments[2]);
    if (!canRead(session, guildId)) return json(res, 403, { error: 'you do not have access to that server' }, headers);
    const view = segments[3] || 'summary';
    if (req.method === 'GET') {
        let data;
        if (view === 'summary') data = summary(guildId);
        else if (view === 'market') data = marketPayload(guildId);
        else if (view === 'stocks') data = stocksPayload(guildId);
        else if (view === 'crypto') data = cryptoPayload(guildId);
        else if (view === 'social') data = socialPayload(guildId);
        else if (view === 'config') data = configPayload(guildId);
        else if (view === 'report') data = reportPayload(guildId);
        else if (view === 'member' && segments[4]) data = memberPayload(guildId, segments[4]);
        else if (view === 'companies') data = { ...guildPayload(guildId), companies: companies.listView(guildId).map(item => ({ ...item })), sectors: Object.entries(SECTORS).map(([value, info]) => ({ value, label: info.label })) };
        else if (view === 'audit') data = { ...guildPayload(guildId), entries: db.recentAudit(guildId, Number(url.searchParams.get('limit')) || 25) };
        else if (view === 'bugreports') data = { ...guildPayload(guildId), reports: db.all('SELECT id, command, summary, status, html_path, created_at FROM bug_reports WHERE guild_id = ? ORDER BY id DESC LIMIT 20', [guildId]) };
        else if (view === 'permissions') data = { ...guildPayload(guildId), rolePowers: permissions.listRolePowers(guildId), appointments: permissions.listAppointments(guildId), roles: await discordRoles(guildId), powerKeys: POWER_KEYS, powerLabels: POWER_LABELS, offices: OFFICES };
        else if (view === 'channels') data = { ...guildPayload(guildId), feeds: feeds.list(guildId), feedKeys: feeds.KEYS, channels: await discordChannels(guildId) };
        else if (view === 'news') data = { ...guildPayload(guildId), signals: news.signals(guildId, 50), signalChannels: news.list(guildId), signalKeys: news.SIGNAL_KEYS };
        else return json(res, 404, { error: 'unknown dashboard resource' }, headers);
        if (!data) return json(res, 404, { error: 'guild or resource not found' }, headers);
        return json(res, 200, data, headers);
    }
    if (!canManage(session, guildId)) return json(res, 403, { error: 'manage-server permission is required' }, headers);
    const body = await readBody(req);
    try {
        if (req.method === 'PATCH' && view === 'config') return json(res, 200, { ok: true, ...patchConfig(guildId, body, session.user.id) }, headers);
        if (req.method === 'POST' && view === 'cycle') return json(res, 200, { ok: true, result: cycle.runCycle(guildId) }, headers);
        if (req.method === 'POST' && view === 'reset') {
            if (String(body.confirmation || '') !== `RESET ${guildId}`) throw new Error(`confirmation must be "RESET ${guildId}"`);
            resetEconomy.resetGuild(guildId);
            db.audit(guildId, session.user.id, 'dashboard_reset_economy', {});
            return json(res, 200, { ok: true, reset: true, ...configPayload(guildId) }, headers);
        }
        if (req.method === 'POST' && view === 'channels') {
            feeds.bind(guildId, body.feed_key, body.channel_id);
            return json(res, 200, { ok: true, feeds: feeds.list(guildId) }, headers);
        }
        if (req.method === 'DELETE' && view === 'channels' && segments[4]) {
            feeds.unbind(guildId, segments[4]);
            return json(res, 200, { ok: true, feeds: feeds.list(guildId) }, headers);
        }
        if (req.method === 'POST' && view === 'signals') {
            news.bind(guildId, body.signal_key, body.channel_id);
            return json(res, 200, { ok: true, signalChannels: news.list(guildId) }, headers);
        }
        if (req.method === 'DELETE' && view === 'signals' && segments[4]) {
            news.unbind(guildId, segments[4]);
            return json(res, 200, { ok: true, signalChannels: news.list(guildId) }, headers);
        }
        if (req.method === 'POST' && view === 'news' && segments[4] === 'analyze') {
            return json(res, 200, { ok: true, result: news.runCycle(guildId) }, headers);
        }
        if (req.method === 'POST' && view === 'companies' && segments[4] && segments[5] === 'dividend') {
            const company = companies.get(guildId, Number(segments[4]));
            if (!company) throw new Error('company not found');
            const result = companies.dividend(guildId, company.owner_user_id, company.id);
            return json(res, 200, { ok: true, result }, headers);
        }
        if (req.method === 'POST' && view === 'companies') {
            const owner = String(body.ownerUserId || session.user.id).trim();
            const company = companies.create(guildId, owner, body.name, body.sector, body.description, body.capital);
            return json(res, 200, { ok: true, company }, headers);
        }
        if (req.method === 'POST' && view === 'lottery' && segments[4] === 'draw') {
            return json(res, 200, { ok: true, result: community.drawLottery(guildId, session.user.id) }, headers);
        }
        if (req.method === 'POST' && view === 'jarvis' && segments[4] === 'reset') {
            const userId = body.userId ? String(body.userId) : null;
            if (userId) db.run('DELETE FROM jarvis_usage WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
            else db.run('DELETE FROM jarvis_usage WHERE guild_id = ?', [guildId]);
            jarvis.resetMemory(guildId, userId);
            return json(res, 200, { ok: true }, headers);
        }
        if (req.method === 'POST' && view === 'permissions' && segments[4] === 'role') {
            return json(res, 200, { ok: true, result: permissions.grantRolePower(guildId, body.roleId, body.powers, session.user.id) }, headers);
        }
        if (req.method === 'DELETE' && view === 'permissions' && segments[4] === 'role' && segments[5]) {
            permissions.revokeRolePower(guildId, segments[5], session.user.id);
            return json(res, 200, { ok: true }, headers);
        }
        if (req.method === 'POST' && view === 'permissions' && segments[4] === 'appoint') {
            return json(res, 200, { ok: true, result: permissions.appoint(guildId, body.userId, body.office, session.user.id, { days: body.days }) }, headers);
        }
        if (req.method === 'DELETE' && view === 'permissions' && segments[4] === 'appoint' && segments[5]) {
            permissions.dismiss(guildId, segments[5], session.user.id);
            return json(res, 200, { ok: true }, headers);
        }
        if (req.method === 'POST' && view === 'member' && segments[4] && segments[5] === 'reputation') {
            return json(res, 200, { ok: true, result: social.giveRep(guildId, session.user.id, segments[4], body.score, body.reason) }, headers);
        }
        if (req.method === 'POST' && view === 'member' && segments[4] && segments[5] === 'adjust') {
            if (!session.developer) throw new Error('developer authority is required for direct balance adjustment');
            const amount = Math.trunc(Number(body.amountCents) || 0);
            if (amount <= 0) throw new Error('amountCents must be positive');
            const direction = String(body.direction || 'credit').toLowerCase();
            if (direction === 'credit') accounts.mint(guildId, segments[4], amount, body.reason || 'Dashboard adjustment', session.user.id);
            else if (direction === 'debit') accounts.burn(guildId, segments[4], amount, body.reason || 'Dashboard adjustment', session.user.id);
            else throw new Error('direction must be credit or debit');
            db.audit(guildId, session.user.id, 'dashboard_member_adjust', { userId: segments[4], amount, direction, reason: body.reason || '' });
            return json(res, 200, { ok: true, member: memberPayload(guildId, segments[4]) }, headers);
        }
        return json(res, 404, { error: 'unknown mutation' }, headers);
    } catch (error) {
        console.error('[web]', error);
        return json(res, 400, { error: error.message }, headers);
    }
}

const server = http.createServer((req, res) => {
    handle(req, res).catch(error => {
        console.error('[web:unhandled]', error);
        if (!res.headersSent) json(res, 500, { error: error.message || 'dashboard error' }, cors(req));
        else res.end();
    });
});

if (!API_TOKEN && !SESSION_SECRET) {
    console.error('Set ECON_API_TOKEN (local admin) or DASHBOARD_SESSION_SECRET (Discord login) before starting the dashboard API.');
    process.exit(1);
}
server.listen(PORT, HOST, () => {
    console.log(`[web] dashboard API listening on http://${HOST}:${PORT}`);
    console.log(`[web] auth: ${SESSION_SECRET ? 'Discord session JWT' : 'legacy API token'}${API_TOKEN ? ' + API token' : ''}`);
    console.log(`[web] CORS origin: ${ORIGIN}`);
});
