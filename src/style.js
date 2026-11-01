'use strict';

const GAMEPLAY = {
    daily: 25000,
    civilWorkMin: 2500,
    civilWorkMax: 7500,
    robCooldownMinutes: 10,
    robCap: 60000,
    robFineMin: 7500,
    robFineMax: 25000,
    casinoMax: 100000,
    lotteryTicket: 5000,
    lotterySeed: 50000,
    lotteryCutBps: 2000,
    lotteryDays: 7,
};

const SHOP = [
    {
        name: 'Reichsbürgerkarte',
        description: 'A registry document confirming your place in the Reich.',
        category: 'documents',
        itemType: 'document',
        price: 2500,
        stock: 10000,
    },
    {
        name: 'Kleines Wohngrundstück',
        description: 'A small residential lot on the outskirts of the city.',
        category: 'property',
        itemType: 'property',
        price: 60000,
        stock: 250,
        value: 50000,
    },
    {
        name: 'Handwerksbetrieb',
        description: 'A licensed workshop with a storefront and two workbenches.',
        category: 'property',
        itemType: 'property',
        price: 250000,
        stock: 60,
        value: 220000,
        income: 12000,
    },
    {
        name: 'Reichsmark Chronograph',
        description: 'A precision timepiece from the Reichsmark watchworks.',
        category: 'luxury',
        itemType: 'collectible',
        price: 15000,
        stock: 500,
    },
    {
        name: 'Kaffeehaus-Gutschein',
        description: 'A voucher for coffee and cake at a certified Kaffeehaus.',
        category: 'consumable',
        itemType: 'consumable',
        price: 3500,
        stock: 5000,
    },
    {
        name: 'Reichsbahn Monatskarte',
        description: 'A monthly pass for all Reichsbahn routes.',
        category: 'transport',
        itemType: 'consumable',
        price: 7500,
        stock: 5000,
    },
];

const STOCKS = [
    {
        name: 'Rheinische Stahlwerke',
        ticker: 'RST',
        sector: 'manufactured',
        description: 'Steel, machinery and heavy industrial components.',
        price: 1200,
        shares: 20000,
        inventory: 120,
    },
    {
        name: 'Norddeutsche Energie',
        ticker: 'NDE',
        sector: 'energy',
        description: 'Coal, gas and the growing electrical grid.',
        price: 950,
        shares: 24000,
        inventory: 180,
    },
    {
        name: 'Reichsbahn Logistik',
        ticker: 'RBL',
        sector: 'logistics',
        description: 'Rail freight and long-distance transport.',
        price: 780,
        shares: 30000,
        inventory: 150,
    },
    {
        name: 'Bavaria Maschinenbau',
        ticker: 'BVM',
        sector: 'technology',
        description: 'Precision instruments and industrial automation.',
        price: 1650,
        shares: 15000,
        inventory: 80,
    },
    {
        name: 'Hanseatic Handel',
        ticker: 'HHT',
        sector: 'consumer',
        description: 'Wholesale consumer goods and import trade.',
        price: 620,
        shares: 26000,
        inventory: 200,
    },
];

const SOVIET_SHOP = [
    {
        name: 'Советский паспорт',
        description: 'A internal passport confirming registration and residence.',
        category: 'documents',
        itemType: 'document',
        price: 2500,
        stock: 10000,
    },
    {
        name: 'Коммунальная квартира',
        description: 'A room in a shared municipal apartment block.',
        category: 'property',
        itemType: 'property',
        price: 60000,
        stock: 250,
        value: 50000,
    },
    {
        name: 'Государственная мастерская',
        description: 'A licensed repair and production workshop.',
        category: 'property',
        itemType: 'property',
        price: 250000,
        stock: 60,
        value: 220000,
        income: 12000,
    },
    {
        name: 'Часы «Победа»',
        description: 'A state-produced mechanical watch.',
        category: 'luxury',
        itemType: 'collectible',
        price: 15000,
        stock: 500,
    },
    {
        name: 'Талоны на кофе',
        description: 'A ration coupon for coffee and bread.',
        category: 'consumable',
        itemType: 'consumable',
        price: 3500,
        stock: 5000,
    },
    {
        name: 'Проездной метро',
        description: 'A monthly municipal transport pass.',
        category: 'transport',
        itemType: 'consumable',
        price: 7500,
        stock: 5000,
    },
];

