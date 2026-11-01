'use strict';

const config = window.ECON_CONFIG || {};
const state = {
    apiBase: localStorage.getItem('econ.apiBase') || config.apiBase || '',
    authUrl: localStorage.getItem('econ.authUrl') || config.authUrl || '',
    token: localStorage.getItem('econ.token') || '',
    session: null,
    guilds: [],
    guild: null,
    page: 'overview',
    data: null,
    timer: null,
    confirmAction: null,
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const n = value => Number(value) || 0;
const pct = value => `${n(value) > 0 ? '+' : ''}${n(value).toFixed(2)}%`;
const bps = value => `${(n(value) / 100).toFixed(2)}%`;
const money = (cents, currency) => `${currency || 'USD'} ${(n(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function compact(cents, currency) {
    const value = n(cents) / 100;
    const abs = Math.abs(value);
    const suffix = abs >= 1e9 ? 'bn' : abs >= 1e6 ? 'm' : abs >= 1e3 ? 'k' : '';
    const scaled = abs >= 1e9 ? value / 1e9 : abs >= 1e6 ? value / 1e6 : abs >= 1e3 ? value / 1e3 : value;
    return `${currency || 'USD'} ${scaled.toLocaleString('en-US', { maximumFractionDigits: scaled >= 100 ? 0 : 2 })}${suffix}`;
}
const when = value => {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(value); }
};
const statusText = value => String(value || '').replace(/_/g, ' ');
const canManage = () => !!(state.guild && state.guild.canManage);
function toast(message, error) {
    const element = $('#toast');
    element.textContent = message;
    element.className = `toast${error ? ' error' : ''}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.add('hidden'), 4200);
}
function openModal(id) { $('#' + id).classList.remove('hidden'); }
function closeModal(id) { $('#' + id).classList.add('hidden'); }
function themeVars(theme) {
    if (!theme) return;
    const root = document.documentElement.style;
    const map = { background: '--bg', surface: '--surface', surfaceAlt: '--surface-2', accent: '--accent', accentSoft: '--accent-soft', gold: '--gold', text: '--text', muted: '--muted', faint: '--faint', danger: '--danger', blue: '--blue', border: '--line', borderStrong: '--line-strong' };
    for (const [key, css] of Object.entries(map)) if (theme[key]) root.setProperty(css, theme[key]);
    if (theme.color && !theme.accent) root.setProperty('--accent', theme.color);
}
function setStatus(ok, text) {
    $('#statusDot').className = `dot ${ok ? 'online' : 'error'}`;
    $('#statusText').textContent = text;
}
function lineSvg(values, color, height = 230) {
    const nums = values.map(n);
    if (nums.length < 2) return `<div class="empty">Waiting for the next cycle.</div>`;
    const min = Math.min(...nums), max = Math.max(...nums), range = max - min || 1;
    const points = nums.map((value, index) => `${(index / (nums.length - 1)) * 100},${96 - ((value - min) / range) * 78}`).join(' ');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:${height}px;display:block;overflow:visible"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/><polygon points="0,100 ${points} 100,100" fill="url(#fill)"/></svg>`;
}
function sparkSvg(values, color) {
    const nums = values.map(n);
    if (nums.length < 2) return '<span class="faint">—</span>';
    const min = Math.min(...nums), max = Math.max(...nums), range = max - min || 1;
    const points = nums.map((value, index) => `${(index / (nums.length - 1)) * 100},${20 - ((value - min) / range) * 16}`).join(' ');
    return `<svg viewBox="0 0 100 22" preserveAspectRatio="none" style="width:90px;height:22px"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`;
}
const kpi = (label, value, detail, cls) => `<div class="card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value ${cls || ''}">${esc(value)}</div><div class="kpi-detail">${esc(detail || '')}</div></div>`;
const card = (title, subtitle, body, cls) => `<div class="card ${cls || ''}"><h3 class="card-title">${esc(title)}</h3><div class="card-sub">${esc(subtitle || '')}</div>${body || ''}</div>`;
const empty = text => `<div class="empty">${esc(text)}</div>`;
function table(headers, rows, emptyText) {
    if (!rows.length) return empty(emptyText || 'Nothing recorded yet.');
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function intro(text, actions) {
    return `<div class="page-intro">${text}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}`;
}
function api(path, options) {
    const headers = { Authorization: `Bearer ${state.token}`, ...(options && options.headers ? options.headers : {}) };
    if (options && options.body) headers['Content-Type'] = 'application/json';
    return fetch(`${state.apiBase.replace(/\/+$/, '')}${path}`, { ...(options || {}), headers }).then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) showLogin('Session expired. Sign in again.');
            throw new Error(body.error || `HTTP ${response.status}`);
        }
        return body;
    });
}
function showLogin(message) {
    $('#loginView').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    if (message) $('#loginError').textContent = message;
}
function setUser() {
    const user = state.session && state.session.user;
    $('#userName').textContent = user ? (user.username || user.id) : 'Not signed in';
    $('#userRole').textContent = state.session && state.session.developer ? 'DEVELOPER' : canManage() ? 'SERVER ADMIN' : 'MEMBER';
    const avatar = $('#userAvatar');
    if (user && user.avatar) avatar.innerHTML = `<img src="${esc(user.avatar)}" alt="">`;
    else avatar.textContent = user ? String(user.username || user.id).slice(0, 1).toUpperCase() : '?';
    $('#logoutButton').classList.toggle('hidden', !state.token);
}
function fillGuilds() {
    const select = $('#guildSelect');
    select.innerHTML = state.guilds.map(item => `<option value="${esc(item.id)}">${esc(item.name || item.id)} · ${esc(item.currency)}</option>`).join('');
    if (state.guild) select.value = state.guild.id;
}
async function connect(base, token) {
    const cleanBase = String(base || state.apiBase).trim().replace(/\/+$/, '');
    const cleanToken = String(token || state.token).trim();
    if (!cleanBase || !cleanToken) throw new Error('API base URL and token are required');
    if (!/^https?:\/\//i.test(cleanBase)) throw new Error('API base URL must start with http:// or https://');
    const previous = { apiBase: state.apiBase, token: state.token };
    state.apiBase = cleanBase;
    state.token = cleanToken;
    try {
        const session = await api('/api/session');
        state.session = session;
        state.guilds = session.guilds || [];
        localStorage.setItem('econ.apiBase', cleanBase);
        localStorage.setItem('econ.token', cleanToken);
        $('#loginView').classList.add('hidden');
        $('#appShell').classList.remove('hidden');
        setStatus(true, `connected · ${state.guilds.length} server${state.guilds.length === 1 ? '' : 's'}`);
        setUser();
        fillGuilds();
        if (!state.guilds.length) {
            $('#content').innerHTML = empty('No accessible servers. You need Manage Server or Administrator, or developer access.');
            return;
        }
        state.guild = state.guilds.find(item => item.id === (state.guild && state.guild.id)) || state.guilds[0];
        $('#guildSelect').value = state.guild.id;
        if (!state.timer) state.timer = setInterval(() => { if (!document.hidden && state.token) loadPage(state.page); }, 60000);
        await loadPage(state.page);
    } catch (error) {
        state.apiBase = previous.apiBase;
        state.token = previous.token;
        throw error;
    }
}
async function boot() {
    bind();
    $('#dateChip').textContent = when(new Date().toISOString());
    $('#apiBaseInput').value = state.apiBase;
    $('#apiTokenInput').value = state.token;
    $('#authUrlInput').value = state.authUrl;
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (hash.get('session')) {
        state.token = hash.get('session');
        localStorage.setItem('econ.token', state.token);
        history.replaceState(null, '', location.pathname + location.search);
    }
    if (hash.get('error')) showLogin(hash.get('error'));
    if (state.apiBase && state.token) {
        try { await connect(state.apiBase, state.token); }
        catch (error) { showLogin(error.message); openModal('settingsModal'); $('#settingsError').textContent = error.message; }
    } else {
        showLogin('');
        if (state.apiBase) openModal('settingsModal');
    }
    setUser();
}
function bind() {
    $$('#nav button').forEach(button => button.addEventListener('click', () => {
        if (window.innerWidth <= 780) $('#sidebar').classList.remove('open');
        loadPage(button.dataset.page);
    }));
    $('#guildSelect').addEventListener('change', async event => {
        state.guild = state.guilds.find(item => item.id === event.target.value) || null;
        setUser();
        await loadPage(state.page);
    });
    $('#refreshButton').addEventListener('click', () => loadPage(state.page));
    $('#settingsButton').addEventListener('click', () => {
        $('#apiBaseInput').value = state.apiBase;
        $('#apiTokenInput').value = state.token;
        $('#authUrlInput').value = state.authUrl;
        $('#settingsError').textContent = '';
        openModal('settingsModal');
    });
    $('#tokenLoginButton').addEventListener('click', () => openModal('settingsModal'));
    $('#discordLogin').addEventListener('click', () => {
        const auth = $('#authUrlInput').value.trim() || state.authUrl;
        if (!auth) {
            openModal('settingsModal');
            $('#settingsError').textContent = 'Set the Discord login Worker URL first.';
            return;
        }
        state.authUrl = auth;
        localStorage.setItem('econ.authUrl', auth);
        location.href = auth;
    });
    $('#connectButton').addEventListener('click', async () => {
        const auth = $('#authUrlInput').value.trim();
        if (auth) { state.authUrl = auth; localStorage.setItem('econ.authUrl', auth); }
        try {
            await connect($('#apiBaseInput').value, $('#apiTokenInput').value);
            closeModal('settingsModal');
            toast('Connected');
        } catch (error) { $('#settingsError').textContent = error.message; }
    });
    $('#logoutButton').addEventListener('click', () => {
        localStorage.removeItem('econ.token');
        state.token = '';
        state.session = null;
        state.guilds = [];
        state.guild = null;
        $('#appShell').classList.add('hidden');
        showLogin('');
    });
    $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
    $('#memberButton').addEventListener('click', () => lookupMember($('#memberInput').value, $('#memberResult')));
    $('#confirmButton').addEventListener('click', async () => {
        if (!state.confirmAction) return;
        try {
            await state.confirmAction($('#confirmInput').value);
            closeModal('confirmModal');
            $('#confirmInput').value = '';
        } catch (error) { $('#confirmError').textContent = error.message; }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.modal-backdrop').forEach(modal => modal.classList.add('hidden')); });
}
function confirmPhrase(title, text, phrase, action) {
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmInput').value = '';
    $('#confirmInput').placeholder = phrase;
    $('#confirmError').textContent = '';
    state.confirmAction = async value => {
        if (value !== phrase) throw new Error(`Type exactly: ${phrase}`);
        await action();
    };
    openModal('confirmModal');
}
async function loadPage(page) {
    if (!state.guild) return;
    state.page = page;
    $$('#nav button').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    $('#pageTitle').textContent = ({ overview: 'Overview', market: 'Goods market', stocks: 'Stock market', crypto: 'Crypto desk', companies: 'Companies', news: 'News & signals', social: 'People & reputation', treasury: 'Treasury', permissions: 'Permissions', config: 'Configuration', audit: 'Audit trail' })[page] || page;
    $('#pageEyebrow').textContent = state.guild.name || 'server ledger';
    $('#content').innerHTML = '<div class="loading">Loading ledger…</div>';
    try {
        let data;
        if (page === 'overview') {
            const [summary, report] = await Promise.all([api(`/api/guild/${state.guild.id}/summary`), api(`/api/guild/${state.guild.id}/report`)]);
            data = { summary, report };
            renderOverview(summary, report);
        } else if (page === 'market') { data = await api(`/api/guild/${state.guild.id}/market`); renderMarket(data); }
        else if (page === 'stocks') { data = await api(`/api/guild/${state.guild.id}/stocks`); renderStocks(data); }
        else if (page === 'crypto') { data = await api(`/api/guild/${state.guild.id}/crypto`); renderCrypto(data); }
        else if (page === 'companies') { const [companies, config] = await Promise.all([api(`/api/guild/${state.guild.id}/companies`), api(`/api/guild/${state.guild.id}/config`)]); data = { companies, config }; renderCompanies(companies, config); }
        else if (page === 'news') { data = await api(`/api/guild/${state.guild.id}/news`); renderNews(data); }
        else if (page === 'social') { data = await api(`/api/guild/${state.guild.id}/social`); renderSocial(data); }
        else if (page === 'treasury') { data = await api(`/api/guild/${state.guild.id}/summary`); renderTreasury(data); }
        else if (page === 'permissions') { data = await api(`/api/guild/${state.guild.id}/permissions`); renderPermissions(data); }
        else if (page === 'config') { data = await api(`/api/guild/${state.guild.id}/config`); renderConfig(data); }
        else if (page === 'audit') { data = await api(`/api/guild/${state.guild.id}/audit?limit=40`); renderAudit(data); }
        state.data = data;
        const theme = data.theme || data.summary?.theme || data.report?.theme;
        themeVars(theme);
        $('#brandSub').textContent = theme?.label || 'server ledger';
        $('#cycleChip').textContent = `cycle ${data.cycle?.tick ?? data.summary?.cycle?.tick ?? 0}`;
        $('#dateChip').textContent = when(new Date().toISOString());
        setUser();
    } catch (error) {
        $('#content').innerHTML = `<div class="notice">${esc(error.message)}</div>`;
        setStatus(false, error.message);
    }
}
function renderOverview(data, report) {
    const o = data.overview;
    const currency = data.guild.currency;
    const history = (report.history || []).map(row => row.gdp_cents);
    const priceHistory = (report.history || []).map(row => row.price_index);
    const goods = (o.goods || []).slice(0, 6);
    const actions = canManage() ? `
        <button class="primary" data-action="cycle">Run cycle now</button>
        <button class="danger" data-action="reset">Restart economy…</button>` : '';
    $('#content').innerHTML = `${intro(`This is the live macro view for <strong>${esc(data.guild.name)}</strong>. ${canManage() ? 'You can run the next economic cycle or fully reset the economy below.' : 'You are viewing in read-only mode.'} A restart wipes wallets, companies, markets, crypto, loans and history while keeping configuration, permissions and update channels.`, actions)}
        <div class="grid kpis">
            ${kpi('Output', compact(o.outputCents, currency), 'last completed cycle')}
            ${kpi('Inflation', pct(n(o.inflationBps) / 100), 'consumer price index', n(o.inflationBps) >= 0 ? 'gold' : 'green')}
            ${kpi('Unemployment', pct(n(o.unemploymentBps) / 100), `${o.employed} of ${o.workforce} employed`, n(o.unemploymentBps) > 500 ? 'red' : '')}
            ${kpi('Money supply', compact(o.moneySupplyCents, currency), 'wallet, deposits and corporate cash')}
        </div>
        <div class="split" style="margin-top:16px">
            ${card('Output and prices', 'Output and consumer price index across completed cycles', `<div class="chart-wrap">${lineSvg(history, data.theme?.accent || '#c9a227')}${priceHistory.length ? `<div class="list-row faint" style="margin-top:8px"><span>Price index</span><span>${((priceHistory[priceHistory.length - 1] || 0) / 100).toFixed(2)}</span></div>` : ''}</div>`)}
            ${card(data.guild.bank || 'State bank', 'Monetary conditions', `<div class="list">
                <div class="list-row"><span>Policy rate</span><strong>${bps(o.bank?.policyRateBps)}</strong></div>
                <div class="list-row"><span>Deposit rate</span><strong>${bps(o.bank?.depositRateBps)}</strong></div>
                <div class="list-row"><span>Reserve coverage</span><strong>${bps(o.bank?.reserveBps)}</strong></div>
                <div class="list-row"><span>Vault</span><strong>${compact(o.bank?.vault, currency)}</strong></div>
                <div class="list-row"><span>Deposits</span><strong>${compact(o.bank?.deposits, currency)}</strong></div>
                <div class="list-row"><span>Loans</span><strong>${compact(o.bank?.loans, currency)}</strong></div>
                <div class="list-row"><span>Status</span><span class="pill">${esc(o.bank?.status || 'unknown')}</span></div>
            </div>`)}
        </div>
        <div class="split" style="margin-top:16px">
            ${card('Goods market', 'Prices, stock and demand', table(['Good', 'Price', 'Change', 'Stock'], goods.map(good => [esc(good.label), esc(money(good.price_cents, currency)), `<span class="${n(good.change_bps) >= 0 ? 'positive' : 'negative'}">${pct(n(good.change_bps) / 100)}</span>`, esc(good.stock)])))}
            ${card('Public accounts', 'Treasury and listed equity', `<div class="list">
                <div class="list-row"><span>Treasury balance</span><strong>${compact(o.government?.balance, currency)}</strong></div>
                <div class="list-row"><span>Recorded revenue</span><strong>${compact(o.government?.revenue, currency)}</strong></div>
                <div class="list-row"><span>Recorded spending</span><strong>${compact(o.government?.spending, currency)}</strong></div>
                <div class="list-row"><span>Outstanding bonds</span><strong>${o.government?.bonds || 0}</strong></div>
                <div class="list-row"><span>Listed companies</span><strong>${o.stocks?.listed || 0}</strong></div>
                <div class="list-row"><span>Market capitalisation</span><strong>${compact(o.stocks?.marketCapCents, currency)}</strong></div>
            </div>`)}
        </div>`;
    const cycleButton = $('[data-action=cycle]');
    if (cycleButton) cycleButton.addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/cycle`, { method: 'POST' }); toast('Cycle completed'); await loadPage('overview'); } catch (error) { toast(error.message, true); }
    });
    const resetButton = $('[data-action=reset]');
    if (resetButton) resetButton.addEventListener('click', () => confirmPhrase('Restart economy', 'This deletes all wallets, companies, markets, crypto, loans, bonds, activity and history for this server. Configuration, permissions, channels and bug reports are kept.', `RESET ${state.guild.id}`, async () => {
        await api(`/api/guild/${state.guild.id}/reset`, { method: 'POST', body: JSON.stringify({ confirmation: `RESET ${state.guild.id}` }) });
        toast('Economy restarted');
        await loadPage('overview');
    }));
}
function renderMarket(data) {
    const currency = data.guild.currency;
    const goods = data.goods || [];
    const history = (data.history || []).map(row => row.price_index);
    $('#content').innerHTML = `${intro('The goods market is driven by inventory, recorded sales and price elasticity. Prices update at the end of every cycle.')}
        <div class="grid kpis">${kpi('Price index', (n(data.priceIndex) / 100).toFixed(2), 'rebased to 100.00')}${kpi('Inflation', pct(n(data.inflationBps) / 100), 'last cycle', n(data.inflationBps) >= 0 ? 'gold' : 'green')}${kpi('Traded goods', String(goods.length), 'active categories')}${kpi('Stock value', compact(goods.reduce((sum, good) => sum + n(good.stock) * n(good.price_cents), 0), currency), 'inventory at market price')}</div>
        <div class="split" style="margin-top:16px">${card('Consumer prices', 'Price index across completed cycles', `<div class="chart-wrap">${lineSvg(history, data.theme?.gold || '#e6c45a')}</div>`)}${card('Market pressure', 'Largest deviations from base price', `<div class="list">${goods.slice().sort((a, b) => Math.abs(n(b.change_bps)) - Math.abs(n(a.change_bps))).slice(0, 7).map(good => `<div><div class="list-row"><span>${esc(good.label)}</span><span class="${n(good.change_bps) >= 0 ? 'positive' : 'negative'}">${pct(n(good.change_bps) / 100)}</span></div><div class="bar"><span style="width:${Math.min(100, Math.abs(n(good.change_bps)) / 30)}%"></span></div></div>`).join('')}</div>`)}</div>
        ${card('Goods market', 'Current prices, demand and available stock', table(['Good', 'Price', 'Base change', 'Stock', 'Demand'], goods.map(good => [esc(good.label), esc(money(good.price_cents, currency)), `<span class="${n(good.change_bps) >= 0 ? 'positive' : 'negative'}">${pct(n(good.change_bps) / 100)}</span>`, esc(good.stock), esc(good.last_sales_volume)])))}`;
}
function renderStocks(data) {
    const currency = data.guild.currency;
    const listed = data.listed || [];
    $('#content').innerHTML = `${intro('Listed companies trade against a bid/ask spread with trade impact and a fee. The exchange is a primary market with company buybacks, not a peer-to-peer order book.')}
        <div class="grid kpis">${kpi('Listed companies', String(listed.length), 'public equity')}${kpi('Market capitalisation', compact(data.totalMarketCapCents, currency), 'last traded prices', 'gold')}${kpi('Top mover', data.movers?.[0] ? `${data.movers[0].ticker} ${pct(data.movers[0].change)}` : '—', data.movers?.[0]?.name || 'no listed equity', data.movers?.[0]?.change >= 0 ? 'green' : 'red')}${kpi('Cycle', String(data.cycle?.tick || 0), `every ${data.guild.cycleMinutes} minutes`)}</div>
        ${card('Listed equities', 'Prices, change and recorded price path', table(['Issuer', 'Price', 'Change', 'Market cap', 'Path'], listed.map(item => [`<span class="ticker">${esc(item.ticker)}</span> ${esc(item.name)}`, esc(money(item.lastCents, currency)), `<span class="${n(item.change) >= 0 ? 'positive' : 'negative'}">${pct(item.change)}</span>`, esc(compact(item.marketCapCents, currency)), sparkSvg((item.history || []).map(row => row.priceCents), n(item.change) >= 0 ? (data.theme?.accent || '#c9a227') : '#b34a4a')])))}`;
}
function renderCrypto(data) {
    const currency = data.guild.currency;
    const assets = data.assets || [];
    $('#content').innerHTML = `${intro('Coins and memecoins trade against local liquidity pools. Fees accrue to the treasury. Memecoins are volatile by design; pool liquidity limits redemptions.')}
        <div class="grid kpis">${kpi('Assets', String(assets.length), 'coins and memecoins')}${kpi('Market value', compact(assets.reduce((sum, asset) => sum + n(asset.marketCapCents), 0), currency), 'circulating supply at last price', 'gold')}${kpi('Pool liquidity', compact(assets.reduce((sum, asset) => sum + n(asset.reserveCents), 0), currency), 'available for redemptions')}${kpi('Best performer', assets[0] ? `${assets[0].symbol} ${pct(assets[0].change)}` : '—', assets[0]?.name || 'no assets', assets[0]?.change >= 0 ? 'green' : 'red')}</div>
        ${card('Digital assets', 'Coins, memecoins and local liquidity', table(['Asset', 'Price', 'Change', 'Market value', 'Path'], assets.map(asset => [`<span class="ticker">${esc(asset.symbol)}</span> ${esc(asset.name)}`, esc(`${currency} ${(n(asset.priceCents) / 100).toFixed(4)}`), `<span class="${n(asset.change) >= 0 ? 'positive' : 'negative'}">${pct(asset.change)}</span>`, esc(compact(asset.marketCapCents, currency)), sparkSvg((asset.history || []).map(row => row.priceCents), n(asset.change) >= 0 ? (data.theme?.accent || '#c9a227') : '#b34a4a')])))}`;
}
function renderCompanies(data, config) {
    const currency = data.guild.currency;
    const companies = data.companies || [];
    const sectors = config.sectors || [];
    const create = canManage() ? `<div class="form-section"><h3>Create a startup company</h3><p>The owner must have enough wallet funds for the licence and paid-in capital. New companies start private and can be listed later from Discord.</p><div class="form-grid" id="companyForm">
        <label>Company name<input name="name" required maxlength="40" placeholder="Norddeutsche Werke"></label>
        <label>Sector<select name="sector">${sectors.map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('')}</select></label>
        <label>Owner Discord ID<input name="ownerUserId" required value="${esc(state.session?.user?.id || '')}"></label>
        <label>Capital (${esc(currency)})<input name="capital" type="number" min="100" step="1" value="500"></label>
        <label class="full">Description<input name="description" maxlength="240" placeholder="What does this company do?"></label>
    </div><div class="form-actions"><button class="primary" id="createCompany">Create company</button></div></div>` : '';
    $('#content').innerHTML = `${intro('Companies are the production layer: they hire workers, buy inventory, sell goods, pay taxes and can distribute dividends. Startup creation here uses the same ledger and licence rules as the Discord command.')}
        ${card('Company registry', 'Active enterprises, cash, inventory and employment', table(['Company', 'Owner', 'Cash', 'Inventory', 'Staff', 'Jobs', 'State'], companies.map(company => [`<span class="ticker">${esc(company.ticker)}</span> ${esc(company.name)}`, esc(company.owner_user_id), esc(money(company.cash, currency)), esc(money(company.inventoryValue, currency)), esc(company.employees), esc(company.openJobs), `<span class="badge">${company.public ? 'LISTED' : 'PRIVATE'}</span>`])))} 
        <div class="card">${create}</div>`;
    const createButton = $('#createCompany');
    if (createButton) createButton.addEventListener('click', async () => {
        const form = $('#companyForm');
        const values = Object.fromEntries(new FormData(form).entries());
        values.capital = Math.round(Number(values.capital) * 100);
        try {
            await api(`/api/guild/${state.guild.id}/companies`, { method: 'POST', body: JSON.stringify(values) });
            toast('Company created');
            await loadPage('companies');
        } catch (error) { toast(error.message, true); }
    });
}
function renderNews(data) {
    const signals = data.signals || [];
    const bindings = data.signalChannels || [];
    const keys = data.signalKeys || ['news', 'announcements'];
    const totalImpact = signals.filter(signal => signal.status === 'ready').reduce((sum, signal) => sum + Math.abs(n(signal.impact_bps)), 0);
    const signalRows = signals.map(signal => [
        `<span class="badge">${esc(signal.sentiment)}</span>`,
        `<span class="${n(signal.impact_bps) >= 0 ? 'positive' : 'negative'}">${n(signal.impact_bps) >= 0 ? '+' : ''}${esc(signal.impact_bps)} bps</span>`,
        esc((signal.goods || []).join(', ') || 'all goods'),
        esc(signal.summary || signal.headline || ''),
        esc(when(signal.created_at)),
        esc(signal.status),
    ]);
    const bindingRows = bindings.map(row => [esc(row.signal_key), `#${esc(row.channel_id)}`, canManage() ? `<button class="ghost remove-signal" data-key="${esc(row.signal_key)}">Unbind</button>` : '']);
    $('#content').innerHTML = `${intro('The bot stores server message history. Messages in <strong>news</strong> and <strong>announcements</strong> channels are investigated by Jarvis, assigned a sentiment and basis-point impact, and applied to goods and stock prices on the next economic cycle. This is intentionally volatile and should be used for real server events, emergencies, wars, strikes, shortages and major announcements.', canManage() ? `<button class="primary" id="newsProcess">Apply ready signals now</button>` : '')}
        <div class="grid kpis">${kpi('Signal channels', String(bindings.length), 'news and announcements')}${kpi('Analysed signals', String(signals.length), 'recent intelligence')}${kpi('Ready pressure', `${totalImpact} bps`, 'absolute pending impact', 'gold')}${kpi('Last signal', signals[0] ? when(signals[0].created_at) : '—', signals[0]?.status || 'none')}</div>
        ${card('Signal channels', 'Jarvis reads these channels and derives market pressure', table(['Channel type', 'Discord channel', ''], bindingRows))}
        ${canManage() ? `<div class="card"><h3 class="card-title">Bind a signal channel</h3><div class="card-sub">News and announcements are analysed automatically. Announcements can be used for government / server-wide events; news for external or market news.</div><div class="inline-form"><select id="signalKey">${keys.map(key => `<option value="${esc(key)}">${esc(key)}</option>`).join('')}</select><input id="signalChannel" placeholder="Channel id"><button class="primary" id="bindSignal">Bind signal channel</button></div></div>` : ''}
        ${card('Market intelligence', 'Recent analysed messages and their price pressure', table(['Sentiment', 'Impact', 'Goods', 'Summary', 'Time', 'Status'], signalRows, 'No news signals yet. Bind a news channel and post an announcement.'))}`;
    $$('.remove-signal').forEach(button => button.addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/signals/${button.dataset.key}`, { method: 'DELETE' }); toast('Signal channel unbound'); await loadPage('news'); } catch (error) { toast(error.message, true); }
    }));
    if ($('#bindSignal')) $('#bindSignal').addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/signals`, { method: 'POST', body: JSON.stringify({ signal_key: $('#signalKey').value, channel_id: $('#signalChannel').value.trim() }) }); toast('Signal channel bound'); await loadPage('news'); } catch (error) { toast(error.message, true); }
    });
    if ($('#newsProcess')) $('#newsProcess').addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/news/analyze`, { method: 'POST' }); toast('Ready signals applied to the next cycle'); await loadPage('news'); } catch (error) { toast(error.message, true); }
    });
}
function renderSocial(data) {
    const currency = data.guild.currency;
    const wealth = data.wealth || [];
    const reputation = data.reputation || [];
    const activity = data.activity || [];
    $('#content').innerHTML = `${intro('Public reputation uses explicit <strong>rep</strong> ratings and observed activity. It is not private sentiment analysis. Role history and message counts are collected only while the bot is present.')}
        <div class="grid kpis">${kpi('Tracked members', String(activity.length), 'observed activity')}${kpi('Wealth leader', wealth[0] ? wealth[0].name : '—', wealth[0] ? compact(wealth[0].total, currency) : 'no data', 'gold')}${kpi('Reputation leader', reputation[0] ? `@${reputation[0].target_id}` : '—', reputation[0] ? `${reputation[0].score >= 0 ? '+' : ''}${reputation[0].score}` : 'no ratings')}${kpi('Public standing', String(reputation.length), 'members with ratings')}</div>
        <div class="split" style="margin-top:16px">${card('Wealth ranking', 'Household balance sheets', table(['#', 'Member', 'Total'], wealth.map((row, index) => [String(index + 1), esc(row.name), esc(compact(row.total, currency))])))}${card('Reputation ranking', 'Public standing and rating count', table(['#', 'Member', 'Score', 'Ratings'], reputation.map((row, index) => [String(index + 1), esc(row.target_id), `<span class="${n(row.score) >= 0 ? 'positive' : 'negative'}">${n(row.score) >= 0 ? '+' : ''}${esc(row.score)}</span>`, esc(row.total)])))}</div>
        ${card('Observed activity', 'Message counts and last seen', table(['Member', 'Messages', 'Reactions', 'Last seen'], activity.map(row => [esc(row.display_name || row.user_id), esc(row.message_count), esc(row.reactions_received), esc(when(row.last_message_at))])))}
        <div class="card" style="margin-top:16px"><h3 class="card-title">Member lookup</h3><div class="card-sub">Inspect a member by Discord user ID</div><div class="inline-form"><input id="memberInlineInput" placeholder="Discord user id"><button class="primary" id="memberInlineButton">Look up</button></div><div id="memberInlineResult" class="member-result muted"></div></div>`;
    $('#memberInlineButton').addEventListener('click', () => lookupMember($('#memberInlineInput').value, $('#memberInlineResult')));
}
function renderTreasury(data) {
    const currency = data.guild.currency;
    const gov = data.overview.government || {};
    const taxes = data.guild.taxes || {};
    $('#content').innerHTML = `${intro('The treasury receives taxes, fees and bond proceeds. It pays procurement, salaries, bond interest and redemptions. Bonds are obligations of the server government, not of the bot.')}
        <div class="grid kpis">${kpi('Treasury', compact(gov.balance, currency), 'current balance', 'gold')}${kpi('Revenue', compact(gov.revenue, currency), 'recorded receipts')}${kpi('Spending', compact(gov.spending, currency), 'recorded outlays')}${kpi('Bonds', String(gov.bonds || 0), compact(gov.bondFace, currency) + ' face')}</div>
        <div class="split" style="margin-top:16px">${card('Fiscal position', 'Tax and monetary settings', `<div class="list"><div class="list-row"><span>Income tax</span><strong>${bps(taxes.incomeBps)}</strong></div><div class="list-row"><span>Corporate tax</span><strong>${bps(taxes.corporateBps)}</strong></div><div class="list-row"><span>Payroll tax</span><strong>${bps(taxes.payrollBps)}</strong></div><div class="list-row"><span>VAT</span><strong>${bps(taxes.vatBps)}</strong></div><div class="list-row"><span>Wealth tax</span><strong>${bps(taxes.wealthBps)}</strong></div><div class="list-row"><span>Policy rate</span><strong>${bps(data.guild.policyRateBps)}</strong></div></div>`)}${card('Institutions', 'Server configuration', `<div class="list"><div class="list-row"><span>Central bank</span><strong>${esc(data.guild.bank)}</strong></div><div class="list-row"><span>Government</span><strong>${esc(data.guild.government)}</strong></div><div class="list-row"><span>Reserve ratio</span><strong>${bps(data.guild.reserveRatioBps)}</strong></div><div class="list-row"><span>Work cooldown</span><strong>${data.guild.workCooldownMin} min</strong></div><div class="list-row"><span>Cycle</span><strong>${data.guild.cycleMinutes} min</strong></div></div>`)}</div>`;
}
function renderPermissions(data) {
    const powers = data.powerKeys || [];
    const labels = data.powerLabels || {};
    const roles = data.roles || [];
    const roleOptions = roles.length ? roles.map(role => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join('') : '<option value="">Enter role id below</option>';
    const appointmentRows = (data.appointments || []).map(row => [`<@${esc(row.user_id)}>`, esc(row.label || row.office), esc((row.powers || []).join(', ')), esc(row.expires_at ? when(row.expires_at) : 'never'), canManage() ? `<button class="ghost remove-appointment" data-user="${esc(row.user_id)}">Remove</button>` : '']);
    const roleRows = (data.rolePowers || []).map(row => [`<@&${esc(row.role_id)}>`, esc((row.powers || []).join(', ')), canManage() ? `<button class="ghost remove-role" data-role="${esc(row.role_id)}">Remove</button>` : '']);
    $('#content').innerHTML = `${intro('Permissions control delegated bot authority. Discord Administrators and the server owner always have full authority. Appointments and role mappings are separate from Discord roles and can be revoked here.')}
        ${card('Role authority', 'Grant bot powers to Discord roles', table(['Role', 'Powers', ''], roleRows))}
        ${canManage() ? `<div class="card"><div class="form-section"><h3>Assign role authority</h3><p>Select a Discord role and the bot powers it should hold.</p><div class="form-grid"><label>Role<select id="permissionRole">${roleOptions}</select></label><label>Or role ID<input id="permissionRoleId" placeholder="123456789012345678"></label></div><div class="check-grid" style="margin-top:12px">${powers.map(power => `<label><input type="checkbox" name="permissionPower" value="${esc(power)}"> ${esc(labels[power] || power)}</label>`).join('')}</div><div class="form-actions"><button class="primary" id="savePermissionRole">Save role authority</button></div></div></div>` : ''}
        ${card('Appointments', 'Personal offices with expiry', table(['Member', 'Office', 'Powers', 'Expires', ''], appointmentRows))}
        ${canManage() ? `<div class="card"><div class="form-section"><h3>Appoint a member</h3><p>Appointments are personal and can expire. The office template supplies its powers.</p><div class="form-grid"><label>Discord user ID<input id="appointmentUser"></label><label>Office<select id="appointmentOffice">${Object.entries(data.offices || {}).map(([key, office]) => `<option value="${esc(key)}">${esc(office.label)}</option>`).join('')}</select></label><label>Expires in days<input id="appointmentDays" type="number" min="0" placeholder="0 = never"></label></div><div class="form-actions"><button class="primary" id="saveAppointment">Appoint</button></div></div></div>` : ''}`;
    $$('.remove-role').forEach(button => button.addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/permissions/role/${button.dataset.role}`, { method: 'DELETE' }); toast('Role authority removed'); await loadPage('permissions'); } catch (error) { toast(error.message, true); }
    }));
    $$('.remove-appointment').forEach(button => button.addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/permissions/appoint/${button.dataset.user}`, { method: 'DELETE' }); toast('Appointment removed'); await loadPage('permissions'); } catch (error) { toast(error.message, true); }
    }));
    if ($('#savePermissionRole')) $('#savePermissionRole').addEventListener('click', async () => {
        const roleId = $('#permissionRoleId').value.trim() || $('#permissionRole').value;
        const selected = $$('input[name=permissionPower]:checked').map(input => input.value);
        try { await api(`/api/guild/${state.guild.id}/permissions/role`, { method: 'POST', body: JSON.stringify({ roleId, powers: selected }) }); toast('Role authority saved'); await loadPage('permissions'); } catch (error) { toast(error.message, true); }
    });
    if ($('#saveAppointment')) $('#saveAppointment').addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/permissions/appoint`, { method: 'POST', body: JSON.stringify({ userId: $('#appointmentUser').value.trim(), office: $('#appointmentOffice').value, days: Number($('#appointmentDays').value) || 0 }) }); toast('Appointment saved'); await loadPage('permissions'); } catch (error) { toast(error.message, true); }
    });
}
function renderConfig(data) {
    const g = data.guild;
    const choices = data.styleChoices || [];
    const feeds = data.feeds || [];
    const signals = data.signalChannels || [];
    const feedOptions = (data.feedKeys || []).map(key => `<option value="${esc(key)}">${esc(key)}</option>`).join('');
    const signalOptions = (data.signalKeys || ['news', 'announcements']).map(key => `<option value="${esc(key)}">${esc(key)}</option>`).join('');
    const custom = g.styleCustom || {};
    const theme = custom.theme || {};
    const channelRows = feeds.map(feed => [esc(feed.feed_key), esc(feed.channel_id), esc(feed.message_id || 'not posted'), canManage() ? `<button class="ghost remove-feed" data-feed="${esc(feed.feed_key)}">Unbind</button>` : '']);
    const signalRows = signals.map(row => [esc(row.signal_key), `#${esc(row.channel_id)}`, canManage() ? `<button class="ghost remove-signal" data-key="${esc(row.signal_key)}">Unbind</button>` : '']);
    const editable = canManage();
    $('#content').innerHTML = `${intro('This page writes directly to the server economy configuration. Changes are audited. Discord commands remain available for the same operations. Custom theme values override the selected preset without changing the preset data.')}
        <div class="card"><div class="form-section"><h3>Identity and model</h3><p>Theme presets set currency, institution names and, for command economies, tax defaults.</p><div class="form-grid">
            <label>Theme preset<select id="configStyle">${choices.map(choice => `<option value="${esc(choice.value)}" ${String(g.styleKey) === choice.value ? 'selected' : ''}>${esc(choice.name)}</option>`).join('')}</select></label>
            <label>Economic model<select id="configModel">${['market','social_market','mixed','state_led'].map(model => `<option value="${model}" ${g.model === model ? 'selected' : ''}>${esc(statusText(model))}</option>`).join('')}</select></label>
            <label>Currency code<input id="configCurrency" maxlength="3" value="${esc(g.currency)}"></label>
            <label>Prefix<input id="configPrefix" maxlength="3" value="${esc(g.prefix)}"></label>
            <label>Central bank<input id="configBank" value="${esc(g.bank)}"></label>
            <label>Government<input id="configGov" value="${esc(g.government)}"></label>
        </div></div>
        <div class="form-section"><h3>Taxes and monetary policy</h3><p>Percent fields are stored as basis points. Taxes apply to future activity.</p><div class="form-grid">
            <label>Income tax %<input id="taxIncome" type="number" step="0.01" value="${(n(g.taxes?.incomeBps) / 100).toFixed(2)}"></label>
            <label>Corporate tax %<input id="taxCorporate" type="number" step="0.01" value="${(n(g.taxes?.corporateBps) / 100).toFixed(2)}"></label>
            <label>Payroll tax %<input id="taxPayroll" type="number" step="0.01" value="${(n(g.taxes?.payrollBps) / 100).toFixed(2)}"></label>
            <label>VAT %<input id="taxVat" type="number" step="0.01" value="${(n(g.taxes?.vatBps) / 100).toFixed(2)}"></label>
            <label>Wealth tax %<input id="taxWealth" type="number" step="0.01" value="${(n(g.taxes?.wealthBps) / 100).toFixed(2)}"></label>
            <label>Policy rate %<input id="configRate" type="number" step="0.01" value="${(n(g.policyRateBps) / 100).toFixed(2)}"></label>
            <label>Reserve ratio %<input id="configReserve" type="number" step="0.01" value="${(n(g.reserveRatioBps) / 100).toFixed(2)}"></label>
        </div></div>
        <div class="form-section"><h3>Schedule and access</h3><div class="form-grid">
            <label>Cycle minutes<input id="configCycle" type="number" min="1" value="${g.cycleMinutes}"></label>
            <label>Work cooldown minutes<input id="configWork" type="number" min="1" value="${g.workCooldownMin}"></label>
            <label>Starter balance (${esc(g.currency)})<input id="configStarter" type="number" min="0" step="0.01" value="${(n(g.starterCents) / 100).toFixed(2)}"></label>
            <label>Jarvis daily limit<input id="configJarvis" type="number" min="1" value="${g.jarvisLimit || 5}"></label>
            <label>Welfare rate %<input id="configWelfare" type="number" step="0.01" value="${(n(g.welfareBps) / 100).toFixed(2)}"></label>
            <label>Central bank independence<input id="configIndependence" type="number" min="0" max="100" value="${g.centralBankIndependence ?? 90}"></label>
            <label>Market openness<input id="configOpenness" type="number" min="0" max="100" value="${g.marketOpenness ?? 100}"></label>
        </div></div>
        <div class="form-section"><h3>Custom theme override</h3><p>Optional. These values are merged over the selected preset and can make a server-specific identity.</p><div class="form-grid">
            <label>Display label<input id="customLabel" value="${esc(custom.label || '')}" placeholder="Server identity"></label>
            <label>Footer<input id="customFooter" value="${esc(custom.footer || '')}" placeholder="Custom footer"></label>
            <label>Palette accent<input id="customAccent" value="${esc(theme.accent || '')}" placeholder="#c9a227"></label>
            <label>Palette gold<input id="customGold" value="${esc(theme.gold || '')}" placeholder="#e6c45a"></label>
            <label>Background<input id="customBackground" value="${esc(theme.background || '')}" placeholder="#0f0d0a"></label>
            <label>Surface<input id="customSurface" value="${esc(theme.surface || '')}" placeholder="#1a1712"></label>
            <label>Text<input id="customText" value="${esc(theme.text || '')}" placeholder="#f2ead8"></label>
            <label>Seal / short mark<input id="customSeal" value="${esc(theme.seal || '')}" placeholder="1914"></label>
        </div></div>
        <div class="form-actions"><button class="primary" id="saveConfig" ${editable ? '' : 'disabled'}>Save configuration</button></div></div>
        ${card('Update feeds', 'Bind a feed to a channel. The bot posts once and edits the same message each cycle.', table(['Feed', 'Channel', 'Message', ''], channelRows) + (editable ? `<div class="inline-form"><select id="feedKey">${feedOptions}</select><input id="feedChannel" placeholder="Channel id"><button class="primary" id="bindFeed">Bind</button></div>` : ''))}
        ${card('News & signal channels', 'Jarvis reads these channels and applies market pressure on the next cycle.', table(['Type', 'Channel', ''], signalRows) + (editable ? `<div class="inline-form"><select id="signalKey">${signalOptions}</select><input id="signalChannel" placeholder="Channel id"><button class="primary" id="bindSignal">Bind signal channel</button></div>` : ''))}
        ${editable ? `<div class="card" style="margin-top:16px"><h3 class="card-title">Danger zone</h3><div class="card-sub">Run the next cycle manually, reset the economy, or clear Jarvis usage.</div><div class="page-actions"><button class="primary" id="manualCycle">Run cycle</button><button class="ghost" id="drawLottery">Draw lottery</button><button class="danger" id="resetEconomy">Restart economy…</button></div><div class="inline-form"><input id="resetJarvisUser" placeholder="Optional user id for Jarvis reset"><button class="ghost" id="resetJarvis">Reset Jarvis usage</button></div></div>` : ''}`;
    const save = $('#saveConfig');
    if (save) save.addEventListener('click', async () => {
        const styleCustom = {};
        if ($('#customLabel').value.trim()) styleCustom.label = $('#customLabel').value.trim();
        if ($('#customFooter').value.trim()) styleCustom.footer = $('#customFooter').value.trim();
        const customTheme = {};
        for (const [key, id] of Object.entries({ accent: 'customAccent', gold: 'customGold', background: 'customBackground', surface: 'customSurface', text: 'customText', seal: 'customSeal' })) {
            if ($('#' + id).value.trim()) customTheme[key] = $('#' + id).value.trim();
        }
        if (Object.keys(customTheme).length) styleCustom.theme = customTheme;
        const body = {
            style_key: $('#configStyle').value,
            model: $('#configModel').value,
            currency: $('#configCurrency').value.toUpperCase(),
            prefix: $('#configPrefix').value,
            central_bank_name: $('#configBank').value,
            government_name: $('#configGov').value,
            income_tax_bps: Math.round(Number($('#taxIncome').value) * 100),
            corporate_tax_bps: Math.round(Number($('#taxCorporate').value) * 100),
            payroll_tax_bps: Math.round(Number($('#taxPayroll').value) * 100),
            vat_bps: Math.round(Number($('#taxVat').value) * 100),
            wealth_tax_bps: Math.round(Number($('#taxWealth').value) * 100),
            policy_rate_bps: Math.round(Number($('#configRate').value) * 100),
            reserve_ratio_bps: Math.round(Number($('#configReserve').value) * 100),
            cycle_minutes: Number($('#configCycle').value),
            work_cooldown_min: Number($('#configWork').value),
            starter_balance: Math.round(Number($('#configStarter').value) * 100),
            jarvis_limit: Number($('#configJarvis').value),
            welfare_bps: Math.round(Number($('#configWelfare').value) * 100),
            central_bank_independence: Number($('#configIndependence').value),
            market_openness: Number($('#configOpenness').value),
            style_custom: Object.keys(styleCustom).length ? styleCustom : null,
        };
        try { await api(`/api/guild/${state.guild.id}/config`, { method: 'PATCH', body: JSON.stringify(body) }); toast('Configuration saved'); await loadPage('config'); } catch (error) { toast(error.message, true); }
    });
    $$('.remove-feed').forEach(button => button.addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/channels/${button.dataset.feed}`, { method: 'DELETE' }); toast('Feed unbound'); await loadPage('config'); } catch (error) { toast(error.message, true); }
    }));
    if ($('#bindFeed')) $('#bindFeed').addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/channels`, { method: 'POST', body: JSON.stringify({ feed_key: $('#feedKey').value, channel_id: $('#feedChannel').value.trim() }) }); toast('Feed bound'); await loadPage('config'); } catch (error) { toast(error.message, true); }
    });
    $$('.remove-signal').forEach(button => button.addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/signals/${button.dataset.key}`, { method: 'DELETE' }); toast('Signal channel unbound'); await loadPage('config'); } catch (error) { toast(error.message, true); }
    }));
    if ($('#bindSignal')) $('#bindSignal').addEventListener('click', async () => {
        try { await api(`/api/guild/${state.guild.id}/signals`, { method: 'POST', body: JSON.stringify({ signal_key: $('#signalKey').value, channel_id: $('#signalChannel').value.trim() }) }); toast('Signal channel bound'); await loadPage('config'); } catch (error) { toast(error.message, true); }
    });
    if ($('#manualCycle')) $('#manualCycle').addEventListener('click', async () => { try { await api(`/api/guild/${state.guild.id}/cycle`, { method: 'POST' }); toast('Cycle completed'); await loadPage('config'); } catch (error) { toast(error.message, true); } });
    if ($('#drawLottery')) $('#drawLottery').addEventListener('click', async () => { try { await api(`/api/guild/${state.guild.id}/lottery/draw`, { method: 'POST' }); toast('Lottery draw complete'); await loadPage('config'); } catch (error) { toast(error.message, true); } });
    if ($('#resetJarvis')) $('#resetJarvis').addEventListener('click', async () => { try { await api(`/api/guild/${state.guild.id}/jarvis/reset`, { method: 'POST', body: JSON.stringify({ userId: $('#resetJarvisUser').value.trim() || null }) }); toast('Jarvis usage reset'); } catch (error) { toast(error.message, true); } });
    if ($('#resetEconomy')) $('#resetEconomy').addEventListener('click', () => confirmPhrase('Restart economy', 'This deletes wallets, companies, markets, crypto, loans, bonds, activity and history for this server. Configuration, permissions, channels and bug reports are kept.', `RESET ${state.guild.id}`, async () => {
        await api(`/api/guild/${state.guild.id}/reset`, { method: 'POST', body: JSON.stringify({ confirmation: `RESET ${state.guild.id}` }) });
        toast('Economy restarted');
        await loadPage('config');
    }));
}
function renderAudit(data) {
    const rows = (data.entries || []).map(row => [esc(when(row.created_at)), esc(row.action), esc(row.actor_id || 'system'), esc(String(row.detail || '').slice(0, 200))]);
    $('#content').innerHTML = `${intro('Every dashboard and Discord mutation is written to the audit trail. Use this to see who changed taxes, channels, permissions, cycles and economy state.')}${card('Audit trail', 'Recent administrative actions', table(['Time', 'Action', 'Actor', 'Detail'], rows))}`;
}
async function lookupMember(id, target) {
    if (!state.guild) return;
    const userId = String(id || '').trim();
    if (!/^\d{5,25}$/.test(userId)) { target.innerHTML = '<span class="negative">Enter a valid Discord user id.</span>'; return; }
    target.innerHTML = '<span class="faint">Loading member…</span>';
    try {
        const data = await api(`/api/guild/${state.guild.id}/member/${userId}`);
        const member = data.member;
        target.innerHTML = `<h3>${esc(member.name || member.id)}</h3><div class="list">
            <div class="list-row"><span>Wallet</span><strong>${money(member.walletCents, data.guild.currency)}</strong></div>
            <div class="list-row"><span>Deposits</span><strong>${money(member.depositCents, data.guild.currency)}</strong></div>
            <div class="list-row"><span>Loans</span><strong>${money(member.loanCents, data.guild.currency)}</strong></div>
            <div class="list-row"><span>Credit score</span><strong>${member.creditScore}</strong></div>
            <div class="list-row"><span>Messages observed</span><strong>${member.activity?.messageCount || 0}</strong></div>
            <div class="list-row"><span>Reputation</span><strong>${member.reputation?.score >= 0 ? '+' : ''}${member.reputation?.score || 0}</strong></div>
            <div class="list-row"><span>Role history events</span><strong>${(member.reputation?.events || []).length}</strong></div>
        </div>
        ${state.session?.developer ? `<div class="form-section"><h3>Developer wallet adjustment</h3><p>Mints or destroys currency through the double-entry ledger. Use with care.</p><div class="inline-form"><input id="adjustAmount" type="number" step="0.01" placeholder="Amount ${esc(data.guild.currency)}"><input id="adjustReason" placeholder="Reason"><button class="primary" id="creditMember">Credit</button><button class="danger" id="debitMember">Debit</button></div></div>` : ''}`;
        if ($('#creditMember')) {
            $('#creditMember').addEventListener('click', () => adjustMember(userId, 'credit'));
            $('#debitMember').addEventListener('click', () => adjustMember(userId, 'debit'));
        }
    } catch (error) { target.innerHTML = `<span class="negative">${esc(error.message)}</span>`; }
}
async function adjustMember(userId, direction) {
    const amount = Math.round(Number($('#adjustAmount').value) * 100);
    const reason = $('#adjustReason').value.trim();
    try {
        await api(`/api/guild/${state.guild.id}/member/${userId}/adjust`, { method: 'POST', body: JSON.stringify({ amountCents: amount, direction, reason }) });
        toast(`Wallet ${direction === 'credit' ? 'credited' : 'debited'}`);
        await loadPage(state.page);
    } catch (error) { toast(error.message, true); }
}
boot();
