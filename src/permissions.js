'use strict';

const db = require('./db');
const {
    POWER_KEYS,
    POWER_LABELS,
    OFFICES,
    DEVELOPER_IDS,
    normalizePowers,
    normalizeOffice,
    parseIdList,
} = require('./config');
const { nowIso, addDays } = require('./money');

class PermissionError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'PermissionError';
        this.code = code || 'forbidden';
    }
}

function isDeveloper(userId) {
    const ids = new Set([...DEVELOPER_IDS, ...parseIdList(process.env.BOT_OWNER_IDS || process.env.BOT_OWNER_ID || '')]);
    return ids.has(String(userId));
}
function isBotOwner(userId) {
    return isDeveloper(userId);
}
function memberRoleIds(member) {
    if (!member) return [];
    const cache = member.roles && member.roles.cache;
    if (cache) {
        if (typeof cache.keys === 'function') return [...cache.keys()].map(String);
        if (Array.isArray(cache)) return cache.map(role => String(role.id || role));
    }
    if (Array.isArray(member.roleIds)) return member.roleIds.map(String);
    return [];
}
function isAdministrator(member) {
    try {
        const perms = member && member.permissions;
        if (!perms) return false;
        if (typeof perms.has === 'function') {
            return !!perms.has('Administrator') || !!perms.has('ADMINISTRATOR');
        }
        if (perms.bitfield != null) {
            const ADMIN = 1n << 3n;
            return (BigInt(perms.bitfield) & ADMIN) === ADMIN;
        }
    } catch {}
    return false;
}
function guildOwnerId(member) {
    try {
        return String((member.guild && member.guild.ownerId) || (member.guild && member.guild.owner_id) || '');
    } catch {
        return '';
    }
}
function parseStoredPowers(value) {
    if (Array.isArray(value)) return normalizePowers(value);
    try {
        const parsed = JSON.parse(value || '[]');
        return normalizePowers(parsed);
    } catch {
        return [];
    }
}
function appointmentPowers(guildId, userId) {
    const row = db.get('SELECT * FROM appointments WHERE guild_id = ? AND user_id = ?', [String(guildId), String(userId)]);
    if (!row) return [];
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return [];
    return parseStoredPowers(row.powers);
}
function rolePowers(guildId, member) {
    const ids = memberRoleIds(member);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.all(`SELECT * FROM role_powers WHERE guild_id = ? AND role_id IN (${placeholders})`, [String(guildId), ...ids]);
    const set = new Set();
    for (const row of rows) {
        for (const power of parseStoredPowers(row.powers)) set.add(power);
    }
    return [...set];
}
function resolvePowers(guildId, member) {
    const userId = String(member && member.id || '');
    if (isBotOwner(userId) || userId === guildOwnerId(member) || isAdministrator(member)) {
        return { full: true, powers: [...POWER_KEYS], source: 'administrator' };
    }
    const set = new Set([...rolePowers(guildId, member), ...appointmentPowers(guildId, userId)]);
    return { full: false, powers: [...set], source: set.size ? 'delegated' : 'member' };
}
function hasPower(guildId, member, power) {
    const resolved = resolvePowers(guildId, member);
    if (resolved.full) return true;
    return resolved.powers.includes(String(power));
}
function hasAnyPower(guildId, member, powers) {
    const resolved = resolvePowers(guildId, member);
    if (resolved.full) return true;
    return (powers || []).some(power => resolved.powers.includes(String(power)));
}
function requirePower(guildId, member, power) {
    if (!hasPower(guildId, member, power)) {
        throw new PermissionError(`You do not hold the ${POWER_LABELS[power] || power} authority.`, power);
    }
}
function requireAnyPower(guildId, member, powers) {
    if (!hasAnyPower(guildId, member, powers)) {
        throw new PermissionError('You do not hold the required authority.', (powers || []).join(','));
    }
}
function grantRolePower(guildId, roleId, powers, actorId) {
    const normalized = normalizePowers(powers);
    const id = String(roleId || '').replace(/[<@&>]/g, '').trim();
    if (!/^\d{5,25}$/.test(id)) throw new Error('invalid role id');
    if (!normalized.length) throw new Error(`powers must include: ${POWER_KEYS.join(', ')}`);
    db.run(`INSERT INTO role_powers (guild_id, role_id, powers, updated_by, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, role_id) DO UPDATE SET powers = excluded.powers, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [String(guildId), id, JSON.stringify(normalized), actorId ? String(actorId) : null, nowIso()]);
    db.audit(guildId, actorId, 'grant_role_power', { roleId: id, powers: normalized });
    return { roleId: id, powers: normalized };
}
function revokeRolePower(guildId, roleId, actorId) {
    const id = String(roleId || '').replace(/[<@&>]/g, '').trim();
    const result = db.run('DELETE FROM role_powers WHERE guild_id = ? AND role_id = ?', [String(guildId), id]);
    db.audit(guildId, actorId, 'revoke_role_power', { roleId: id });
    return Number(result.changes) > 0;
}
function listRolePowers(guildId) {
    return db.all('SELECT * FROM role_powers WHERE guild_id = ? ORDER BY role_id', [String(guildId)]).map(row => ({
        ...row,
        powers: parseStoredPowers(row.powers),
    }));
}
function appoint(guildId, userId, officeRef, actorId, options) {
    const office = normalizeOffice(officeRef);
    if (!office) throw new Error('unknown office');
    const template = OFFICES[office];
    const powers = normalizePowers((options && options.powers) || template.powers);
    if (!powers.length) throw new Error('office has no powers');
    const id = String(userId || '').replace(/[<@!>]/g, '').trim();
    if (!/^\d{5,25}$/.test(id)) throw new Error('invalid user id');
    const days = Math.max(0, Math.min(3650, Number(options && options.days) || 0));
    const expiresAt = days ? addDays(nowIso(), days) : null;
    db.run(`INSERT INTO appointments (guild_id, user_id, office, label, powers, appointed_by, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET office = excluded.office, label = excluded.label,
            powers = excluded.powers, appointed_by = excluded.appointed_by, created_at = excluded.created_at,
            expires_at = excluded.expires_at`,
        [String(guildId), id, office, template.label, JSON.stringify(powers), actorId ? String(actorId) : null, nowIso(), expiresAt]);
    db.audit(guildId, actorId, 'appoint', { userId: id, office, powers, expiresAt });
    return { userId: id, office, label: template.label, powers, expiresAt };
}
function dismiss(guildId, userId, actorId) {
    const id = String(userId || '').replace(/[<@!>]/g, '').trim();
    const result = db.run('DELETE FROM appointments WHERE guild_id = ? AND user_id = ?', [String(guildId), id]);
    db.audit(guildId, actorId, 'dismiss', { userId: id });
    return Number(result.changes) > 0;
}
function listAppointments(guildId) {
    return db.all('SELECT * FROM appointments WHERE guild_id = ? ORDER BY office, user_id', [String(guildId)]).map(row => ({
        ...row,
        powers: parseStoredPowers(row.powers),
    }));
}
function rolePowerView(guildId, member) {
    const resolved = resolvePowers(guildId, member);
    return {
        full: resolved.full,
        powers: resolved.powers,
        labels: resolved.powers.map(power => POWER_LABELS[power] || power),
        source: resolved.source,
        appointment: db.get('SELECT * FROM appointments WHERE guild_id = ? AND user_id = ?', [String(guildId), String(member && member.id || '')]),
    };
}
function powerListText() {
    return POWER_KEYS.map(key => `\`${key}\` - ${POWER_LABELS[key]}`).join('\n');
}
function officeListText() {
    return Object.entries(OFFICES).map(([key, office]) => `\`${key}\` - ${office.label} (${office.powers.join(', ')})`).join('\n');
}

module.exports = {
    PermissionError,
    isDeveloper,
    isBotOwner,
    isAdministrator,
    memberRoleIds,
    resolvePowers,
    hasPower,
    hasAnyPower,
    requirePower,
    requireAnyPower,
    grantRolePower,
    revokeRolePower,
    listRolePowers,
    appoint,
    dismiss,
    listAppointments,
    rolePowerView,
    powerListText,
    officeListText,
};
