'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
    DEFAULT_PREFIX,
    CYCLE_MINUTES_DEFAULT,
    WORK_COOLDOWN_MIN_DEFAULT,
    STARTER_BALANCE_MINOR,
    JARVIS_DAILY_LIMIT,
    modelPreset,
    currencyPreset,
} = require('./config');
const { nowIso } = require('./money');
const style = require('./style');

const DB_PATH = process.env.ECON_DB_PATH
    ? path.resolve(process.env.ECON_DB_PATH)
    : path.join(__dirname, '..', 'data', 'economy.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    prefix TEXT NOT NULL DEFAULT '-',
    style_key TEXT,
    style_custom TEXT,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    currency_name TEXT NOT NULL DEFAULT 'US dollar',
    currency_symbol TEXT NOT NULL DEFAULT 'USD',
    model TEXT NOT NULL DEFAULT 'market',
    central_bank_name TEXT NOT NULL DEFAULT 'State Bank',
    government_name TEXT NOT NULL DEFAULT 'Treasury',
    income_tax_bps INTEGER NOT NULL DEFAULT 1500,
    corporate_tax_bps INTEGER NOT NULL DEFAULT 2100,
    payroll_tax_bps INTEGER NOT NULL DEFAULT 1200,
    vat_bps INTEGER NOT NULL DEFAULT 800,
    wealth_tax_bps INTEGER NOT NULL DEFAULT 0,
    policy_rate_bps INTEGER NOT NULL DEFAULT 300,
    reserve_ratio_bps INTEGER NOT NULL DEFAULT 1000,
    welfare_bps INTEGER NOT NULL DEFAULT 300,
    central_bank_independence INTEGER NOT NULL DEFAULT 90,
    market_openness INTEGER NOT NULL DEFAULT 100,
    work_cooldown_min INTEGER NOT NULL DEFAULT 480,
    cycle_minutes INTEGER NOT NULL DEFAULT 60,
    starter_balance INTEGER NOT NULL DEFAULT 100000,
    jarvis_limit INTEGER NOT NULL DEFAULT 5,
    log_channel_id TEXT,
    last_cycle_at TEXT,
    last_cycle_tick INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (guild_id, owner_type, owner_id, kind)
);

CREATE TABLE IF NOT EXISTS profiles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    credit_score INTEGER NOT NULL DEFAULT 650,
    last_work_at TEXT,
    last_daily_at TEXT,
    last_rob_at TEXT,
    total_income INTEGER NOT NULL DEFAULT 0,
    total_tax INTEGER NOT NULL DEFAULT 0,
    total_interest INTEGER NOT NULL DEFAULT 0,
    starter_granted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    actor_id TEXT,
    memo TEXT NOT NULL DEFAULT '',
    metadata TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    tx_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tx_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS role_powers (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    powers TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, role_id)
);

CREATE TABLE IF NOT EXISTS appointments (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    office TEXT NOT NULL,
    label TEXT NOT NULL,
    powers TEXT NOT NULL,
    appointed_by TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    ticker TEXT NOT NULL,
    sector TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    shares_outstanding INTEGER NOT NULL DEFAULT 1000000,
    share_price_cents INTEGER NOT NULL DEFAULT 100,
    last_price_cents INTEGER NOT NULL DEFAULT 100,
    public INTEGER NOT NULL DEFAULT 0,
    publicly_listed_at TEXT,
    revenue_cents INTEGER NOT NULL DEFAULT 0,
    expenses_cents INTEGER NOT NULL DEFAULT 0,
    wages_cents INTEGER NOT NULL DEFAULT 0,
    taxes_cents INTEGER NOT NULL DEFAULT 0,
    dividends_cents INTEGER NOT NULL DEFAULT 0,
    last_profit_cents INTEGER NOT NULL DEFAULT 0,
    last_tax_cents INTEGER NOT NULL DEFAULT 0,
    price_modifier_bps INTEGER NOT NULL DEFAULT 10000,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (guild_id, ticker)
);