const SOVIET_STOCKS = [
    { name: 'Магнитогорский металлургический комбинат', ticker: 'MMK', sector: 'manufactured', description: 'Steel and heavy industry.', price: 1100, shares: 24000, inventory: 120 },
    { name: 'ДнепроГЭС', ticker: 'DNG', sector: 'energy', description: 'Hydroelectric power generation.', price: 920, shares: 26000, inventory: 180 },
    { name: 'Советские железные дороги', ticker: 'SZD', sector: 'logistics', description: 'Rail freight and passenger transport.', price: 740, shares: 32000, inventory: 150 },
    { name: 'Красный пролетарий', ticker: 'KPR', sector: 'technology', description: 'Machine tools and precision instruments.', price: 1500, shares: 18000, inventory: 80 },
    { name: 'Центросоюз', ticker: 'CSU', sector: 'consumer', description: 'State consumer goods distribution.', price: 580, shares: 28000, inventory: 200 },
];

const TITLES = {
    account: 'Reichsbank Account',
    daily: 'Daily allowance',
    work: 'Shift completed',
    civil: 'Civil service shift',
    rob: 'Robbery',
    casino: 'Casino',
    lottery: 'Reichslotterie',
    shop: 'Reichsmarkt',
    inventory: 'Inventory',
    properties: 'Properties',
    leaderboard: 'Wealth leaderboard',
    wealth: 'Wealth',
    bet: 'Public wagers',
    finance: 'Finance',
    report: 'Economy report',
    credit: 'Credit position',
    transactions: 'Transactions',
    reichsbank: 'Reichsbank',
    bank: 'Reichsbank',
    treasury: 'Reichsregierung',
};

const STYLES = {
    reichsmark: {
        key: 'reichsmark',
        label: 'TA Reichsmark Economy',
        prefix: '!',
        currency: 'RM',
        model: 'market',
        color: 0xd4af37,
        footer: 'TA Reichsmark Economy · Reichsbank ledger',
        bankName: 'Reichsbank',
        governmentName: 'Reichsregierung',
        exchangeName: 'Reichsbörse',
        ...GAMEPLAY,
        titles: { ...TITLES },
        shop: SHOP,
        stocks: STOCKS,
        theme: {
            background: '#080b0d',
            surface: '#0e1317',
            surfaceAlt: '#12191e',
            border: 'rgba(255,255,255,0.075)',
            borderStrong: 'rgba(212,175,55,0.25)',
            text: '#eef2f5',
            muted: '#93a0ac',
            faint: '#5b6874',
            accent: '#d4af37',
            accentSoft: 'rgba(212,175,55,0.13)',
            gold: '#f0d78c',
            danger: '#fb7185',
            warning: '#fbbf24',
            blue: '#7dd3fc',
            glow: 'rgba(212,175,55,0.08)',
            motif: 'reichsmark',
            seal: 'RM',
        },
    },
    german_empire_1914: {
        key: 'german_empire_1914',
        label: 'Deutsches Kaiserreich · 1914',
        prefix: '!',
        currency: 'RM',
        model: 'market',
        color: 0xc9a227,
        footer: 'Deutsches Kaiserreich · 1914 · Reichsbank',
        bankName: 'Reichsbank',
        governmentName: 'Reichsschatzamt',
        exchangeName: 'Kaiserliche Börse',
        ...GAMEPLAY,
        titles: {
            ...TITLES,
            account: 'Kaiserliche Reichsbank · Konto',
            daily: 'Tagesgeld',
            work: 'Schicht abgeschlossen',
            civil: 'Zivildienst',
            rob: 'Raub',
            casino: 'Spielbank',
            lottery: 'Kaiserliche Lotterie',
            shop: 'Reichsmarkt',
            inventory: 'Bestand',
            properties: 'Grundbesitz',
            leaderboard: 'Vermögensrangliste',
            wealth: 'Vermögen',
            bet: 'Öffentliche Wetten',
            finance: 'Reichsfinanzen',
            report: 'Wirtschaftsbericht',
            credit: 'Kreditlage',
            transactions: 'Kontobewegungen',
            reichsbank: 'Kaiserliche Reichsbank',
            bank: 'Kaiserliche Reichsbank',
            treasury: 'Reichsschatzamt',
        },
        shop: SHOP,
        stocks: STOCKS,
        theme: {
            background: '#0f0d0a',
            surface: '#1a1712',
            surfaceAlt: '#211c15',
            border: 'rgba(201,162,39,0.16)',
            borderStrong: 'rgba(201,162,39,0.42)',
            text: '#f2ead8',
            muted: '#b3a385',
            faint: '#74664f',
            accent: '#c9a227',
            accentSoft: 'rgba(201,162,39,0.14)',
            gold: '#e6c45a',
            danger: '#b34a4a',
            warning: '#d18b2c',
            blue: '#7f9fb5',
            glow: 'rgba(201,162,39,0.11)',
            motif: 'empire',
            seal: '1914',
        },
    },
    ussr: {
        key: 'ussr',
        label: 'СССР · Советская экономика',
        prefix: '!',
        currency: 'RUB',
        model: 'state_led',
        applyModel: true,
        color: 0xc62828,
        footer: 'СССР · Госплан · Государственный банк',
        bankName: 'Госбанк СССР',
        governmentName: 'Совет Министров',
        exchangeName: 'Государственная биржа',
        ...GAMEPLAY,
        titles: {
            ...TITLES,
            account: 'Госбанк СССР · Счёт',
            daily: 'Ежедневное пособие',
            work: 'Смена завершена',
            civil: 'Общественные работы',
            rob: 'Хищение',
            casino: 'Игорный дом',
            lottery: 'Государственная лотерея',
            shop: 'Государственный магазин',
            inventory: 'Имущество',
            properties: 'Недвижимость',
            leaderboard: 'Таблица достатка',
            wealth: 'Достаток',
            bet: 'Публичные пари',
            finance: 'Финансы',
            report: 'Экономический отчёт',
            credit: 'Кредит',
            transactions: 'Операции',
            reichsbank: 'Госбанк СССР',
            bank: 'Госбанк СССР',
            treasury: 'Совет Министров',
        },
        shop: SOVIET_SHOP,
        stocks: SOVIET_STOCKS,
        theme: {
            background: '#100b0b',
            surface: '#1c1111',
            surfaceAlt: '#241616',
            border: 'rgba(198,40,40,0.2)',
            borderStrong: 'rgba(198,40,40,0.48)',
            text: '#f2e9e2',
            muted: '#b89f96',
            faint: '#7e645d',
            accent: '#d12f2f',
            accentSoft: 'rgba(209,47,47,0.14)',
            gold: '#e2b34a',
            danger: '#ff4d4d',
            warning: '#e18a2c',
            blue: '#8aa9bf',
            glow: 'rgba(198,40,40,0.13)',
            motif: 'soviet',
            seal: 'СССР',
            font: 'Noto Sans',
        },
    },
};

