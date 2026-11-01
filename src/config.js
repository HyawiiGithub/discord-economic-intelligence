'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file) {
    const target = file || path.join(__dirname, '..', '.env');
    let raw = '';
    try { raw = fs.readFileSync(target, 'utf8'); } catch { return; }
    for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let value = m[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        } else {
            value = value.replace(/\s+#.*$/, '').trim();
        }
        if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
}
loadEnv();

const DEFAULT_PREFIX = '-';
const JARVIS_DAILY_LIMIT = 5;
const DEVELOPER_IDS = ['1082686076491137115'];
const CYCLE_MINUTES_DEFAULT = 60;
const WORK_COOLDOWN_MIN_DEFAULT = 10;
const STARTER_BALANCE_MINOR = 100000;

const CURRENCIES = {
    RM: { code: 'RM', symbol: 'RM', name: 'Reichsmark' },
    USD: { code: 'USD', symbol: '$', name: 'US dollar' },
    EUR: { code: 'EUR', symbol: 'EUR', name: 'euro' },
    GBP: { code: 'GBP', symbol: 'GBP', name: 'pound sterling' },
    CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
    JPY: { code: 'JPY', symbol: 'JPY', name: 'yen' },
    CNY: { code: 'CNY', symbol: 'CNY', name: 'renminbi' },
    CAD: { code: 'CAD', symbol: 'CAD', name: 'Canadian dollar' },
    AUD: { code: 'AUD', symbol: 'AUD', name: 'Australian dollar' },
    NZD: { code: 'NZD', symbol: 'NZD', name: 'New Zealand dollar' },
    SEK: { code: 'SEK', symbol: 'SEK', name: 'Swedish krona' },
    NOK: { code: 'NOK', symbol: 'NOK', name: 'Norwegian krone' },
    DKK: { code: 'DKK', symbol: 'DKK', name: 'Danish krone' },
    PLN: { code: 'PLN', symbol: 'PLN', name: 'Polish zloty' },
    CZK: { code: 'CZK', symbol: 'CZK', name: 'Czech koruna' },
    HUF: { code: 'HUF', symbol: 'HUF', name: 'Hungarian forint' },
    RON: { code: 'RON', symbol: 'RON', name: 'Romanian leu' },
    TRY: { code: 'TRY', symbol: 'TRY', name: 'Turkish lira' },
    INR: { code: 'INR', symbol: 'INR', name: 'Indian rupee' },
    BRL: { code: 'BRL', symbol: 'BRL', name: 'Brazilian real' },
    MXN: { code: 'MXN', symbol: 'MXN', name: 'Mexican peso' },
    ZAR: { code: 'ZAR', symbol: 'ZAR', name: 'South African rand' },
    KRW: { code: 'KRW', symbol: 'KRW', name: 'South Korean won' },
    SGD: { code: 'SGD', symbol: 'SGD', name: 'Singapore dollar' },
    HKD: { code: 'HKD', symbol: 'HKD', name: 'Hong Kong dollar' },
    RUB: { code: 'RUB', symbol: 'RUB', name: 'Russian ruble' },
    UAH: { code: 'UAH', symbol: 'UAH', name: 'Ukrainian hryvnia' },
    ILS: { code: 'ILS', symbol: 'ILS', name: 'Israeli new shekel' },
    AED: { code: 'AED', symbol: 'AED', name: 'UAE dirham' },
    SAR: { code: 'SAR', symbol: 'SAR', name: 'Saudi riyal' },
    ARS: { code: 'ARS', symbol: 'ARS', name: 'Argentine peso' },
    CLP: { code: 'CLP', symbol: 'CLP', name: 'Chilean peso' },
    COP: { code: 'COP', symbol: 'COP', name: 'Colombian peso' },
};

const MODEL_PRESETS = {
    market: {
        label: 'Market economy',
        description: 'Private ownership, independent monetary policy, light progressive taxation and open markets.',
        income_tax_bps: 1500,
        corporate_tax_bps: 2100,
        payroll_tax_bps: 1200,
        vat_bps: 800,
        policy_rate_bps: 300,
        reserve_ratio_bps: 1000,
        welfare_bps: 300,
        central_bank_independence: 90,
        market_openness: 100,
    },
    social_market: {
        label: 'Social market economy',
        description: 'Private ownership with stronger public services, collective bargaining and macroprudential supervision.',
        income_tax_bps: 2600,
        corporate_tax_bps: 2400,
        payroll_tax_bps: 1900,
        vat_bps: 1200,
        policy_rate_bps: 250,
        reserve_ratio_bps: 1200,
        welfare_bps: 900,
        central_bank_independence: 75,
        market_openness: 90,
    },
    mixed: {
        label: 'Mixed economy',
        description: 'Private and public enterprise coexist; strategic sectors are regulated and the state invests directly.',
        income_tax_bps: 2200,
        corporate_tax_bps: 2200,
        payroll_tax_bps: 1600,
        vat_bps: 1000,
        policy_rate_bps: 350,
        reserve_ratio_bps: 1400,
        welfare_bps: 600,
        central_bank_independence: 55,
        market_openness: 75,
    },
    state_led: {
        label: 'State-led economy',
        description: 'The state bank directs credit and strategic investment; private markets operate under close supervision.',
        income_tax_bps: 3000,
        corporate_tax_bps: 2800,
        payroll_tax_bps: 2400,
        vat_bps: 1500,
        policy_rate_bps: 400,
        reserve_ratio_bps: 1800,
        welfare_bps: 1100,
        central_bank_independence: 25,
        market_openness: 55,
    },
};