CREATE TABLE IF NOT EXISTS share_holdings (
    guild_id TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    shares INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, company_id, user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    wage_cents INTEGER NOT NULL,
    slots INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employment (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    job_id INTEGER NOT NULL,
    wage_cents INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS inventory (
    guild_id TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    good_key TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, company_id, good_key)
);

CREATE TABLE IF NOT EXISTS goods_market (
    guild_id TEXT NOT NULL,
    good_key TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    supply INTEGER NOT NULL DEFAULT 0,
    demand INTEGER NOT NULL DEFAULT 0,
    sales_volume INTEGER NOT NULL DEFAULT 0,
    last_sales_volume INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, good_key)
);

CREATE TABLE IF NOT EXISTS company_flows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    revenue_cents INTEGER NOT NULL DEFAULT 0,
    expenses_cents INTEGER NOT NULL DEFAULT 0,
    wages_cents INTEGER NOT NULL DEFAULT 0,
    taxes_cents INTEGER NOT NULL DEFAULT 0,
    profit_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    market_cap_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    borrower_type TEXT NOT NULL,
    borrower_id TEXT NOT NULL,
    principal_cents INTEGER NOT NULL,
    balance_cents INTEGER NOT NULL,
    rate_bps INTEGER NOT NULL,
    term_cycles INTEGER NOT NULL,
    payment_cents INTEGER NOT NULL,
    cycles_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    next_due_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    loan_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    interest_cents INTEGER NOT NULL,
    principal_cents INTEGER NOT NULL,
    paid_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bonds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    holder_id TEXT NOT NULL,
    face_cents INTEGER NOT NULL,
    rate_bps INTEGER NOT NULL,
    term_cycles INTEGER NOT NULL,
    cycles_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    next_due_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    tick INTEGER NOT NULL,
    at TEXT NOT NULL,
    gdp_cents INTEGER NOT NULL DEFAULT 0,
    consumption_cents INTEGER NOT NULL DEFAULT 0,
    investment_cents INTEGER NOT NULL DEFAULT 0,
    government_cents INTEGER NOT NULL DEFAULT 0,
    wages_cents INTEGER NOT NULL DEFAULT 0,
    inventory_cents INTEGER NOT NULL DEFAULT 0,
    money_supply_cents INTEGER NOT NULL DEFAULT 0,
    treasury_cents INTEGER NOT NULL DEFAULT 0,
    price_index INTEGER NOT NULL DEFAULT 10000,
    employed INTEGER NOT NULL DEFAULT 0,
    workforce INTEGER NOT NULL DEFAULT 0,
    unemployment_bps INTEGER NOT NULL DEFAULT 0,
    policy_rate_bps INTEGER NOT NULL DEFAULT 0,
    stock_market_cap_cents INTEGER NOT NULL DEFAULT 0,
    company_count INTEGER NOT NULL DEFAULT 0,
    bank_vault_cents INTEGER NOT NULL DEFAULT 0,
    deposits_cents INTEGER NOT NULL DEFAULT 0,
    loans_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jarvis_usage (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, day)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'goods',
    item_type TEXT NOT NULL DEFAULT 'collectible',
    price_cents INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    value_cents INTEGER NOT NULL DEFAULT 0,
    income_cents INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (guild_id, name)
);

CREATE TABLE IF NOT EXISTS user_items (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, item_id)
);

CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_id INTEGER,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'property',
    value_cents INTEGER NOT NULL DEFAULT 0,
    income_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lottery (
    guild_id TEXT PRIMARY KEY,
    jackpot_cents INTEGER NOT NULL DEFAULT 0,
    ticket_price_cents INTEGER NOT NULL DEFAULT 0,
    draw_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    last_winner_id TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lottery_tickets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tickets INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    winning_option TEXT,
    created_at TEXT NOT NULL,
    settled_at TEXT
);

CREATE TABLE IF NOT EXISTS bet_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    choice TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (bet_id, user_id)
);

CREATE TABLE IF NOT EXISTS crypto_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'coin',
    description TEXT NOT NULL DEFAULT '',
    creator_user_id TEXT,
    price_cents INTEGER NOT NULL DEFAULT 1,
    reserve_cents INTEGER NOT NULL DEFAULT 0,
    supply INTEGER NOT NULL DEFAULT 0,
    volatility_bps INTEGER NOT NULL DEFAULT 500,
    fee_bps INTEGER NOT NULL DEFAULT 100,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (guild_id, symbol)
);