const DEFAULT_STYLE_KEYS = {
    '1425924508245692448': 'german_empire_1914',
};

function defaultKey(guildId) {
    return DEFAULT_STYLE_KEYS[String(guildId)] || null;
}
function preset(key) {
    return STYLES[String(key || '')] || null;
}
function guildRowFor(guildId, guildRow) {
    if (guildRow) return guildRow;
    try {
        const db = require('./db');
        return db.get('SELECT * FROM guilds WHERE guild_id = ?', [String(guildId)]);
    } catch {
        return null;
    }
}
function keyFor(guildId, guildRow) {
    const row = guildRowFor(guildId, guildRow);
    if (row && row.style_key) return String(row.style_key);
    return defaultKey(guildId);
}
function customFor(guildRow) {
    if (!guildRow || !guildRow.style_custom) return null;
    try {
        const value = typeof guildRow.style_custom === 'string' ? JSON.parse(guildRow.style_custom) : guildRow.style_custom;
        return value && typeof value === 'object' ? value : null;
    } catch {
        return null;
    }
}
function forGuild(guildId, guildRow) {
    const row = guildRowFor(guildId, guildRow);
    const key = keyFor(guildId, row);
    if (!key || key === 'none') return null;
    const base = preset(key);
    if (!base) return null;
    const custom = customFor(row);
    if (!custom) return base;
    return {
        ...base,
        ...custom,
        titles: { ...(base.titles || {}), ...(custom.titles || {}) },
        theme: { ...(base.theme || {}), ...(custom.theme || {}) },
        shop: base.shop,
        stocks: base.stocks,
    };
}
function isStyled(guildId, guildRow) {
    return Boolean(forGuild(guildId, guildRow));
}
function title(guildId, key, fallback, guildRow) {
    const guildStyle = forGuild(guildId, guildRow);
    return (guildStyle && guildStyle.titles[key]) || fallback;
}
function label(guildId, key, fallback, guildRow) {
    const guildStyle = forGuild(guildId, guildRow);
    if (!guildStyle) return fallback;
    if (key === 'bank') return guildStyle.bankName;
    if (key === 'government') return guildStyle.governmentName;
    if (key === 'exchange') return guildStyle.exchangeName;
    return fallback;
}
function choices() {
    return [
        { name: 'No themed economy', value: 'none' },
        { name: 'TA Reichsmark Economy', value: 'reichsmark' },
        { name: 'Deutsches Kaiserreich 1914', value: 'german_empire_1914' },
        { name: 'СССР · Советская экономика', value: 'ussr' },
    ];
}

module.exports = {
    STYLES,
    DEFAULT_STYLE_KEYS,
    defaultKey,
    preset,
    keyFor,
    forGuild,
    isStyled,
    title,
    label,
    choices,
};
