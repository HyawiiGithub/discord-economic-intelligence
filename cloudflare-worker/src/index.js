const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(status, data, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...headers },
    });
}
function base64url(bytes) {
    let binary = '';
    for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function textBase64url(value) {
    return base64url(new TextEncoder().encode(value));
}
function decodeBase64url(value) {
    let text = String(value).replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    return atob(text);
}
function randomState() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return base64url(bytes);
}
async function hmac(value, secret) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
}
async function signSession(payload, secret) {
    const header = textBase64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = textBase64url(JSON.stringify(payload));
    const signature = base64url(await hmac(`${header}.${body}`, secret));
    return `${header}.${body}.${signature}`;
}
function parseCookie(request, name) {
    const cookie = request.headers.get('Cookie') || '';
    for (const part of cookie.split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return decodeURIComponent(rest.join('='));
    }
    return null;
}
function cookie(name, value, maxAge) {
    return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function discordAvatar(user) {
    if (!user.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`;
}
async function discord(path, options, env) {
    const response = await fetch(`https://discord.com/api/v10${path}`, options);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(`Discord ${response.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
    return data;
}
function login(request, env) {
    const state = randomState();
    const redirect = env.DISCORD_REDIRECT_URI || new URL('/callback', request.url).toString();
    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', redirect);
    authorize.searchParams.set('scope', 'identify guilds');
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('prompt', 'consent');
    return new Response(null, {
        status: 302,
        headers: {
            Location: authorize.toString(),
            'Set-Cookie': cookie('econ_oauth_state', state, 600),
        },
    });
}
async function callback(request, env) {
    const url = new URL(request.url);
    const error = url.searchParams.get('error');
    if (error) return json(400, { error: `Discord login cancelled: ${error}` });
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return json(400, { error: 'missing OAuth code or state' });
    if (state !== parseCookie(request, 'econ_oauth_state')) return json(400, { error: 'OAuth state mismatch; start login again' });
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) return json(500, { error: 'Worker secrets are not configured' });
    const redirect = env.DISCORD_REDIRECT_URI || new URL('/callback', request.url).toString();
    const token = await discord('/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirect,
        }),
    }, env);
    const user = await discord('/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } }, env);
    const guilds = await discord('/users/@me/guilds', { headers: { Authorization: `Bearer ${token.access_token}` } }, env);
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: 'economy-dashboard-worker',
        sub: user.id,
        username: user.global_name || user.username,
        avatar: discordAvatar(user),
        guilds: (guilds || []).map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            owner: !!guild.owner,
            permissions: String(guild.permissions),
        })),
        iat: now,
        exp: now + 60 * 60 * 24 * 7,
    };
    const session = await signSession(payload, env.SESSION_SECRET);
    const dashboard = env.DASHBOARD_URL || 'http://localhost:8080';
    return new Response(null, {
        status: 302,
        headers: {
            Location: `${dashboard.replace(/#.*$/, '').replace(/\/$/, '')}/#session=${encodeURIComponent(session)}`,
            'Set-Cookie': cookie('econ_oauth_state', '', 0),
        },
    });
}
async function verify(request, env) {
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expected = base64url(await hmac(`${parts[0]}.${parts[1]}`, env.SESSION_SECRET));
    if (expected !== parts[2]) return null;
    try {
        const payload = JSON.parse(decodeBase64url(parts[1]));
        return payload.exp * 1000 > Date.now() ? payload : null;
    } catch { return null; }
}
export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
        const url = new URL(request.url);
        try {
            if (url.pathname === '/health') return json(200, { ok: true, service: 'economy-discord-login' });
            if (url.pathname === '/login') return login(request, env);
            if (url.pathname === '/callback') return await callback(request, env);
            if (url.pathname === '/me') {
                const session = await verify(request, env);
                if (!session) return json(401, { error: 'invalid or expired session' });
                return json(200, { user: { id: session.sub, username: session.username, avatar: session.avatar }, guilds: session.guilds, exp: session.exp });
            }
            return json(404, { error: 'not found' });
        } catch (error) {
            return json(500, { error: error.message });
        }
    },
};