CREATE TABLE IF NOT EXISTS crypto_holdings (
    guild_id TEXT NOT NULL,
    asset_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, asset_id, user_id)
);

CREATE TABLE IF NOT EXISTS crypto_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    asset_id INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    reserve_cents INTEGER NOT NULL,
    supply INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    asset_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    side TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_bindings (
    guild_id TEXT NOT NULL,
    feed_key TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, feed_key)
);

CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT,
    user_id TEXT NOT NULL,
    command TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    expected TEXT NOT NULL DEFAULT '',
    actual TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    analysis TEXT,
    html_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_activity (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    message_count INTEGER NOT NULL DEFAULT 0,
    reactions_received INTEGER NOT NULL DEFAULT 0,
    first_seen_at TEXT NOT NULL,
    last_message_at TEXT,
    last_channel_id TEXT,
    PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS member_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reputation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    giver_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS message_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (guild_id, message_id)
);

CREATE TABLE IF NOT EXISTS signal_channels (
    guild_id TEXT NOT NULL,
    signal_key TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, signal_key)
);

CREATE TABLE IF NOT EXISTS news_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    headline TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    impact_bps INTEGER NOT NULL DEFAULT 0,
    goods TEXT,
    sectors TEXT,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    processed_at TEXT,
    UNIQUE (guild_id, message_id)
);

