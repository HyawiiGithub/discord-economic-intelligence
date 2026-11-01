'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const tempDir = process.env.TEMP || process.env.TMP || process.cwd();
const dbPath = path.join(tempDir, `aithing-test-${Date.now()}.db`);
process.env.ECON_DB_PATH = dbPath;
process.env.OPENCODE_API_KEY = '';
process.env.OPENROUTER_API_KEY = '';

const root = path.join(__dirname, '..');
const db = require(path.join(root, 'src', 'db'));
const accounts = require(path.join(root, 'src', 'economy', 'accounts'));
const bank = require(path.join(root, 'src', 'economy', 'bank'));
const government = require(path.join(root, 'src', 'economy', 'government'));
const companies = require(path.join(root, 'src', 'economy', 'companies'));
const securities = require(path.join(root, 'src', 'economy', 'securities'));
const market = require(path.join(root, 'src', 'economy', 'market'));
const cycle = require(path.join(root, 'src', 'economy', 'cycle'));
const permissions = require(path.join(root, 'src', 'permissions'));
const jarvis = require(path.join(root, 'src', 'jarvis'));
const community = require(path.join(root, 'src', 'economy', 'community'));
const cryptoMarket = require(path.join(root, 'src', 'economy', 'crypto'));
const social = require(path.join(root, 'src', 'economy', 'social'));
const news = require(path.join(root, 'src', 'economy', 'news'));
const resetEconomy = require(path.join(root, 'src', 'economy', 'reset'));
const tools = require(path.join(root, 'src', 'tools'));
const style = require(path.join(root, 'src', 'style'));
const feeds = require(path.join(root, 'src', 'feeds'));
const help = require(path.join(root, 'src', 'help'));
const bugfix = require(path.join(root, 'src', 'bugfix'));
const { renderOverview } = require(path.join(root, 'src', 'ui', 'overview'));
const { renderMarket } = require(path.join(root, 'src', 'ui', 'market'));
const { renderStocks } = require(path.join(root, 'src', 'ui', 'stocks'));
const { renderCrypto } = require(path.join(root, 'src', 'ui', 'crypto'));
const cards = require(path.join(root, 'src', 'ui', 'cards'));
const helpers = require(path.join(root, 'src', 'commands', 'helpers'));
const slash = require(path.join(root, 'src', 'slash'));

