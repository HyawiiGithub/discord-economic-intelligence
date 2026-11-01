'use strict';

const economy = require('./economy');
const business = require('./business');
const admin = require('./admin');
const community = require('./community');
const social = require('./social');
const crypto = require('./crypto');
const developer = require('./developer');
const helpMenu = require('../help');
const style = require('../style');
const permissions = require('../permissions');
const { embed, send, COLORS, error, tokenize } = require('./helpers');

const aliases = {
    overview: 'overview',
    economy: 'overview',
    eco: 'overview',
    dashboard: 'overview',
    graph: 'overview',
    status: 'overview',
    market: 'market',
    goods: 'market',
    prices: 'market',
    bank: 'bank',
    rates: 'bank',
    monetary: 'bank',
    gov: 'gov',
    government: 'gov',
    treasury: 'gov',
    fiscal: 'gov',
    jobs: 'jobs',
    vacancies: 'jobs',
    work: 'work',
    shift: 'work',
    apply: 'apply',
    resign: 'resign',
    quit: 'resign',
    pay: 'pay',
    transfer: 'pay',
    deposit: 'deposit',
    dep: 'deposit',
    withdraw: 'withdraw',
    wd: 'withdraw',
    loan: 'loan',
    borrow: 'loan',
    credit: 'credit',
    repay: 'repay',
    bond: 'bond',
    bonds: 'bond',
    portfolio: 'portfolio',
    me: 'portfolio',
    wallet: 'portfolio',
    balance: 'portfolio',
    account: 'portfolio',
    company: 'company',
    firm: 'company',
    business: 'company',
    companies: 'companies',
    corporations: 'companies',
    buygoods: 'buygoods',
    purchase: 'buygoods',
    buygood: 'buygoods',
    stocks: 'stocks',
    stock: 'stocks',
    equities: 'stocks',
    exchange: 'stocks',
    crypto: 'crypto',
    coins: 'crypto',
    coin: 'crypto',
    memecoin: 'crypto',
    memecoins: 'crypto',
    cryptomarket: 'crypto',
    ipo: 'ipo',
    list: 'ipo',
    buy: 'buy',
    buyshares: 'buy',
    sellshares: 'sellshares',
    sellstock: 'sellshares',
    sell: 'sellshares',
    holdings: 'holdings',
    shares: 'holdings',
    daily: 'daily',
    allowance: 'daily',
    collect: 'daily',
    rob: 'rob',
    steal: 'rob',
    casino: 'casino',
    gamble: 'casino',
    slots: 'casino',
    blackjack: 'casino',
    lottery: 'lottery',
    lotto: 'lottery',
    shop: 'shop',
    store: 'shop',
    marketbuy: 'shop',
    inventory: 'inventory',
    inv: 'inventory',
    items: 'inventory',
    use: 'use',
    useitem: 'use',
    properties: 'properties',
    property: 'properties',
    estates: 'properties',
    leaderboard: 'leaderboard',
    lb: 'leaderboard',
    top: 'leaderboard',
    rich: 'leaderboard',
    wealth: 'wealth',
    networth: 'wealth',
    nw: 'wealth',
    rep: 'rep',
    vouch: 'rep',
    reputation: 'reputation',
    standing: 'reputation',
    profile: 'profile',
    whois: 'profile',
    userinfo: 'profile',
    activity: 'activity',
    toprep: 'toprep',
    reputationleaderboard: 'toprep',
    bet: 'bet',
    bets: 'bet',
    wager: 'bet',
    finance: 'finance',
    report: 'report',
    economyreport: 'report',
    gdp: 'report',
    economyhistory: 'history',
    history: 'history',
    transactions: 'transactions',
    tx: 'transactions',
    reichsbank: 'reichsbank',
    rb: 'reichsbank',
    config: 'config',
    settings: 'config',
    setting: 'config',
    model: 'model',
    powers: 'powers',
    permissions: 'powers',
    authority: 'powers',
    appoint: 'appoint',
    dismiss: 'dismiss',
    removeoffice: 'dismiss',
    appointments: 'appointments',
    offices: 'appointments',
    audit: 'audit',
    auditlog: 'audit',
    cycle: 'cycle',
    tick: 'cycle',
    sys: 'sys',
    system: 'sys',
    dev: 'sys',
    developer: 'sys',
    jarvis: 'jarvis',
    j: 'jarvis',
    ask: 'jarvis',
    jarvisstatus: 'jarvisstatus',
    jstatus: 'jarvisstatus',
    help: 'help',
    commands: 'help',
    h: 'help',
};
const handlers = {
    overview: economy.overview,
    market: economy.marketView,
    bank: economy.bankView,
    gov: economy.governmentView,
    jobs: economy.jobs,
    work: economy.work,
    apply: economy.apply,
    resign: economy.resign,
    pay: economy.pay,
    deposit: economy.deposit,
    withdraw: economy.withdraw,
    loan: economy.loan,
    repay: economy.repay,
    bond: economy.bond,
    portfolio: economy.portfolio,
    company: business.company,
    companies: business.list,
    buygoods: business.buyGoods,
    stocks: business.stocks,
    crypto: crypto.command,
    ipo: business.ipo,
    buy: business.buyShares,
    sellshares: business.sellShares,
    holdings: business.holdings,
    daily: community.daily,
    rob: community.rob,
    casino: community.casino,
    lottery: community.lottery,
    shop: community.shop,
    use: ctx => community.shop({ ...ctx, args: ['use', ...ctx.args] }),
    inventory: community.inventory,
    properties: community.properties,
    leaderboard: community.leaderboard,
    wealth: community.wealth,
    rep: social.rep,
    reputation: social.reputation,
    profile: social.profile,
    activity: social.activity,
    toprep: social.topReputation,
    bet: community.bet,
    finance: community.finance,
    report: community.report,
    history: community.history,
    credit: community.credit,
    transactions: community.transactions,
    reichsbank: community.reichsbank,
    config: admin.config,
    powers: admin.powers,
    appoint: admin.appoint,
    dismiss: admin.dismiss,
    appointments: admin.appointments,
    audit: admin.auditLog,
    cycle: admin.cycleCommand,
    sys: developer.sys,
    jarvis: economy.askJarvis,
    jarvisstatus: admin.jarvisStatus,
    help: helpMenu.open,
};
function normalize(name) {
    return aliases[String(name || '').toLowerCase()] || null;
}
async function help(ctx) {
    const emb = embed('Economy commands', `Prefix **${ctx.prefix}** · server-scoped ledger · ${ctx.guild.name}`, COLORS.accent);
    emb.addFields(
        { name: 'Economy', value: [
            '`overview` — dashboard image and macro headline',
            '`market` — goods, prices and stock',
            '`bank` — policy rates and your credit',
            '`gov` — treasury and bonds',
            '`portfolio` — your household balance sheet',
        ].join('\n'), inline: false },
        { name: 'Work and money', value: [
            '`jobs` · `apply <id>` · `work` · `resign`',
            '`pay @member <amount>` · `deposit <amount>` · `withdraw <amount>`',
            '`loan` · `loan <amount> [term]` · `loan quote <amount> [term]` · `repay <amount>`',
            '`bond buy <amount> [term]` · `bond` — government bonds',
        ].join('\n'), inline: false },
        { name: 'Enterprise', value: [
            '`company create "Name" <sector> [capital]`',
            '`company list` · `company info <query>`',
            '`company job <company> <wage> <slots> <title>`',
            '`company price <company> <percent>` · `company dividend <company>`',
            '`buygoods <company> <good> <qty>` · `stocks` · `crypto`',
            '`ipo <company> [price]` · `buy <company> <amount>` · `sellshares <company> <shares>`',
            '`crypto buy|sell|create|portfolio|chart` · `holdings`',
        ].join('\n'), inline: false },
        { name: 'Authority', value: [
            '`config` · `config model <model>` · `config style <reichsmark|german_empire_1914|ussr|none>`',
            '`config tax <kind> <percent>` · `config channel <feed> #channel`',
            '`config channels` · `powers` · `powers role @role <powers>`',
            '`appoint @member <office> [days]` · `dismiss @member` · `appointments`',
            '`audit [limit]` · `cycle` · `cycle run`',
        ].join('\n'), inline: false },
        { name: 'Jarvis', value: '`jarvis <question>` or mention the bot with a question. Server usage limit applies; the developer account is unlimited.', inline: false },
        { name: 'Sectors', value: 'agriculture, energy, manufacturing, logistics, retail, technology, finance, healthcare, construction, hospitality', inline: false }
    );
    if (style.isStyled(ctx.guildId)) {
        emb.addFields({
            name: 'Reichsmark economy',
            value: [
                '`daily` - daily allowance',
                '`work` - company shift, or civil service when unemployed',
                '`rob @member` - attempt a robbery',
                '`casino coinflip|dice|roulette|slots|blackjack` - gaming tables',
                '`lottery` - jackpot status; `lottery buy <count>`',
                '`crypto` - coins and memecoins; `crypto buy|sell|create|portfolio|chart`',
                '`shop` - public market; `shop buy <id|name>`; `inventory`; `properties`',
                '`leaderboard` - wealth ranking; `wealth [@member]`',
                '`profile @member` - roles, join date, activity and reputation',
                '`rep @member [+|-] [reason]` · `reputation [@member]` · `toprep`',
                '`bet` - public wagers; `bet enter <id> a|b <amount>`',
                '`finance` - treasury, money supply and bank position',
                '`report` - output, prices, inflation and unemployment',
                '`credit` - credit score and borrowing limit',
                '`transactions` - recent wallet ledger',
                '`reichsbank` - deposit account; `reichsbank deposit|withdraw <amount>`',
            ].join('\n'),
            inline: false,
        });
    }
    await send(ctx, { embeds: [emb] });
}
async function dispatch(ctx) {
    const name = normalize(ctx.command);
    if (!name) {
        return send(ctx, { embeds: [embed('Unknown command', `Use \`${ctx.prefix}help\` for the command list.`, COLORS.warning)] });
    }
    try {
        if (name === 'model') {
            ctx.command = 'config';
            ctx.args = ['model', ...ctx.args];
            return await admin.config(ctx);
        }
        const handler = handlers[name];
        if (!handler) throw new Error(`no handler for ${name}`);
        return await handler(ctx);
    } catch (err) {
        if (err instanceof permissions.PermissionError) {
            return error(ctx, err.message);
        }
        console.error(`[command:${ctx.command}]`, err);
        return error(ctx, err.message || 'The operation could not be completed.');
    }
}
function parseInput(text) {
    const tokens = tokenize(text);
    return { command: tokens[0] || '', args: tokens.slice(1), rest: String(text || '').trim().split(/\s+/).slice(1).join(' ') };
}

module.exports = {
    aliases,
    handlers,
    normalize,
    dispatch,
    parseInput,
    help: helpMenu.open,
};
