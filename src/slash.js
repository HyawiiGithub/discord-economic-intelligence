'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { SECTORS, OFFICES } = require('./config');
const style = require('./style');

const sectorChoices = Object.entries(SECTORS).map(([value, info]) => ({ name: info.label, value }));
const officeChoices = Object.entries(OFFICES).map(([value, info]) => ({ name: info.label, value }));
const configChoices = [
    { name: 'Economic model', value: 'model' },
    { name: 'Theme', value: 'style' },
    { name: 'Currency', value: 'currency' },
    { name: 'Tax rate', value: 'tax' },
    { name: 'Policy rate', value: 'rate' },
    { name: 'Reserve requirement', value: 'reserve' },
    { name: 'Cycle minutes', value: 'cycle' },
    { name: 'Work cooldown', value: 'workcooldown' },
    { name: 'Starter balance', value: 'starter' },
    { name: 'Jarvis daily limit', value: 'jarvis' },
    { name: 'Command prefix', value: 'prefix' },
    { name: 'State bank name', value: 'bankname' },
    { name: 'Treasury name', value: 'govname' },
];

function companyOption(option, name, description) {
    return option.setName(name).setDescription(description).setRequired(true);
}
const commands = [
    new SlashCommandBuilder().setName('economy').setDescription('Open the economic overview dashboard.'),
    new SlashCommandBuilder().setName('market').setDescription('Inspect goods prices, stock and demand.'),
    new SlashCommandBuilder().setName('bank').setDescription('Inspect State Bank rates, reserves and your credit.'),
    new SlashCommandBuilder().setName('government').setDescription('Inspect the treasury, revenue, spending and bonds.'),
    new SlashCommandBuilder().setName('jobs').setDescription('List open positions.'),
    new SlashCommandBuilder().setName('work').setDescription('Work your current shift.'),
    new SlashCommandBuilder().setName('apply').setDescription('Apply for an open position.')
        .addIntegerOption(o => o.setName('job').setDescription('Job id').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('resign').setDescription('Resign from your current position.'),
    new SlashCommandBuilder().setName('portfolio').setDescription('View your wallet, deposits, loans, bonds and shares.'),
    new SlashCommandBuilder().setName('pay').setDescription('Transfer money to another member.')
        .addUserOption(o => o.setName('member').setDescription('Recipient').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Amount, e.g. 250 or 1.5k').setRequired(true)),
    new SlashCommandBuilder().setName('deposit').setDescription('Deposit money with the State Bank.')
        .addStringOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('withdraw').setDescription('Withdraw money from the State Bank.')
        .addStringOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('loan').setDescription('View your credit or take a loan.')
        .addStringOption(o => o.setName('amount').setDescription('Principal; omit to view your position'))
        .addIntegerOption(o => o.setName('term').setDescription('Term in cycles').setMinValue(1).setMaxValue(120)),
    new SlashCommandBuilder().setName('repay').setDescription('Repay an active loan.')
        .addStringOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('bond').setDescription('Government bonds.')
        .addSubcommand(sc => sc.setName('buy').setDescription('Purchase a bond.')
            .addStringOption(o => o.setName('amount').setDescription('Face value').setRequired(true))
            .addIntegerOption(o => o.setName('term').setDescription('Term in cycles').setMinValue(1).setMaxValue(120)))
        .addSubcommand(sc => sc.setName('list').setDescription('List your bonds.')),
    new SlashCommandBuilder().setName('jarvis').setDescription('Ask Jarvis about the live economy.')
        .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(900)),
    new SlashCommandBuilder().setName('company').setDescription('Company registry and management.')
        .addSubcommand(sc => sc.setName('create').setDescription('Incorporate a company.')
            .addStringOption(o => companyOption(o, 'name', 'Company name'))
            .addStringOption(o => o.setName('sector').setDescription('Sector').setRequired(true).addChoices(...sectorChoices))
            .addStringOption(o => o.setName('capital').setDescription('Paid-in capital; default 500'))
            .addStringOption(o => o.setName('description').setDescription('Short description')))
        .addSubcommand(sc => sc.setName('list').setDescription('List active companies.'))
        .addSubcommand(sc => sc.setName('info').setDescription('Inspect a company.')
            .addStringOption(o => o.setName('company').setDescription('Name, ticker or id').setRequired(true)))
        .addSubcommand(sc => sc.setName('job').setDescription('Post a job.')
            .addStringOption(o => companyOption(o, 'company', 'Company'))
            .addStringOption(o => o.setName('wage').setDescription('Wage per shift').setRequired(true))
            .addStringOption(o => o.setName('title').setDescription('Job title').setRequired(true))
            .addIntegerOption(o => o.setName('slots').setDescription('Number of positions').setMinValue(1).setMaxValue(50)))
        .addSubcommand(sc => sc.setName('price').setDescription('Set the company price modifier.')
            .addStringOption(o => companyOption(o, 'company', 'Company'))
            .addNumberOption(o => o.setName('percent').setDescription('80 to 120').setRequired(true).setMinValue(80).setMaxValue(120)))
        .addSubcommand(sc => sc.setName('dividend').setDescription('Distribute all company cash as a dividend.')
            .addStringOption(o => companyOption(o, 'company', 'Company'))),
    new SlashCommandBuilder().setName('buygoods').setDescription('Buy goods from a company.')
        .addStringOption(o => companyOption(o, 'company', 'Company'))
        .addStringOption(o => o.setName('good').setDescription('Good key, e.g. food').setRequired(true))
        .addIntegerOption(o => o.setName('quantity').setDescription('Quantity').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('stocks').setDescription('List publicly traded companies.'),
    new SlashCommandBuilder().setName('ipo').setDescription('List a company on the public market.')
        .addStringOption(o => companyOption(o, 'company', 'Company'))
        .addStringOption(o => o.setName('price').setDescription('Offer price per share')),
    new SlashCommandBuilder().setName('buy').setDescription('Buy shares.')
        .addStringOption(o => companyOption(o, 'company', 'Company'))
        .addStringOption(o => o.setName('amount').setDescription('Total budget').setRequired(true)),
    new SlashCommandBuilder().setName('sellshares').setDescription('Sell shares back to the company.')
        .addStringOption(o => companyOption(o, 'company', 'Company'))
        .addIntegerOption(o => o.setName('shares').setDescription('Number of shares').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('holdings').setDescription('View your share holdings.'),
    new SlashCommandBuilder().setName('crypto').setDescription('Coins, memecoins and local liquidity.')
        .addSubcommand(sc => sc.setName('list').setDescription('Open the crypto market dashboard.'))
        .addSubcommand(sc => sc.setName('buy').setDescription('Buy a coin.')
            .addStringOption(o => o.setName('symbol').setDescription('Ticker or asset id').setRequired(true))
            .addStringOption(o => o.setName('amount').setDescription('Amount to spend').setRequired(true)))
        .addSubcommand(sc => sc.setName('sell').setDescription('Sell a coin.')
            .addStringOption(o => o.setName('symbol').setDescription('Ticker or asset id').setRequired(true))
            .addIntegerOption(o => o.setName('tokens').setDescription('Number of coins').setRequired(true).setMinValue(1)))
        .addSubcommand(sc => sc.setName('create').setDescription('Launch a memecoin.')
            .addStringOption(o => o.setName('name').setDescription('Coin name').setRequired(true))
            .addStringOption(o => o.setName('symbol').setDescription('Ticker, 2-8 characters').setRequired(true))
            .addStringOption(o => o.setName('liquidity').setDescription('Initial liquidity; minimum RM 100')))
        .addSubcommand(sc => sc.setName('portfolio').setDescription('View your coin holdings.'))
        .addSubcommand(sc => sc.setName('chart').setDescription('Show coin price history.')
            .addStringOption(o => o.setName('symbol').setDescription('Ticker or asset id').setRequired(true))),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your daily allowance.'),
    new SlashCommandBuilder().setName('rob').setDescription('Attempt to rob another household.')
        .addUserOption(o => o.setName('member').setDescription('Target').setRequired(true)),
    new SlashCommandBuilder().setName('casino').setDescription('Play a table game.')
        .addStringOption(o => o.setName('game').setDescription('Game').setRequired(true)
            .addChoices(
                { name: 'Coinflip', value: 'coinflip' },
                { name: 'Dice', value: 'dice' },
                { name: 'Roulette', value: 'roulette' },
                { name: 'Slots', value: 'slots' },
                { name: 'Blackjack', value: 'blackjack' },
            ))
        .addStringOption(o => o.setName('bet').setDescription('Wager').setRequired(true))
        .addStringOption(o => o.setName('choice').setDescription('Heads/tails, 1-6, red/black/green/0-36; omit for slots or blackjack')),
    new SlashCommandBuilder().setName('lottery').setDescription('Reichslotterie jackpot and tickets.')
        .addSubcommand(sc => sc.setName('status').setDescription('Show the current draw.'))
        .addSubcommand(sc => sc.setName('buy').setDescription('Buy tickets.')
            .addIntegerOption(o => o.setName('count').setDescription('Number of tickets').setMinValue(1).setMaxValue(100)))
        .addSubcommand(sc => sc.setName('draw').setDescription('Conduct the draw (requires market authority).')),
    new SlashCommandBuilder().setName('shop').setDescription('Reichsmarkt listings and purchases.')
        .addSubcommand(sc => sc.setName('list').setDescription('List active items.'))
        .addSubcommand(sc => sc.setName('buy').setDescription('Purchase an item.')
            .addStringOption(o => o.setName('item').setDescription('Item id or name').setRequired(true)))
        .addSubcommand(sc => sc.setName('use').setDescription('Use a consumable item.')
            .addStringOption(o => o.setName('item').setDescription('Item id or name').setRequired(true))),
    new SlashCommandBuilder().setName('inventory').setDescription('View your inventory.'),
    new SlashCommandBuilder().setName('properties').setDescription('View your property.'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Wealth ranking.')
        .addIntegerOption(o => o.setName('limit').setDescription('1 to 25').setMinValue(1).setMaxValue(25)),
    new SlashCommandBuilder().setName('wealth').setDescription('View a household balance sheet.')
        .addUserOption(o => o.setName('member').setDescription('Member; omit for yourself')),
    new SlashCommandBuilder().setName('profile').setDescription('Member roles, join date, activity and reputation.')
        .addUserOption(o => o.setName('member').setDescription('Member; omit for yourself')),
    new SlashCommandBuilder().setName('activity').setDescription('Observed message and role history.')
        .addUserOption(o => o.setName('member').setDescription('Member; omit for yourself')),
    new SlashCommandBuilder().setName('rep').setDescription('Rate a member. 12 hour cooldown per member.')
        .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('standing').setDescription('Positive or negative').setRequired(true)
            .addChoices({ name: 'Positive', value: '+' }, { name: 'Negative', value: '-' }))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('reputation').setDescription('Public standing for a member.')
        .addUserOption(o => o.setName('member').setDescription('Member; omit for yourself')),
    new SlashCommandBuilder().setName('toprep').setDescription('Reputation ranking.'),
    new SlashCommandBuilder().setName('bet').setDescription('Public wagers.')
        .addSubcommand(sc => sc.setName('list').setDescription('List open wagers.'))
        .addSubcommand(sc => sc.setName('create').setDescription('Open a wager (requires market authority).')
            .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
            .addStringOption(o => o.setName('option_a').setDescription('Option A').setRequired(true))
            .addStringOption(o => o.setName('option_b').setDescription('Option B').setRequired(true)))
        .addSubcommand(sc => sc.setName('enter').setDescription('Enter a wager.')
            .addIntegerOption(o => o.setName('wager').setDescription('Wager id').setRequired(true).setMinValue(1))
            .addStringOption(o => o.setName('side').setDescription('Side').setRequired(true).addChoices({ name: 'A', value: 'a' }, { name: 'B', value: 'b' }))
            .addStringOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
        .addSubcommand(sc => sc.setName('settle').setDescription('Settle a wager (requires market authority).')
            .addIntegerOption(o => o.setName('wager').setDescription('Wager id').setRequired(true).setMinValue(1))
            .addStringOption(o => o.setName('side').setDescription('Winning side').setRequired(true).addChoices({ name: 'A', value: 'a' }, { name: 'B', value: 'b' }))),
    new SlashCommandBuilder().setName('finance').setDescription('Treasury, money supply and bank position.'),
    new SlashCommandBuilder().setName('report').setDescription('Output, prices, inflation and unemployment.'),
    new SlashCommandBuilder().setName('history').setDescription('Recent cycle history.')
        .addIntegerOption(o => o.setName('limit').setDescription('1 to 48').setMinValue(1).setMaxValue(48)),
    new SlashCommandBuilder().setName('credit').setDescription('Credit score, limit and active loans.'),
    new SlashCommandBuilder().setName('transactions').setDescription('Recent wallet ledger entries.')
        .addIntegerOption(o => o.setName('limit').setDescription('1 to 25').setMinValue(1).setMaxValue(25)),
    new SlashCommandBuilder().setName('reichsbank').setDescription('Reichsbank deposit account.')
        .addSubcommand(sc => sc.setName('account').setDescription('Show your account and rates.'))
        .addSubcommand(sc => sc.setName('deposit').setDescription('Deposit money.')
            .addStringOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
        .addSubcommand(sc => sc.setName('withdraw').setDescription('Withdraw money.')
            .addStringOption(o => o.setName('amount').setDescription('Amount').setRequired(true))),
    new SlashCommandBuilder().setName('config').setDescription('View or change the server economic configuration.')
        .addSubcommand(sc => sc.setName('show').setDescription('Show the current configuration.'))
        .addSubcommand(sc => sc.setName('style').setDescription('Choose the visual and institutional theme.')
            .addStringOption(o => o.setName('theme').setDescription('Theme preset').setRequired(true).addChoices(...style.choices())))
        .addSubcommand(sc => sc.setName('channel').setDescription('Bind an update feed to a channel.')
            .addStringOption(o => o.setName('feed').setDescription('Feed').setRequired(true)
                .addChoices(
                    { name: 'Economic overview', value: 'overview' },
                    { name: 'Goods market', value: 'market' },
                    { name: 'Stock exchange', value: 'stocks' },
                    { name: 'Crypto market', value: 'crypto' },
                    { name: 'Lottery', value: 'lottery' },
                    { name: 'Economy report', value: 'report' },
                    { name: 'Audit trail', value: 'audit' },
                ))
            .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false))
            .addBooleanOption(o => o.setName('disable').setDescription('Remove the current binding')))
        .addSubcommand(sc => sc.setName('channels').setDescription('List bound update channels.'))
        .addSubcommand(sc => sc.setName('signals').setDescription('List bound news and announcement channels.'))
        .addSubcommand(sc => sc.setName('intel').setDescription('Bind a channel Jarvis reads for market intelligence.')
            .addStringOption(o => o.setName('kind').setDescription('Signal type').setRequired(true).addChoices({ name: 'News', value: 'news' }, { name: 'Announcements', value: 'announcements' }))
            .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false))
            .addBooleanOption(o => o.setName('disable').setDescription('Remove the binding')))
        .addSubcommand(sc => sc.setName('set').setDescription('Change one setting.')
            .addStringOption(o => o.setName('key').setDescription('Setting').setRequired(true).addChoices(...configChoices))
            .addStringOption(o => o.setName('value').setDescription('New value').setRequired(true))
            .addStringOption(o => o.setName('kind').setDescription('Tax kind for tax changes: income, corporate, payroll, vat or wealth'))),
    new SlashCommandBuilder().setName('powers').setDescription('Show your delegated authority.'),
    new SlashCommandBuilder().setName('grant').setDescription('Grant powers to a role.')
        .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
        .addStringOption(o => o.setName('powers').setDescription('Space or comma separated powers').setRequired(true)),
    new SlashCommandBuilder().setName('revoke').setDescription('Revoke a role’s delegated powers.')
        .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    new SlashCommandBuilder().setName('appoint').setDescription('Appoint a member to an office.')
        .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true))
        .addStringOption(o => o.setName('office').setDescription('Office').setRequired(true).addChoices(...officeChoices))
        .addIntegerOption(o => o.setName('days').setDescription('Term in days; omit for indefinite').setMinValue(0).setMaxValue(3650)),
    new SlashCommandBuilder().setName('dismiss').setDescription('End a member’s appointed office.')
        .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true)),
    new SlashCommandBuilder().setName('appointments').setDescription('List appointed offices.'),
    new SlashCommandBuilder().setName('audit').setDescription('Read the recent audit trail.')
        .addIntegerOption(o => o.setName('limit').setDescription('1 to 30').setMinValue(1).setMaxValue(30)),
    new SlashCommandBuilder().setName('cycle').setDescription('Show cycle status or run a cycle.')
        .addBooleanOption(o => o.setName('run').setDescription('Run a cycle now (requires configuration authority)')),
    new SlashCommandBuilder().setName('jarvisstatus').setDescription('Show Jarvis configuration and your daily usage.'),
    new SlashCommandBuilder().setName('sys').setDescription('Developer-only internal server systems.')
        .addSubcommand(sc => sc.setName('guilds').setDescription('List registered servers.'))
        .addSubcommand(sc => sc.setName('guild').setDescription('Inspect one server.')
            .addStringOption(o => o.setName('guild_id').setDescription('Server id').setRequired(true)))
        .addSubcommand(sc => sc.setName('integrity').setDescription('Run integrity checks.')
            .addStringOption(o => o.setName('guild_id').setDescription('Optional server id')))
        .addSubcommand(sc => sc.setName('reconcile').setDescription('Repair account balances from the ledger.')
            .addStringOption(o => o.setName('guild_id').setDescription('Server id').setRequired(true)))
        .addSubcommand(sc => sc.setName('jarvis').setDescription('Reset Jarvis usage.')
            .addStringOption(o => o.setName('guild_id').setDescription('Server id').setRequired(true))
            .addStringOption(o => o.setName('user_id').setDescription('Optional user id')))
        .addSubcommand(sc => sc.setName('set').setDescription('Set a server configuration value.')
            .addStringOption(o => o.setName('guild_id').setDescription('Server id').setRequired(true))
            .addStringOption(o => o.setName('key').setDescription('Setting').setRequired(true))
            .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true)))
        .addSubcommand(sc => sc.setName('vacuum').setDescription('Checkpoint and vacuum the database.')),
    new SlashCommandBuilder().setName('help').setDescription('Paginated command reference with search.')
        .addStringOption(o => o.setName('query').setDescription('Search commands')),
];