CREATE TABLE IF NOT EXISTS jarvis_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_guild_owner ON accounts(guild_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_ledger_guild_tx ON ledger_entries(guild_id, tx_id);
CREATE INDEX IF NOT EXISTS idx_transactions_guild ON transactions(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_companies_guild ON companies(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_guild_company ON jobs(guild_id, company_id, active);
CREATE INDEX IF NOT EXISTS idx_loans_guild_status ON loans(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_snapshots_guild_tick ON snapshots(guild_id, tick);
CREATE INDEX IF NOT EXISTS idx_stock_prices_company ON stock_prices(guild_id, company_id, tick);
CREATE INDEX IF NOT EXISTS idx_flows_company ON company_flows(guild_id, company_id, tick);
CREATE INDEX IF NOT EXISTS idx_crypto_prices_asset ON crypto_prices(guild_id, asset_id, tick);
CREATE INDEX IF NOT EXISTS idx_crypto_holdings_user ON crypto_holdings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_messages_user ON jarvis_messages(guild_id, user_id, id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_guild ON bug_reports(guild_id, id);
CREATE INDEX IF NOT EXISTS idx_message_history_guild ON message_history(guild_id, id);
CREATE INDEX IF NOT EXISTS idx_message_history_channel ON message_history(guild_id, channel_id, id);
CREATE INDEX IF NOT EXISTS idx_news_signals_guild ON news_signals(guild_id, id);
CREATE INDEX IF NOT EXISTS idx_member_events_user ON member_events(guild_id, user_id, id);
CREATE INDEX IF NOT EXISTS idx_reputation_target ON reputation_events(guild_id, target_id, id);
CREATE INDEX IF NOT EXISTS idx_reputation_giver ON reputation_events(guild_id, giver_id, target_id, created_at);
`);

function tableColumns(table) {
    try {
        return db.prepare(`PRAGMA table_info(${table})`).all().map(row => String(row.name));
    } catch {
        return [];
    }
}
function ensureColumn(table, column, definition) {
    if (tableColumns(table).includes(column)) return;
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error) {
        console.error(`[db:migrate] ${table}.${column}: ${error.message}`);
    }
}
ensureColumn('guilds', 'style_key', 'TEXT');
ensureColumn('guilds', 'style_custom', 'TEXT');
ensureColumn('profiles', 'last_daily_at', 'TEXT');
ensureColumn('profiles', 'last_rob_at', 'TEXT');
ensureColumn('companies', 'last_tax_cents', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('goods_market', 'last_sales_volume', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('goods_market', 'news_pressure_bps', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('companies', 'news_pressure_bps', 'INTEGER NOT NULL DEFAULT 0');

function asRow(row) {
    return row ? Object.assign({}, row) : null;
}
function asRows(rows) {
    return (rows || []).map(asRow);
}
function run(sql, params) {
    return db.prepare(sql).run(...(params || []));
}
function get(sql, params) {
    return asRow(db.prepare(sql).get(...(params || [])));
}
function all(sql, params) {
    return asRows(db.prepare(sql).all(...(params || [])));
}
let transactionDepth = 0;
function transaction(fn) {
    if (transactionDepth > 0) return fn();
    db.exec('BEGIN IMMEDIATE');
    transactionDepth = 1;
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
    } finally {
        transactionDepth = 0;
    }
}
function ensureGuild(guildId, name) {
    const id = String(guildId || '').trim();
    if (!/^\d{5,25}$/.test(id)) throw new Error('invalid guild id');
    const existing = get('SELECT * FROM guilds WHERE guild_id = ?', [id]);
    if (existing) {
        if (name && name !== existing.name) {
            run('UPDATE guilds SET name = ?, updated_at = ? WHERE guild_id = ?', [String(name).slice(0, 120), nowIso(), id]);
            existing.name = String(name).slice(0, 120);
        }
        const fallbackStyle = style.defaultKey(id);
        if (!existing.style_key && fallbackStyle) {
            run('UPDATE guilds SET style_key = ?, updated_at = ? WHERE guild_id = ?', [fallbackStyle, nowIso(), id]);
            existing.style_key = fallbackStyle;
        }
        const cooldown = Number(existing.work_cooldown_min) || 0;
        if (cooldown === 480 || (existing.style_key && cooldown > 0 && cooldown < 10)) {
            run('UPDATE guilds SET work_cooldown_min = 10, updated_at = ? WHERE guild_id = ?', [nowIso(), id]);
            existing.work_cooldown_min = 10;
        }
        return existing;
    }
    const styled = style.forGuild(id);
    const preset = modelPreset((styled && styled.model) || 'market');
    const currency = currencyPreset((styled && styled.currency) || 'USD');
    const at = nowIso();
    run(`INSERT INTO guilds (
        guild_id, name, prefix, style_key, currency_code, currency_name, currency_symbol, model,
        central_bank_name, government_name,
        income_tax_bps, corporate_tax_bps, payroll_tax_bps, vat_bps, wealth_tax_bps,
        policy_rate_bps, reserve_ratio_bps, welfare_bps, central_bank_independence, market_openness,
        work_cooldown_min, cycle_minutes, starter_balance, jarvis_limit,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, String(name || '').slice(0, 120), (styled && styled.prefix) || DEFAULT_PREFIX, styled ? styled.key : null,
        currency.code, currency.name, currency.symbol, (styled && styled.model) || 'market',
        (styled && styled.bankName) || 'State Bank', (styled && styled.governmentName) || 'Treasury',
        preset.income_tax_bps, preset.corporate_tax_bps, preset.payroll_tax_bps, preset.vat_bps, 0,
        preset.policy_rate_bps, preset.reserve_ratio_bps, preset.welfare_bps, preset.central_bank_independence, preset.market_openness,
        WORK_COOLDOWN_MIN_DEFAULT, CYCLE_MINUTES_DEFAULT, STARTER_BALANCE_MINOR, JARVIS_DAILY_LIMIT,
        at, at,
    ]);
    ensureInstitutionAccounts(id);
    ensureGoods(id);
    return get('SELECT * FROM guilds WHERE guild_id = ?', [id]);
}
function ensureInstitutionAccounts(guildId) {
    const at = nowIso();
    const rows = [
        ['institution', 'state_bank', 'vault'],
        ['institution', 'state_bank', 'deposit_liability'],
        ['institution', 'state_bank', 'loan_asset'],
        ['institution', 'state_bank', 'interest_income'],
        ['institution', 'state_bank', 'interest_expense'],
        ['government', 'treasury', 'treasury'],
        ['government', 'treasury', 'bond_liability'],
        ['central_bank', 'central', 'currency_issued'],
        ['central_bank', 'central', 'capital'],
        ['system', 'market', 'fees'],
        ['system', 'market', 'escrow'],
    ];
    for (const [ownerType, ownerId, kind] of rows) {
        run(`INSERT OR IGNORE INTO accounts (guild_id, owner_type, owner_id, kind, balance, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)`, [guildId, ownerType, ownerId, kind, at, at]);
    }
}
function ensureGoods(guildId) {
    const at = nowIso();
    const { GOODS } = require('./config');
    for (const [key, good] of Object.entries(GOODS)) {
        run(`INSERT OR IGNORE INTO goods_market (guild_id, good_key, price_cents, supply, demand, sales_volume, updated_at)
             VALUES (?, ?, ?, 0, 0, 0, ?)`, [guildId, key, good.base_price, at]);
    }
}
function getGuild(guildId) {
    return get('SELECT * FROM guilds WHERE guild_id = ?', [String(guildId)]);
}
function updateGuild(guildId, patch) {
    const allowed = new Set([
        'name', 'prefix', 'style_key', 'style_custom', 'currency_code', 'currency_name', 'currency_symbol', 'model',
        'central_bank_name', 'government_name', 'income_tax_bps', 'corporate_tax_bps',
        'payroll_tax_bps', 'vat_bps', 'wealth_tax_bps', 'policy_rate_bps', 'reserve_ratio_bps',
        'welfare_bps', 'central_bank_independence', 'market_openness', 'work_cooldown_min',
        'cycle_minutes', 'starter_balance', 'jarvis_limit', 'log_channel_id', 'last_cycle_at',
        'last_cycle_tick',
    ]);
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(patch || {})) {
        if (!allowed.has(key)) continue;
        fields.push(`${key} = ?`);
        values.push(key === 'style_custom' && value && typeof value === 'object' ? JSON.stringify(value) : value);
    }
    if (!fields.length) return getGuild(guildId);
    fields.push('updated_at = ?');
    values.push(nowIso());
    values.push(String(guildId));
    run(`UPDATE guilds SET ${fields.join(', ')} WHERE guild_id = ?`, values);
    return getGuild(guildId);
}
function ensureProfile(guildId, userId, displayName) {
    const at = nowIso();
    run(`INSERT OR IGNORE INTO profiles (guild_id, user_id, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`, [guildId, String(userId), String(displayName || '').slice(0, 80), at, at]);
    if (displayName) {
        run('UPDATE profiles SET display_name = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?',
            [String(displayName).slice(0, 80), at, guildId, String(userId)]);
    }
    return get('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]);
}
function ensureAccount(guildId, ownerType, ownerId, kind) {
    const at = nowIso();
    run(`INSERT OR IGNORE INTO accounts (guild_id, owner_type, owner_id, kind, balance, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`, [guildId, ownerType, String(ownerId), kind, at, at]);
    return get('SELECT * FROM accounts WHERE guild_id = ? AND owner_type = ? AND owner_id = ? AND kind = ?',
        [guildId, ownerType, String(ownerId), kind]);
}
function ensureUserAccounts(guildId, userId) {
    ensureProfile(guildId, userId);
    return {
        wallet: ensureAccount(guildId, 'user', userId, 'wallet'),
        deposit: ensureAccount(guildId, 'user', userId, 'deposit'),
        loan: ensureAccount(guildId, 'user', userId, 'loan'),
    };
}
function accountById(id) {
    return get('SELECT * FROM accounts WHERE id = ?', [Number(id)]);
}
function post(guildId, kind, actorId, memo, entries, metadata) {
    const list = (entries || []).filter(e => e && Math.trunc(Number(e.delta)));
    if (!list.length) throw new Error('transaction has no entries');
    let sum = 0;
    const normalized = list.map(entry => {
        let account = entry.accountId ? accountById(entry.accountId) : null;
        if (!account && entry.ownerType) {
            account = ensureAccount(guildId, entry.ownerType, entry.ownerId, entry.kind);
        }
        if (!account) throw new Error('account not found');
        if (String(account.guild_id) !== String(guildId)) throw new Error('cross-guild account');
        const delta = Math.trunc(Number(entry.delta));
        sum += delta;
        return { id: account.id, delta };
    });
    if (sum !== 0) throw new Error(`unbalanced transaction: ${sum}`);
    const at = nowIso();
    return transaction(() => {
        const result = run('INSERT INTO transactions (guild_id, kind, actor_id, memo, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [guildId, String(kind || 'transfer'), actorId ? String(actorId) : null, String(memo || '').slice(0, 240), metadata ? JSON.stringify(metadata).slice(0, 4000) : null, at]);
        const txId = Number(result.lastInsertRowid);
        for (const entry of normalized) {
            run('INSERT INTO ledger_entries (guild_id, tx_id, account_id, delta, created_at) VALUES (?, ?, ?, ?, ?)',
                [guildId, txId, entry.id, entry.delta, at]);
            run('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?', [entry.delta, at, entry.id]);
        }
        return txId;
    });
}
function balanceOf(guildId, ownerType, ownerId, kind) {
    const account = get('SELECT balance FROM accounts WHERE guild_id = ? AND owner_type = ? AND owner_id = ? AND kind = ?',
        [guildId, ownerType, String(ownerId), kind]);
    return account ? Number(account.balance) : 0;
}
function walletBalance(guildId, userId) {
    return balanceOf(guildId, 'user', userId, 'wallet');
}
function depositBalance(guildId, userId) {
    return balanceOf(guildId, 'user', userId, 'deposit');
}
function loanBalance(guildId, borrowerType, borrowerId) {
    return -balanceOf(guildId, borrowerType, borrowerId, 'loan');
}
function netWorth(guildId, userId) {
    return walletBalance(guildId, userId) + depositBalance(guildId, userId) - loanBalance(guildId, 'user', userId);
}
function touchMemberActivity(guildId, userId, displayName, channelId) {
    const at = nowIso();
    run(`INSERT INTO member_activity
        (guild_id, user_id, display_name, message_count, reactions_received, first_seen_at, last_message_at, last_channel_id)
        VALUES (?, ?, ?, 1, 0, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
            display_name = COALESCE(NULLIF(excluded.display_name, ''), member_activity.display_name),
            message_count = member_activity.message_count + 1,
            last_message_at = excluded.last_message_at,
            last_channel_id = excluded.last_channel_id`,
        [String(guildId), String(userId), String(displayName || '').slice(0, 120), at, at, String(channelId || '')]);
}
function recordMemberEvent(guildId, userId, kind, detail) {
    run('INSERT INTO member_events (guild_id, user_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)',
        [String(guildId), String(userId), String(kind), detail ? JSON.stringify(detail).slice(0, 2000) : null, nowIso()]);
}
function memberEvents(guildId, userId, limit) {
    return all('SELECT * FROM member_events WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?',
        [String(guildId), String(userId), Math.max(1, Math.min(50, Number(limit) || 12))]);
}
function activityFor(guildId, userId) {
    return get('SELECT * FROM member_activity WHERE guild_id = ? AND user_id = ?', [String(guildId), String(userId)]);
}
function audit(guildId, actorId, action, detail) {
    run('INSERT INTO audit_log (guild_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)',
        [String(guildId), actorId ? String(actorId) : null, String(action).slice(0, 120), detail ? JSON.stringify(detail).slice(0, 4000) : null, nowIso()]);
}
function recentAudit(guildId, limit) {
    return all('SELECT * FROM audit_log WHERE guild_id = ? ORDER BY id DESC LIMIT ?', [guildId, Math.max(1, Math.min(50, Number(limit) || 10))]);
}
function close() {
    try { db.close(); } catch {}
}
function raw() {
    return db;
}

module.exports = {
    DB_PATH,
    db,
    raw,
    close,
    run,
    get,
    all,
    transaction,
    ensureGuild,
    ensureInstitutionAccounts,
    ensureGoods,
    getGuild,
    updateGuild,
    ensureProfile,
    ensureAccount,
    ensureUserAccounts,
    accountById,
    post,
    balanceOf,
    walletBalance,
    depositBalance,
    loanBalance,
    netWorth,
    touchMemberActivity,
    recordMemberEvent,
    memberEvents,
    activityFor,
    audit,
    recentAudit,
    nowIso,
};