const guildId = '999900';
const ownerId = '900001';
const workerId = '900002';
const investorId = '900003';
const jarvisId = '900004';
const guild = {
    id: guildId,
    name: 'Test Jurisdiction',
    ownerId,
    members: {
        cache: new Map(),
        fetch: async id => member(id, false),
    },
};
function member(id, admin, roles) {
    return {
        id,
        displayName: `Member ${id}`,
        guild,
        roles: { cache: new Map((roles || []).map(role => [role, { id: role }])) },
        permissions: { has: permission => !!admin && String(permission).toLowerCase() === 'administrator' },
    };
}
const admin = member(ownerId, true);
function ledgerSum() {
    return Number(db.get('SELECT COALESCE(SUM(delta), 0) AS total FROM ledger_entries WHERE guild_id = ?', [guildId]).total);
}
function ledgerSumFor(id) {
    return Number(db.get('SELECT COALESCE(SUM(delta), 0) AS total FROM ledger_entries WHERE guild_id = ?', [String(id)]).total);
}
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') throw new Error('use testAsync for async tests');
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}
async function testAsync(name, fn) {
    try {
        await fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

(async () => {
    db.ensureGuild(guildId, guild.name);

    test('starter balances are minted per household', () => {
        accounts.ensureUser(guildId, ownerId, 'Owner');
        accounts.ensureUser(guildId, workerId, 'Worker');
        accounts.ensureUser(guildId, investorId, 'Investor');
        assert.equal(db.walletBalance(guildId, ownerId), 100000);
        assert.equal(ledgerSum(), 0);
    });

    const company = companies.create(guildId, ownerId, 'Test Agriculture', 'agriculture', 'Primary producer', 30000);
    test('company formation pays licence and capital', () => {
        assert.equal(company.cash, 30000);
        assert.equal(db.walletBalance(guildId, ownerId), 45000);
        assert.equal(ledgerSum(), 0);
    });

    const job = companies.postJob(guildId, ownerId, company.id, 'Field hand', 5000, 1);
    companies.applyJob(guildId, workerId, job.id);
    const shift = companies.work(guildId, workerId);
    test('payroll, income tax and production balance', () => {
        assert.equal(shift.gross, 5000);
        assert.equal(shift.incomeTax, 750);
        assert.equal(shift.payrollTax, 600);
        assert.equal(shift.net, 4250);
        assert.equal(db.walletBalance(guildId, workerId), 104250);
        assert.equal(ledgerSum(), 0);
    });

    const stockBefore = db.get('SELECT * FROM inventory WHERE guild_id = ? AND company_id = ? AND good_key = ?', [guildId, company.id, 'food']);
    const sale = companies.sellGoods(guildId, workerId, company.id, 'food', 1);
    test('goods sales collect VAT and move inventory', () => {
        assert.equal(sale.net, 4500);
        assert.equal(sale.vat, 360);
        assert.equal(db.walletBalance(guildId, workerId), 99390);
        const stockAfter = db.get('SELECT * FROM inventory WHERE guild_id = ? AND company_id = ? AND good_key = ?', [guildId, company.id, 'food']);
        assert.equal(Number(stockAfter.quantity), Number(stockBefore.quantity) - 1);
        assert.equal(ledgerSum(), 0);
    });

    const first = cycle.runCycle(guildId);
    test('cycle records a snapshot and company flows', () => {
        assert.equal(first.tick, 1);
        assert.ok(first.snapshot.gdp_cents > 0);
        assert.equal(Number(db.getGuild(guildId).last_cycle_tick), 1);
        assert.equal(db.all('SELECT * FROM company_flows WHERE guild_id = ?', [guildId]).length, 1);
        assert.ok(market.goodsList(guildId).some(good => good.last_sales_volume > 0));
        assert.equal(ledgerSum(), 0);
    });

    const taxable = companies.create(guildId, investorId, 'Taxable Produce', 'agriculture', 'No payroll', 10000);
    companies.addInventory(guildId, taxable.id, 'food', 1);
    companies.sellGoods(guildId, workerId, taxable.id, 'food', 1);
    const second = cycle.runCycle(guildId);
    test('cycles are monotonic and atomic', () => {
        assert.equal(second.tick, 2);
        assert.equal(market.history(guildId, 10).length, 2);
        assert.equal(ledgerSum(), 0);
    });

    test('corporate tax is collected on positive cycle profit', () => {
        const result = second.companies.find(row => row.companyId === taxable.id);
        assert.ok(result.taxPaid > 0);
        assert.equal(companies.financials(guildId, taxable.id).periodTax, result.taxPaid);
        assert.equal(ledgerSum(), 0);
    });

    accounts.depositToBank(guildId, ownerId, 20000);
    const loan = bank.borrow(guildId, ownerId, 10000, 12);
    test('deposits and loan disbursement preserve the ledger', () => {
        assert.equal(db.depositBalance(guildId, ownerId), 20000);
        assert.equal(bank.summary(guildId).vault, 10000);
        assert.equal(bank.summary(guildId).loans, 10000);
        assert.equal(ledgerSum(), 0);
        assert.ok(loan.loanId > 0);
    });
    bank.repay(guildId, ownerId, 2500);
    bank.runCycle(guildId);
    test('loan servicing reduces bank assets and preserves the ledger', () => {
        assert.ok(bank.summary(guildId).deposits >= 20000);
        assert.equal(ledgerSum(), 0);
    });

    const bond = government.purchaseBond(guildId, ownerId, 5000, 2);
    government.runCycle(guildId);
    government.runCycle(guildId);
    test('bonds pay coupon and redeem at face value', () => {
        const rows = government.bondsFor(guildId, ownerId);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].status, 'redeemed');
        assert.equal(ledgerSum(), 0);
        assert.ok(bond.face === 5000);
    });

    const beforeDividend = db.balanceOf(guildId, 'company', String(company.id), 'cash');
    const dividend = companies.dividend(guildId, ownerId, company.id);
    test('dividend distribution pays withholding tax', () => {
        assert.ok(beforeDividend > 0);
        assert.ok(dividend.amount > 0);
        assert.equal(ledgerSum(), 0);
    });

    const ipo = securities.ipo(guildId, ownerId, company.id, 25);
    const purchase = securities.buy(guildId, workerId, company.id, 2000);
    const saleBack = securities.sell(guildId, workerId, company.id, 5);
    test('public listing and share market settle without creating money', () => {
        assert.equal(ipo.offer, 25);
        assert.ok(purchase.shares > 0);
        assert.ok(saleBack.net > 0);
        assert.equal(ledgerSum(), 0);
        assert.ok(securities.marketView(guildId).listed.length >= 1);
        assert.ok(securities.history(guildId, company.id, 10).length >= 2);
    });

    test('role powers and appointments resolve authority', () => {
        const roleId = '900100';
        const roleMember = member(workerId, false, [roleId]);
        assert.equal(permissions.hasPower(guildId, roleMember, 'bank'), false);
        permissions.grantRolePower(guildId, roleId, 'bank,audit', ownerId);
        assert.equal(permissions.hasPower(guildId, roleMember, 'bank'), true);
        permissions.revokeRolePower(guildId, roleId, ownerId);
        assert.equal(permissions.hasPower(guildId, roleMember, 'bank'), false);
        permissions.appoint(guildId, workerId, 'governor', ownerId, { days: 0 });
        assert.equal(permissions.hasPower(guildId, roleMember, 'bank'), true);
        permissions.dismiss(guildId, workerId, ownerId);
        assert.equal(permissions.hasPower(guildId, roleMember, 'bank'), false);
    });

    await testAsync('Jarvis enforces the daily limit and falls back without a provider', async () => {
        const answers = [];
        for (let i = 0; i < 5; i += 1) {
            answers.push(await jarvis.ask({ guildId, userId: jarvisId, member: admin, question: 'Summarise the economy' }));
        }
        assert.equal(answers[0].remaining, 4);
        assert.equal(answers[4].remaining, 0);
        await assert.rejects(() => jarvis.ask({ guildId, userId: jarvisId, member: admin, question: 'One more' }), /daily limit/);
        assert.equal(jarvis.usageFor(guildId, jarvisId).used, 5);
    });

    test('overview renderer produces a complete canvas', () => {
        const out = renderOverview(guildId);
        assert.ok(out.buffer.length > 40000);
        assert.match(out.filename, /\.png$/);
        assert.ok(market.live(guildId).goods.length >= 10);
    });

    test('market renderer produces a complete canvas', () => {
        const out = renderMarket(guildId);
        assert.ok(out.buffer.length > 40000);
        assert.match(out.filename, /^market-.*\.png$/);
    });

    const styledGuildId = '1425924508245692448';
    const styledUser = '910001';
    test('German Empire theme is the server default and can be switched', () => {
        const row = db.ensureGuild(styledGuildId, 'Kaiserreich Test');
        assert.equal(row.style_key, 'german_empire_1914');
        assert.equal(style.forGuild(styledGuildId, row).label, 'Deutsches Kaiserreich · 1914');
        db.updateGuild(styledGuildId, { style_key: 'reichsmark' });
        assert.equal(style.forGuild(styledGuildId).label, 'TA Reichsmark Economy');
        db.updateGuild(styledGuildId, { style_key: 'ussr' });
        assert.equal(style.forGuild(styledGuildId).currency, 'RUB');
        assert.equal(style.forGuild(styledGuildId).model, 'state_led');
        db.updateGuild(styledGuildId, { style_key: 'german_empire_1914', style_custom: JSON.stringify({ label: 'Custom Reich', theme: { accent: '#ff0000' } }) });
        assert.equal(style.forGuild(styledGuildId).label, 'Custom Reich');
        assert.equal(style.forGuild(styledGuildId).theme.accent, '#ff0000');
        db.updateGuild(styledGuildId, { style_custom: null });
        assert.equal(style.forGuild(styledGuildId).label, 'Deutsches Kaiserreich · 1914');
    });

    test('themed community systems seed their market and settle through the ledger', () => {
        community.ensure(styledGuildId);
        assert.ok(community.shopList(styledGuildId).length >= 6);
        assert.ok(securities.marketView(styledGuildId).listed.length >= 5);
        const allowance = community.daily(styledGuildId, styledUser, 'Kaiser');
        assert.equal(allowance.amount, 25000);
        assert.throws(() => community.daily(styledGuildId, styledUser, 'Kaiser'), /already claimed/);
        const items = community.shopList(styledGuildId);
        const card = items.find(item => item.name === 'Reichsbürgerkarte');
        const purchase = community.buyItem(styledGuildId, styledUser, 'Kaiser', String(card.id));
        assert.equal(purchase.tax, 200);
        assert.equal(db.walletBalance(styledGuildId, styledUser), 122300);
        const tickets = community.buyLottery(styledGuildId, styledUser, 'Kaiser', 2);
        assert.equal(tickets.cost, 10000);
        assert.equal(db.walletBalance(styledGuildId, styledUser), 112300);
        const bet = community.createBet(styledGuildId, styledUser, 'Test wager', 'A', 'B');
        community.enterBet(styledGuildId, styledUser, 'Kaiser', bet.id, 'a', 1000);
        const settled = community.settleBet(styledGuildId, styledUser, bet.id, 'a');
        assert.equal(settled.total, 1000);
        assert.equal(settled.paid, 1000);
        assert.equal(db.walletBalance(styledGuildId, styledUser), 112300);
        const civil = community.civilWork(styledGuildId, '910003', 'Unemployed');
        assert.ok(civil.amount >= 2500 && civil.amount <= 7500);
        assert.throws(() => community.civilWork(styledGuildId, '910003', 'Unemployed'), /still on shift/);
        const sum = Number(db.get('SELECT COALESCE(SUM(delta), 0) AS total FROM ledger_entries WHERE guild_id = ?', [styledGuildId]).total);
        assert.equal(sum, 0);
    });

    test('themed dashboards render with the German Empire and USSR canvases', () => {
        const overview = renderOverview(styledGuildId);
        const board = renderMarket(styledGuildId);
        assert.ok(overview.buffer.length > 40000);
        assert.ok(board.buffer.length > 40000);
        assert.match(overview.filename, /\.png$/);
        assert.match(board.filename, /\.png$/);
        db.updateGuild(styledGuildId, { style_key: 'ussr' });
        const soviet = renderOverview(styledGuildId);
        assert.ok(soviet.buffer.length > 40000);
        db.updateGuild(styledGuildId, { style_key: 'german_empire_1914' });
    });

    test('embedded command cards render as PNG for themed servers', () => {
        const out = cards.renderEmbed(styledGuildId, {
            title: 'Kaiserliche Reichsbank · Konto',
            description: 'Household position at the Reichsbank.',
            fields: [
                { name: 'Wallet', value: 'RM 1,123.00', inline: true },
                { name: 'Deposits', value: 'RM 0.00', inline: true },
                { name: 'Net worth', value: 'RM 1,123.00', inline: true },
                { name: 'Holdings', value: 'RST · 12 shares · RM 14.40\nNDE · 4 shares · RM 3.80', inline: false },
            ],
            footer: { text: 'Deutsches Kaiserreich · 1914 · Reichsbank' },
        });
        assert.ok(out.buffer.length > 30000);
        assert.equal(out.buffer.subarray(0, 4).toString('hex'), '89504e47');
        assert.match(out.filename, /\.png$/);
    });

    await testAsync('command replies attach a themed PNG card automatically', async () => {
        let payload = null;
        const ctx = {
            guildId: styledGuildId,
            guildRow: db.getGuild(styledGuildId),
            interaction: null,
            message: { reply: async value => { payload = value; return value; } },
        };
        await helpers.send(ctx, {
            embeds: [helpers.embed('Kaiserliche Reichsbank · Konto', 'Household position at the Reichsbank.', helpers.COLORS.gold)
                .addFields({ name: 'Wallet', value: 'RM 1,123.00', inline: true })],
        });
        assert.ok(payload);
        assert.equal(payload.files.length, 1);
        assert.ok(payload.files[0].attachment.length > 30000);
        assert.match(payload.embeds[0].data.image.url, /^attachment:\/\/.*\.png$/);
    });

    await testAsync('plain servers also receive a PNG command card', async () => {
        let payload = null;
        const ctx = {
            guildId,
            guildRow: db.getGuild(guildId),
            interaction: null,
            message: { reply: async value => { payload = value; return value; } },
        };
        await helpers.send(ctx, { embeds: [helpers.embed('Portfolio', 'Household position.', helpers.COLORS.accent)] });
        assert.ok(payload.files && payload.files.length === 1);
        assert.ok(payload.files[0].attachment.length > 20000);
    });

    test('the main developer bypasses server authority and has unlimited Jarvis', () => {
        const developerId = '1082686076491137115';
        const developer = member(developerId, false);
        assert.equal(permissions.isDeveloper(developerId), true);
        assert.equal(permissions.hasPower(styledGuildId, developer, 'config'), true);
        assert.equal(permissions.hasPower(styledGuildId, developer, 'markets'), true);
        const usage = jarvis.usageFor(styledGuildId, developerId);
        assert.equal(usage.unlimited, true);
        assert.equal(usage.remaining, Infinity);
    });

    await testAsync('developer Jarvis is unlimited and remembers recent turns', async () => {
        const developerId = '1082686076491137115';
        let answer = null;
        for (let i = 0; i < 6; i += 1) {
            answer = await jarvis.ask({ guildId: styledGuildId, userId: developerId, member: member(developerId, false), question: `Developer test ${i}` });
        }
        assert.equal(answer.remaining, Infinity);
        assert.ok(jarvis.recentMessages(styledGuildId, developerId, 10).length > 0);
        jarvis.resetMemory(styledGuildId, developerId);
        assert.equal(jarvis.recentMessages(styledGuildId, developerId, 10).length, 0);
    });

    test('crypto and memecoins trade against local liquidity without breaking the ledger', () => {
        const token = cryptoMarket.create(styledGuildId, styledUser, 'Kaiser', 'Test Coin', 'TST', 20000);
        assert.equal(token.symbol, 'TST');
        const buy = cryptoMarket.buy(styledGuildId, styledUser, 'Kaiser', 'TST', 5000);
        assert.ok(buy.tokens > 0);
        assert.ok(cryptoMarket.portfolio(styledGuildId, styledUser).some(row => row.symbol === 'TST'));
        const sell = cryptoMarket.sell(styledGuildId, styledUser, 'TST', 1000);
        assert.ok(sell.net > 0);
        assert.ok(cryptoMarket.list(styledGuildId).some(row => row.symbol === 'TST'));
        const cycleResult = cryptoMarket.runCycle(styledGuildId, 99);
        assert.ok(cycleResult.length >= 1);
        assert.equal(ledgerSumFor(styledGuildId), 0);
        const out = renderCrypto(styledGuildId);
        assert.ok(out.buffer.length > 40000);
        assert.equal(out.buffer.subarray(0, 4).toString('hex'), '89504e47');
    });

    test('stock market, feed payloads and help search render', () => {
        const stocks = renderStocks(styledGuildId);
        assert.ok(stocks.buffer.length > 40000);
        assert.ok(stocks.view.listed.length >= 5);
        feeds.bind(styledGuildId, 'stocks', '123456789012345678');
        feeds.bind(styledGuildId, 'crypto', '123456789012345678');
        assert.ok(feeds.list(styledGuildId).length >= 2);
        for (const key of ['overview', 'market', 'stocks', 'crypto', 'lottery', 'report', 'audit']) {
            const payload = feeds.payloadFor(styledGuildId, key);
            assert.ok(payload.embeds.length === 1);
            assert.ok(payload.files.length === 1);
        }
        const page = help.payload(styledGuildId, 0, true, null);
        assert.equal(page.components.length, 2);
        const result = help.search(styledGuildId, 'crypto', true);
        assert.ok(result.fields[0].value.toLowerCase().includes('crypto'));
    });

    await testAsync('update feeds post once and edit the same message', async () => {
        let sends = 0;
        let edits = 0;
        const channelId = '123456789012345679';
        const message = { id: '555000000000000001', edit: async () => { edits += 1; return message; } };
        const channel = {
            send: async () => { sends += 1; return message; },
            messages: { fetch: async () => message },
        };
        const client = {
            channels: {
                cache: new Map([[channelId, channel]]),
                fetch: async () => channel,
            },
        };
        feeds.bind(styledGuildId, 'market', channelId);
        await feeds.publish(client, styledGuildId, 'market');
        await feeds.publish(client, styledGuildId, 'market');
        assert.equal(sends, 1);
        assert.equal(edits, 1);
        assert.equal(feeds.get(styledGuildId, 'market').message_id, message.id);
    });

    test('bugfix button and code context are wired', () => {
        const row = bugfix.bugButton().toJSON();
        assert.equal(row.components[0].custom_id, 'jarvis:bug');
        assert.equal(row.components[0].label, 'Bug? report here!');
        const context = bugfix.collectCodeContext({ command: 'work', summary: 'Work fails', actual: 'not employed', steps: '' });
        assert.ok(context.includes('FILE: src/commands/economy.js'));
        assert.ok(context.includes('FILE: src/economy/companies.js'));
    });

    test('member activity, role history and public reputation are tracked', () => {
        db.touchMemberActivity(styledGuildId, styledUser, 'Kaiser', '123456789012345678');
        db.recordMemberEvent(styledGuildId, styledUser, 'roles_added', { roleIds: ['777'] });
        const activity = db.activityFor(styledGuildId, styledUser);
        assert.equal(Number(activity.message_count), 1);
        const rating = social.giveRep(styledGuildId, '910002', styledUser, 1, 'helpful in chat');
        assert.equal(rating.summary.score, 1);
        assert.throws(() => social.giveRep(styledGuildId, '910002', styledUser, 1, 'duplicate'), /recently/);
        const summary = social.summary(styledGuildId, styledUser);
        assert.equal(summary.positive, 1);
        assert.ok(summary.events.some(event => event.kind === 'roles_added'));
        assert.ok(social.leaderboard(styledGuildId, 5).some(row => row.target_id === styledUser));
        const profileMember = member(styledUser, false, ['777']);
        profileMember.displayName = 'Kaiser';
        profileMember.user = { username: 'kaiser', createdAt: new Date('2020-01-01T00:00:00Z') };
        profileMember.joinedAt = new Date('2024-01-01T00:00:00Z');
        profileMember.roles.cache.set('777', { id: '777', name: 'Reichsbürger', position: 1 });
        const fakeGuild = {
            id: styledGuildId,
            name: 'Kaiserreich',
            ownerId: '900001',
            memberCount: 1,
            members: { cache: new Map([[styledUser, profileMember]]) },
            channels: { cache: new Map() },
            roles: { cache: new Map([['777', { id: '777', name: 'Reichsbürger', position: 1 }]]) },
        };
        const profile = tools.memberProfile({ guildId: styledGuildId, userId: styledUser, member: profileMember, guild: fakeGuild }, 'Kaiser');
        assert.ok(profile.member.roles.includes('Reichsbürger'));
        assert.equal(profile.member.reputation.score, 1);
        assert.ok(tools.serverContext({ guildId: styledGuildId, guild: fakeGuild }).guild.name === 'Kaiserreich');
    });

    await testAsync('Jarvis handles greetings as normal conversation', async () => {
        const answer = await jarvis.ask({ guildId: styledGuildId, userId: styledUser, member: member(styledUser, false), question: 'hi' });
        assert.equal(answer.smallTalk, true);
        assert.match(answer.text, /what's up|doing well|good/i);
        assert.equal(answer.used, 0);
    });

    test('economy reset clears ledger state and recreates institutions', () => {
        const id = '999904';
        db.ensureGuild(id, 'Reset Test');
        accounts.ensureUser(id, '920001', 'Reset User');
        assert.ok(db.walletBalance(id, '920001') > 0);
        resetEconomy.resetGuild(id);
        assert.equal(db.walletBalance(id, '920001'), 0);
        assert.equal(Number(db.getGuild(id).last_cycle_tick), 0);
        assert.equal(db.all('SELECT * FROM accounts WHERE guild_id = ?', [id]).length > 0, true);
        assert.equal(Number(db.get('SELECT COUNT(*) AS n FROM profiles WHERE guild_id = ?', [id]).n), 0);
    });

    test('news signals apply pressure to goods and stock prices for the next cycle', () => {
        const id = '999905';
        db.ensureGuild(id, 'News Test');
        const at = new Date().toISOString();
        db.run(`INSERT INTO news_signals
            (guild_id, channel_id, message_id, author_id, author_name, headline, content, sentiment, impact_bps, goods, sectors, summary, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'positive', 500, '["food"]', '["agriculture"]', 'Harvest expansion', 'ready', ?)`,
            [id, '123', '456', '920001', 'News', 'Harvest expansion', 'A record harvest expands food supply.', at]);
        const before = Number(db.get('SELECT price_cents FROM goods_market WHERE guild_id = ? AND good_key = ?', [id, 'food']).price_cents);
        const applied = news.runCycle(id);
        assert.equal(applied.length, 1);
        assert.equal(Number(db.get('SELECT news_pressure_bps FROM goods_market WHERE guild_id = ? AND good_key = ?', [id, 'food']).news_pressure_bps), 500);
        market.updatePrices(id);
        const after = Number(db.get('SELECT price_cents FROM goods_market WHERE guild_id = ? AND good_key = ?', [id, 'food']).price_cents);
        assert.ok(after > before);
        news.decay(id);
        assert.equal(Number(db.get('SELECT news_pressure_bps FROM goods_market WHERE guild_id = ? AND good_key = ?', [id, 'food']).news_pressure_bps), 0);
        db.run('INSERT INTO message_history (guild_id, channel_id, message_id, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, '123', '789', '920001', 'Citizen', 'The harvest was excellent this year', at]);
        assert.ok(news.search(id, 'harvest', 5).length === 1);
    });

    test('slash command surface is registered', () => {
        assert.ok(slash.commands.length >= 40);
        assert.ok(slash.commands.some(command => command.name === 'economy'));
        assert.ok(slash.commands.some(command => command.name === 'company'));
        assert.ok(slash.commands.some(command => command.name === 'daily'));
        assert.ok(slash.commands.some(command => command.name === 'shop'));
        assert.ok(slash.commands.some(command => command.name === 'report'));
        assert.ok(slash.commands.some(command => command.name === 'crypto'));
        assert.ok(slash.commands.some(command => command.name === 'sys'));
        assert.ok(slash.commands.some(command => command.name === 'help'));
        assert.ok(slash.commands.some(command => command.name === 'profile'));
        assert.ok(slash.commands.some(command => command.name === 'rep'));
    });

    console.log('all tests passed');
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
        try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {}
    }
})().catch(error => {
    console.error(error);
    try { db.close(); } catch {}
    process.exit(1);
});