function toCommand(interaction) {
    const name = interaction.commandName;
    const sub = interaction.options.getSubcommand(false);
    const string = key => interaction.options.getString(key);
    const integer = key => interaction.options.getInteger(key);
    const user = key => interaction.options.getUser(key);
    const role = key => interaction.options.getRole(key);
    switch (name) {
        case 'economy':
        case 'market':
        case 'bank':
        case 'government':
        case 'jobs':
        case 'work':
        case 'resign':
        case 'portfolio':
        case 'stocks':
        case 'holdings':
        case 'daily':
        case 'inventory':
        case 'properties':
        case 'finance':
        case 'report':
        case 'credit':
        case 'powers':
        case 'appointments':
        case 'jarvisstatus':
            return { command: name, args: [] };
        case 'help':
            return { command: 'help', args: string('query') ? [string('query')] : [] };
        case 'rob':
            return { command: 'rob', args: [user('member').id] };
        case 'casino': {
            const game = string('game');
            const choice = string('choice');
            const bet = string('bet');
            return { command: 'casino', args: game === 'slots' || game === 'blackjack' ? [game, bet] : [game, choice || '', bet] };
        }
        case 'lottery':
            if (sub === 'buy') return { command: 'lottery', args: ['buy', String(integer('count') || 1)] };
            if (sub === 'draw') return { command: 'lottery', args: ['draw'] };
            return { command: 'lottery', args: ['status'] };
        case 'shop':
            if (sub === 'buy') return { command: 'shop', args: ['buy', string('item')] };
            if (sub === 'use') return { command: 'shop', args: ['use', string('item')] };
            return { command: 'shop', args: [] };
        case 'crypto':
            if (sub === 'buy') return { command: 'crypto', args: ['buy', string('symbol'), string('amount')] };
            if (sub === 'sell') return { command: 'crypto', args: ['sell', string('symbol'), String(integer('tokens'))] };
            if (sub === 'create') return { command: 'crypto', args: ['create', string('name'), string('symbol'), string('liquidity') || ''] };
            if (sub === 'portfolio') return { command: 'crypto', args: ['portfolio'] };
            if (sub === 'chart') return { command: 'crypto', args: ['chart', string('symbol')] };
            return { command: 'crypto', args: ['list'] };
        case 'profile':
            return { command: 'profile', args: user('member') ? [user('member').id] : [] };
        case 'activity':
            return { command: 'activity', args: user('member') ? [user('member').id] : [] };
        case 'reputation':
            return { command: 'reputation', args: user('member') ? [user('member').id] : [] };
        case 'rep':
            return { command: 'rep', args: [user('member').id, string('standing'), string('reason') || ''].filter(Boolean) };
        case 'toprep':
            return { command: 'toprep', args: [] };
        case 'leaderboard':
            return { command: 'leaderboard', args: integer('limit') ? [String(integer('limit'))] : [] };
        case 'wealth':
            return { command: 'wealth', args: user('member') ? [user('member').id] : [] };
        case 'bet':
            if (sub === 'create') return { command: 'bet', args: ['create', string('title'), string('option_a'), string('option_b')] };
            if (sub === 'enter') return { command: 'bet', args: ['enter', String(integer('wager')), string('side'), string('amount')] };
            if (sub === 'settle') return { command: 'bet', args: ['settle', String(integer('wager')), string('side')] };
            return { command: 'bet', args: ['list'] };
        case 'history':
            return { command: 'history', args: integer('limit') ? [String(integer('limit'))] : [] };
        case 'transactions':
            return { command: 'transactions', args: integer('limit') ? [String(integer('limit'))] : [] };
        case 'reichsbank':
            if (sub === 'deposit') return { command: 'reichsbank', args: ['deposit', string('amount')] };
            if (sub === 'withdraw') return { command: 'reichsbank', args: ['withdraw', string('amount')] };
            return { command: 'reichsbank', args: [] };
        case 'apply':
            return { command: 'apply', args: [String(integer('job'))] };
        case 'pay':
            return { command: 'pay', args: [user('member').id, string('amount')] };
        case 'deposit':
            return { command: 'deposit', args: [string('amount')] };
        case 'withdraw':
            return { command: 'withdraw', args: [string('amount')] };
        case 'loan': {
            const amount = string('amount');
            const term = integer('term');
            return { command: 'loan', args: amount ? [amount, term ? String(term) : ''] : [] };
        }
        case 'repay':
            return { command: 'repay', args: [string('amount')] };
        case 'bond':
            return sub === 'buy'
                ? { command: 'bond', args: ['buy', string('amount'), integer('term') ? String(integer('term')) : ''] }
                : { command: 'bond', args: [] };
        case 'jarvis': {
            const question = string('question');
            return { command: 'jarvis', args: question.split(/\s+/), rest: question };
        }
        case 'company':
            if (sub === 'create') {
                const capital = string('capital');
                const description = string('description');
                return { command: 'company', args: ['create', string('name'), string('sector'), capital || '', description || ''] };
            }
            if (sub === 'list') return { command: 'company', args: ['list'] };
            if (sub === 'info') return { command: 'company', args: ['info', string('company')] };
            if (sub === 'job') return { command: 'company', args: ['job', string('company'), string('wage'), String(integer('slots') || 1), string('title')] };
            if (sub === 'price') return { command: 'company', args: ['price', string('company'), String(interaction.options.getNumber('percent'))] };
            if (sub === 'dividend') return { command: 'company', args: ['dividend', string('company')] };
            return { command: 'company', args: ['list'] };
        case 'buygoods':
            return { command: 'buygoods', args: [string('company'), string('good'), String(integer('quantity'))] };
        case 'ipo':
            return { command: 'ipo', args: [string('company'), string('price') || ''].filter(Boolean) };
        case 'buy':
            return { command: 'buy', args: [string('company'), string('amount')] };
        case 'sellshares':
            return { command: 'sellshares', args: [string('company'), String(integer('shares'))] };
        case 'config':
            if (sub === 'show') return { command: 'config', args: ['show'] };
            if (sub === 'style') return { command: 'config', args: ['style', string('theme')] };
            if (sub === 'channel') {
                const channel = interaction.options.getChannel('channel');
                const disabled = interaction.options.getBoolean('disable');
                return { command: 'config', args: ['channel', string('feed'), disabled || !channel ? 'off' : channel.id] };
            }
            if (sub === 'channels') return { command: 'config', args: ['channels'] };
            if (sub === 'signals') return { command: 'config', args: ['signals'] };
            if (sub === 'intel') {
                const channel = interaction.options.getChannel('channel');
                const disabled = interaction.options.getBoolean('disable');
                return { command: 'config', args: ['intel', string('kind'), disabled || !channel ? 'off' : channel.id] };
            }
            if (sub === 'set') {
                const key = string('key');
                const value = string('value');
                const kind = string('kind');
                return { command: 'config', args: key === 'tax' ? ['tax', kind || '', value] : [key, value] };
            }
            return { command: 'config', args: ['show'] };
        case 'grant':
            return { command: 'powers', args: ['role', role('role').id, string('powers')] };
        case 'revoke':
            return { command: 'powers', args: ['revoke', role('role').id] };
        case 'appoint':
            return { command: 'appoint', args: [user('member').id, string('office'), integer('days') ? String(integer('days')) : ''] };
        case 'dismiss':
            return { command: 'dismiss', args: [user('member').id] };
        case 'audit':
            return { command: 'audit', args: integer('limit') ? [String(integer('limit'))] : [] };
        case 'cycle':
            return { command: 'cycle', args: interaction.options.getBoolean('run') ? ['run'] : [] };
        case 'sys':
            if (sub === 'guilds') return { command: 'sys', args: ['guilds'] };
            if (sub === 'guild') return { command: 'sys', args: ['guild', string('guild_id')] };
            if (sub === 'integrity') return { command: 'sys', args: ['integrity', string('guild_id') || ''].filter(Boolean) };
            if (sub === 'reconcile') return { command: 'sys', args: ['reconcile', string('guild_id')] };
            if (sub === 'jarvis') return { command: 'sys', args: ['jarvis', 'reset', string('guild_id'), string('user_id') || ''].filter((value, index) => value || index < 3) };
            if (sub === 'set') return { command: 'sys', args: ['set', string('guild_id'), string('key'), string('value')] };
            if (sub === 'vacuum') return { command: 'sys', args: ['vacuum'] };
            return { command: 'sys', args: ['guilds'] };
        default:
            return { command: name, args: [] };
    }
}

module.exports = {
    commands,
    toCommand,
};