const POWER_KEYS = ['config', 'bank', 'treasury', 'markets', 'companies', 'audit'];
const POWER_LABELS = {
    config: 'Server configuration',
    bank: 'State bank and monetary policy',
    treasury: 'Treasury and fiscal policy',
    markets: 'Market supervision',
    companies: 'Company registry',
    audit: 'Ledger audit',
};

const OFFICES = {
    governor: { label: 'Governor of the State Bank', powers: ['bank', 'audit'] },
    deputy_governor: { label: 'Deputy Governor', powers: ['bank'] },
    treasurer: { label: 'Treasurer', powers: ['treasury', 'audit'] },
    finance_minister: { label: 'Finance Minister', powers: ['treasury', 'config'] },
    market_regulator: { label: 'Market Regulator', powers: ['markets'] },
    registrar: { label: 'Company Registrar', powers: ['companies'] },
    auditor: { label: 'Auditor General', powers: ['audit'] },
    economic_advisor: { label: 'Economic Advisor', powers: ['audit'] },
};

const SECTORS = {
    agriculture: { label: 'Agriculture', good: 'food', productivity: 14, wage_floor: 700, license_fee: 25000 },
    energy: { label: 'Energy', good: 'energy', productivity: 10, wage_floor: 900, license_fee: 50000 },
    manufacturing: { label: 'Manufacturing', good: 'manufactured', productivity: 7, wage_floor: 1000, license_fee: 75000 },
    logistics: { label: 'Logistics', good: 'logistics', productivity: 12, wage_floor: 850, license_fee: 40000 },
    retail: { label: 'Retail', good: 'consumer', productivity: 18, wage_floor: 650, license_fee: 30000 },
    technology: { label: 'Technology', good: 'technology', productivity: 5, wage_floor: 1400, license_fee: 100000 },
    finance: { label: 'Finance', good: 'financial', productivity: 8, wage_floor: 1300, license_fee: 125000 },
    healthcare: { label: 'Healthcare', good: 'healthcare', productivity: 9, wage_floor: 1100, license_fee: 60000 },
    construction: { label: 'Construction', good: 'construction', productivity: 6, wage_floor: 950, license_fee: 55000 },
    hospitality: { label: 'Hospitality', good: 'hospitality', productivity: 20, wage_floor: 600, license_fee: 25000 },
};

const GOODS = {
    food: { label: 'Food', unit: 'case', base_price: 4500, elasticity: 0.55 },
    energy: { label: 'Energy', unit: 'MWh', base_price: 9000, elasticity: 0.35 },
    manufactured: { label: 'Manufactured goods', unit: 'unit', base_price: 18000, elasticity: 0.85 },
    logistics: { label: 'Logistics', unit: 'shipment', base_price: 12000, elasticity: 0.75 },
    consumer: { label: 'Consumer goods', unit: 'unit', base_price: 6500, elasticity: 1.10 },
    technology: { label: 'Technology', unit: 'unit', base_price: 45000, elasticity: 1.25 },
    financial: { label: 'Financial services', unit: 'contract', base_price: 25000, elasticity: 1.35 },
    healthcare: { label: 'Healthcare services', unit: 'course', base_price: 22000, elasticity: 0.65 },
    construction: { label: 'Construction work', unit: 'project', base_price: 60000, elasticity: 0.70 },
    hospitality: { label: 'Hospitality service', unit: 'visit', base_price: 8500, elasticity: 1.20 },
};

function modelPreset(model) {
    return MODEL_PRESETS[model] || MODEL_PRESETS.market;
}
function normalizeModel(value) {
    const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return MODEL_PRESETS[key] ? key : null;
}
function normalizePowers(list) {
    const set = new Set();
    for (const item of Array.isArray(list) ? list : String(list || '').split(/[,\s]+/)) {
        const key = String(item || '').trim().toLowerCase();
        if (POWER_KEYS.includes(key)) set.add(key);
    }
    return [...set];
}
function normalizeOffice(value) {
    const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (OFFICES[key]) return key;
    const found = Object.keys(OFFICES).find(k => OFFICES[k].label.toLowerCase() === String(value || '').trim().toLowerCase());
    return found || null;
}
function currencyPreset(code) {
    const key = String(code || '').trim().toUpperCase();
    return CURRENCIES[key] || { code: key, symbol: key || 'USD', name: key || 'US dollar' };
}
function envFlag(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === '') return !!fallback;
    return /^(1|true|yes|on)$/i.test(raw);
}
function parseIdList(value) {
    return String(value || '').split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{5,25}$/.test(x));
}

module.exports = {
    DEFAULT_PREFIX,
    JARVIS_DAILY_LIMIT,
    DEVELOPER_IDS,
    CYCLE_MINUTES_DEFAULT,
    WORK_COOLDOWN_MIN_DEFAULT,
    STARTER_BALANCE_MINOR,
    CURRENCIES,
    MODEL_PRESETS,
    POWER_KEYS,
    POWER_LABELS,
    OFFICES,
    SECTORS,
    GOODS,
    modelPreset,
    normalizeModel,
    normalizePowers,
    normalizeOffice,
    currencyPreset,
    envFlag,
    parseIdList,
    loadEnv,
};
