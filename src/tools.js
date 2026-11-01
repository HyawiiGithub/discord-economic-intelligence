'use strict';

const db = require('./db');
const accounts = require('./economy/accounts');
const bank = require('./economy/bank');
const companies = require('./economy/companies');
const government = require('./economy/government');
const market = require('./economy/market');
const securities = require('./economy/securities');
const cycle = require('./economy/cycle');
const community = require('./economy/community');
const cryptoMarket = require('./economy/crypto');
const social = require('./economy/social');
const feeds = require('./feeds');
const permissions = require('./permissions');
const { formatMoney, formatBps, formatDateTime } = require('./money');

function money(guildId, value) {
    const guild = db.getGuild(guildId);
    return formatMoney(value, guild ? guild.currency_code : 'USD');
}
function compactCompany(guildId, company) {
    const fin = companies.financials(guildId, company.id);
    return {
        id: fin.id,
        name: fin.name,
        ticker: fin.ticker,
        sector: fin.sector,
        ownerUserId: fin.owner_user_id,
        public: !!fin.public,
        cash: fin.cash,
        cashLabel: money(guildId, fin.cash),
        inventoryValue: fin.inventoryValue,
        bookValue: fin.bookValue,
        marketCap: fin.marketCap,
        periodProfit: fin.profit,
        employees: fin.employees,
        jobs: fin.openJobs,
        sharePriceCents: fin.last_price_cents,
    };
}
function overview(guildId) {
    const guild = db.getGuild(guildId);
    const live = market.live(guildId);
    const gov = government.summary(guildId);
    const stocks = securities.marketView(guildId);
    const state = cycle.status(guildId);
    return {
        guild: {
            name: guild.name,
            currency: guild.currency_code,
            model: guild.model,
            cycleMinutes: guild.cycle_minutes,
        },
        cycle: state,
        output: {
            gdpCents: live.snapshot ? live.snapshot.gdp_cents : 0,
            gdpLabel: money(guildId, live.snapshot ? live.snapshot.gdp_cents : 0),
            changeBps: live.gdpChangeBps,
            consumptionCents: live.snapshot ? live.snapshot.consumption_cents : 0,
            investmentCents: live.snapshot ? live.snapshot.investment_cents : 0,
            governmentCents: live.snapshot ? live.snapshot.government_cents : 0,
        },
        prices: {
            inflationBps: live.inflationBps,
            priceIndex: live.priceIndex,
        },
        labour: {
            workforce: live.workforce,
            employed: live.employed,
            unemploymentBps: live.unemploymentBps,
        },
        money: {
            supplyCents: live.moneySupply,
            supplyLabel: money(guildId, live.moneySupply),
            treasuryCents: live.treasury,
            treasuryLabel: money(guildId, live.treasury),
        },
        bank: live.bank,
        government: {
            balanceCents: gov.balance,
            balanceLabel: money(guildId, gov.balance),
            revenueCents: gov.revenue,
            revenueLabel: money(guildId, gov.revenue),
            spendingCents: gov.spending,
            spendingLabel: money(guildId, gov.spending),
            bonds: gov.bonds,
            bondFaceCents: gov.bondFace,
        },
        securities: {
            listed: stocks.listed.length,
            totalMarketCapCents: stocks.totalMarketCap,
            totalMarketCapLabel: money(guildId, stocks.totalMarketCap),
            top: stocks.top.map(item => ({
                ticker: item.company.ticker,
                name: item.company.name,
                priceCents: item.quote.last,
                marketCapCents: item.marketCap,
                change: item.change,
            })),
        },
        companies: live.companyCount,
    };
}
function goods(guildId) {
    return {
        currency: db.getGuild(guildId).currency_code,
        goods: market.goodsList(guildId).map(row => ({
            key: row.good_key,
            name: row.label,
            unit: row.unit,
            priceCents: row.price_cents,
            priceLabel: money(guildId, row.price_cents),
            changeBps: row.change_bps,
            stock: row.stock,
            salesVolume: row.sales_volume,
            lastSalesVolume: row.last_sales_volume,
            demand: row.demand,
        })),
    };
}
function company(guildId, query) {
    const found = companies.find(guildId, query);
    if (!found) return { error: `No company matched "${query}".` };
    const fin = companies.financials(guildId, found.id);
    return {
        company: {
            id: fin.id,
            name: fin.name,
            ticker: fin.ticker,
            sector: fin.sector,
            ownerUserId: fin.owner_user_id,
            public: !!fin.public,
            cashCents: fin.cash,
            cashLabel: money(guildId, fin.cash),
            inventoryValueCents: fin.inventoryValue,
            bookValueCents: fin.bookValue,
            marketCapCents: fin.marketCap,
            revenueCents: fin.revenue,
            expensesCents: fin.expenses,
            wagesCents: fin.wages,
            taxesCents: fin.taxes,
            periodTaxCents: fin.periodTax,
            periodProfitCents: fin.profit,
            profitAfterTaxCents: fin.profitAfterTax,
            cumulativeProfitCents: fin.cumulativeProfit,
            employees: fin.employees,
            openJobs: fin.openJobs,
            sharePriceCents: fin.last_price_cents,
            sharesOutstanding: fin.shares_outstanding,
            holders: fin.holders.map(h => ({ userId: h.user_id, shares: h.shares })),
            inventory: fin.inventory.map(row => ({ good: row.good_key, quantity: row.quantity, priceCents: row.price_cents })),
            jobs: companies.jobs(guildId, fin.id).map(j => ({ id: j.id, title: j.title, wageCents: j.wage_cents, slots: j.slots, filled: j.filled })),
        },
    };
}
function companyList(guildId) {
    return {
        companies: companies.listView(guildId).slice(0, 20).map(c => compactCompany(guildId, c)),
    };
}
function bankView(guildId) {
    return {
        currency: db.getGuild(guildId).currency_code,
        bank: bank.health(guildId),
        rates: {
            policyBps: bank.policyRateBps(guildId),
            depositBps: bank.depositRateBps(guildId),
            reserveBps: bank.reserveRequirement(guildId),
            policyLabel: formatBps(bank.policyRateBps(guildId)),
            depositLabel: formatBps(bank.depositRateBps(guildId)),
            reserveLabel: formatBps(bank.reserveRequirement(guildId)),
        },
    };
}
function governmentView(guildId) {
    return {
        currency: db.getGuild(guildId).currency_code,
        ...government.summary(guildId),
        balanceLabel: money(guildId, government.summary(guildId).balance),
    };
}
function stocks(guildId) {
    const view = securities.marketView(guildId);
    return {
        currency: db.getGuild(guildId).currency_code,
        totalMarketCapCents: view.totalMarketCap,
        totalMarketCapLabel: money(guildId, view.totalMarketCap),
        listed: view.listed.map(item => ({
            id: item.company.id,
            name: item.company.name,
            ticker: item.company.ticker,
            priceCents: item.quote.last,
            bid: item.quote.bid,
            ask: item.quote.ask,
            change: item.change,
            marketCapCents: item.marketCap,
            bookValueCents: item.quote.bookValue,
        })),
        movers: view.movers.map(item => ({ ticker: item.company.ticker, name: item.company.name, change: item.change })),
    };
}
function stockHistory(guildId, query) {
    const found = companies.find(guildId, query);
    if (!found) return { error: `No company matched "${query}".` };
    return {
        company: { id: found.id, name: found.name, ticker: found.ticker },
        history: securities.history(guildId, found.id, 30).map(row => ({
            tick: row.tick,
            priceCents: row.price_cents,
            marketCapCents: row.market_cap_cents,
            at: row.created_at,
        })),
    };
}
function macroHistory(guildId) {
    return {
        snapshots: market.history(guildId, 20).map(row => ({
            tick: row.tick,
            at: row.at,
            gdpCents: row.gdp_cents,
            consumptionCents: row.consumption_cents,
            investmentCents: row.investment_cents,
            governmentCents: row.government_cents,
            inventoryCents: row.inventory_cents,
            moneySupplyCents: row.money_supply_cents,
            treasuryCents: row.treasury_cents,
            priceIndex: row.price_index,
            unemploymentBps: row.unemployment_bps,
            stockMarketCapCents: row.stock_market_cap_cents,
        })),
    };
}
function jobs(guildId) {
    return {
        currency: db.getGuild(guildId).currency_code,
        jobs: companies.allJobs(guildId).slice(0, 30).map(job => ({
            id: job.id,
            title: job.title,
            company: job.company_name,
            ticker: job.ticker,
            sector: job.sector,
            wageCents: job.wage_cents,
            wageLabel: money(guildId, job.wage_cents),
            slots: job.slots,
            filled: job.filled,
        })),
    };
}
function portfolio(guildId, userId) {
    const profile = db.ensureProfile(guildId, userId);
    const employment = companies.employmentOf(guildId, userId);
    const loans = bank.loansFor(guildId, userId);
    const bonds = government.bondsFor(guildId, userId);
    const holdings = securities.holdings(guildId, userId);
    return {
        currency: db.getGuild(guildId).currency_code,
        walletCents: db.walletBalance(guildId, userId),
        depositCents: db.depositBalance(guildId, userId),
        netWorthCents: db.netWorth(guildId, userId),
        creditScore: profile.credit_score,
        totalIncomeCents: profile.total_income,
        employment: employment ? {
            company: employment.company_name,
            ticker: employment.ticker,
            title: employment.title,
            wageCents: employment.wage_cents,
        } : null,
        loans: loans.map(loan => ({
            id: loan.id,
            balanceCents: loan.balance_cents,
            rateBps: loan.rate_bps,
            status: loan.status,
            nextDueAt: loan.next_due_at,
        })),
        bonds: bonds.map(bond => ({
            id: bond.id,
            faceCents: bond.face_cents,
            rateBps: bond.rate_bps,
            status: bond.status,
            cyclesPaid: bond.cycles_paid,
            termCycles: bond.term_cycles,
        })),
        shares: holdings.map(h => ({
            company: h.name,
            ticker: h.ticker,
            shares: h.shares,
            priceCents: h.last_price_cents,
            valueCents: Number(h.shares) * Number(h.last_price_cents),
        })),
    };
}
function recentTransactions(guildId, userId) {
    return {
        transactions: db.all(`SELECT t.kind, t.memo, t.created_at, e.delta
            FROM transactions t
            JOIN ledger_entries e ON e.tx_id = t.id
            JOIN accounts a ON a.id = e.account_id
            WHERE t.guild_id = ? AND a.owner_type = 'user' AND a.owner_id = ? AND a.kind = 'wallet'
            ORDER BY t.id DESC LIMIT 12`, [guildId, String(userId)]).map(row => ({
            kind: row.kind,
            memo: row.memo,
            at: row.created_at,
            deltaCents: row.delta,
        })),
    };
}
function audit(guildId, limit) {
    return {
        entries: db.recentAudit(guildId, limit || 15).map(row => ({
            action: row.action,
            actorId: row.actor_id,
            at: row.created_at,
            detail: row.detail,
        })),
    };
}
function policy(guildId) {
    const guild = db.getGuild(guildId);
    return {
        name: guild.name,
        model: guild.model,
        currency: guild.currency_code,
        taxes: {
            incomeBps: guild.income_tax_bps,
            corporateBps: guild.corporate_tax_bps,
            payrollBps: guild.payroll_tax_bps,
            vatBps: guild.vat_bps,
            wealthBps: guild.wealth_tax_bps,
        },
        policyRateBps: guild.policy_rate_bps,
        reserveRatioBps: guild.reserve_ratio_bps,
        welfareBps: guild.welfare_bps,
        centralBankIndependence: guild.central_bank_independence,
        marketOpenness: guild.market_openness,
        cycleMinutes: guild.cycle_minutes,
        jarvisLimit: guild.jarvis_limit,
        lastCycleAt: guild.last_cycle_at,
        nextCycleAt: cycle.status(guildId).nextAt,
    };
}
function cryptoView(guildId) {
    cryptoMarket.ensure(guildId);
    return {
        currency: db.getGuild(guildId).currency_code,
        assets: cryptoMarket.list(guildId).map(asset => ({
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            kind: asset.kind,
            priceCents: asset.price_cents,
            priceLabel: money(guildId, asset.price_cents),
            change: asset.change,
            reserveCents: asset.reserve_cents,
            reserveLabel: money(guildId, asset.reserve_cents),
            supply: asset.supply,
            marketCapCents: asset.marketCap,
            volatilityBps: asset.volatility_bps,
        })),
    };
}
function myCrypto(guildId, userId) {
    return {
        currency: db.getGuild(guildId).currency_code,
        holdings: cryptoMarket.portfolio(guildId, userId).map(row => ({
            symbol: row.symbol,
            name: row.name,
            amount: row.amount,
            priceCents: row.price_cents,
            valueCents: row.value_cents,
        })),
    };
}
function wealthRanking(guildId) {
    return {
        leaderboard: community.leaderboard(guildId, 10).map(row => ({
            name: row.name,
            totalCents: row.total,
            totalLabel: money(guildId, row.total),
        })),
    };
}
function lotteryView(guildId) {
    try {
        return { lottery: community.lotteryStatus(guildId) };
    } catch (error) {
        return { error: error.message };
    }
}
function betsView(guildId) {
    try {
        return {
            bets: community.openBets(guildId).map(bet => {
                const stats = community.betStats(guildId, bet.id);
                return { id: bet.id, title: bet.title, optionA: bet.option_a, optionB: bet.option_b, poolA: stats.a.total, poolB: stats.b.total };
            }),
        };
    } catch (error) {
        return { error: error.message };
    }
}
function updateChannels(guildId) {
    return { channels: feeds.list(guildId) };
}
function databaseHealth(guildId) {
    const imbalance = db.all(`SELECT guild_id, SUM(delta) AS total FROM ledger_entries ${guildId ? 'WHERE guild_id = ?' : ''} GROUP BY guild_id HAVING ABS(SUM(delta)) > 0`, guildId ? [String(guildId)] : []);
    const mismatches = db.all(`SELECT a.id, a.guild_id, a.owner_type, a.owner_id, a.kind, a.balance,
        COALESCE(SUM(e.delta), 0) AS ledger_balance FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
        ${guildId ? 'WHERE a.guild_id = ?' : ''} GROUP BY a.id HAVING a.balance <> ledger_balance LIMIT 20`, guildId ? [String(guildId)] : []);
    return { imbalance, mismatches };
}
function findMember(ctx, query) {
    if (!ctx || !ctx.guild) return null;
    const term = String(query || '').trim();
    if (!term || ['me', 'myself', 'self'].includes(term.toLowerCase())) return ctx.member || null;
    const id = term.replace(/[<@!>]/g, '').trim();
    if (/^\d{5,25}$/.test(id)) {
        return ctx.guild.members.cache.get(id) || (ctx.member && String(ctx.member.id) === id ? ctx.member : null);
    }
    const lower = term.toLowerCase();
    return [...ctx.guild.members.cache.values()].find(member =>
        String(member.displayName || '').toLowerCase().includes(lower)
        || String(member.user && member.user.username || '').toLowerCase().includes(lower)
    ) || null;
}
function roleNames(member) {
    if (!member || !member.roles || !member.roles.cache) return [];
    return [...member.roles.cache.values()]
        .filter(role => role && role.name && role.name !== '@everyone')
        .sort((a, b) => (Number(b.position) || 0) - (Number(a.position) || 0))
        .map(role => role.name);
}
function serverContext(ctx) {
    const guild = ctx && ctx.guild;
    if (!guild) {
        const row = db.getGuild(ctx.guildId);
        return { guild: { id: row.guild_id, name: row.name, members: null, channels: null, roles: null } };
    }
    return {
        guild: {
            id: guild.id,
            name: guild.name,
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
            boosts: guild.premiumSubscriptionCount,
            boostTier: guild.premiumTier,
            createdAt: guild.createdAt ? guild.createdAt.toISOString() : null,
            channels: guild.channels.cache ? [...guild.channels.cache.values()].slice(0, 30).map(channel => ({ id: channel.id, name: channel.name, type: channel.type })) : [],
            roles: guild.roles.cache ? [...guild.roles.cache.values()].filter(role => role.name !== '@everyone').sort((a, b) => b.position - a.position).slice(0, 40).map(role => ({ id: role.id, name: role.name, position: role.position, members: role.members ? role.members.size : null, color: role.hexColor })) : [],
        },
    };
}
function memberProfile(ctx, query) {
    const member = findMember(ctx, query);
    if (!member) return { error: `No member matched "${query}". Try a mention, user id, display name or "me".` };
    const data = social.summary(ctx.guildId, member.id);
    return {
        member: {
            id: member.id,
            displayName: member.displayName,
            username: member.user ? member.user.username : null,
            bot: member.user ? !!member.user.bot : false,
            roles: roleNames(member),
            joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
            accountCreatedAt: member.user && member.user.createdAt ? member.user.createdAt.toISOString() : null,
            activity: data.activity,
            reputation: { score: data.score, positive: data.positive, negative: data.negative, total: data.total, recent: data.recent },
            history: data.events,
        },
    };
}
function memberActivity(ctx, query) {
    const member = findMember(ctx, query);
    if (!member) return { error: `No member matched "${query}".` };
    const data = social.summary(ctx.guildId, member.id);
    return { member: { id: member.id, displayName: member.displayName }, activity: data.activity, history: data.events };
}
function memberReputation(ctx, query) {
    const member = findMember(ctx, query);
    if (!member) return { error: `No member matched "${query}".` };
    const data = social.summary(ctx.guildId, member.id);
    return {
        member: { id: member.id, displayName: member.displayName },
        reputation: { score: data.score, positive: data.positive, negative: data.negative, total: data.total, recent: data.recent },
    };
}
function reputationLeaderboard(guildId) {
    return { leaderboard: social.leaderboard(guildId, 10) };
}
function messageHistory(guildId, query, limit) {
    const news = require('./economy/news');
    return {
        messages: news.search(guildId, query, limit).map(row => ({
            channelId: row.channel_id,
            authorId: row.author_id,
            authorName: row.author_name,
            content: row.content,
            createdAt: row.created_at,
        })),
    };
}
function newsView(guildId) {
    const news = require('./economy/news');
    return {
        channels: news.list(guildId),
        signals: news.signals(guildId, 20).map(row => ({
            id: row.id,
            sentiment: row.sentiment,
            impactBps: row.impact_bps,
            goods: row.goods,
            sectors: row.sectors,
            summary: row.summary,
            status: row.status,
            createdAt: row.created_at,
        })),
    };
}
function executionContext(guildId, userId, member, guild) {
    return { guildId: String(guildId), userId: String(userId), member, guild };
}

const definitions = [
    { name: 'get_economy_overview', description: 'Get the current macro picture: output, inflation, unemployment, money supply, treasury, bank and listed equity.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_goods_market', description: 'List every traded good with its current price, change from base price, stock, demand and sales volume.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_company', description: 'Look up one company by id, ticker or name. Returns financials, holders, inventory and jobs.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Company id, ticker or name.' } }, required: ['query'], additionalProperties: false } },
    { name: 'list_companies', description: 'List active companies with cash, inventory, book value, market cap and employment.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_bank', description: 'Get state bank policy rates, reserves, deposits, loans, capital and reserve health.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_government', description: 'Get the treasury balance, recorded revenue, spending and outstanding bonds.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_securities', description: 'Get listed companies, quotes, market capitalisation and biggest movers.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_stock_history', description: 'Get the recorded share-price history for one listed or private company.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Company id, ticker or name.' } }, required: ['query'], additionalProperties: false } },
    { name: 'get_macro_history', description: 'Get recent cycle snapshots for output, prices, money supply, treasury and unemployment.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_jobs', description: 'List open jobs with company, wage and filled slots.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_my_portfolio', description: 'Get the requesting user’s wallet, deposits, loans, bonds, shares, employment and credit score.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_my_recent_transactions', description: 'Get the requesting user’s most recent wallet transactions.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_audit_log', description: 'Read the recent administrative audit log. Requires the audit authority.', parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 30 } }, additionalProperties: false } },
    { name: 'get_policy', description: 'Get the server’s economic model, tax rates, policy rate, reserve ratio and cycle schedule.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_cycle_status', description: 'Get the current cycle number, last cycle time and next cycle time.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_crypto_market', description: 'Get local coins and memecoins with price, change, liquidity, supply and market value.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_my_crypto', description: 'Get the requesting user\'s coin holdings and values.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_wealth_leaderboard', description: 'Get the public household wealth ranking. Do not reveal private transactions.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_lottery', description: 'Get the current lottery jackpot, ticket price, tickets and draw time.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_public_bets', description: 'List open public wagers with pools and sides.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_update_channels', description: 'Developer only. List bound update feed channels for this server.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_database_health', description: 'Developer only. Check ledger imbalance and account balance mismatches.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_server_context', description: 'Get server metadata: owner, member count, channels, roles, boosts and creation date.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_member_profile', description: 'Get a member profile: roles, join date, account age, observed activity, reputation and role/join history. Use "me" or omit query for the requesting user.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Member mention, id, display name or "me".' } }, additionalProperties: false } },
    { name: 'get_member_activity', description: 'Get observed message count, reactions, first/last seen and role history for a member.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Member mention, id, display name or "me".' } }, additionalProperties: false } },
    { name: 'get_member_reputation', description: 'Get a member public reputation score, positive/negative ratings and recent reasons.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Member mention, id, display name or "me".' } }, additionalProperties: false } },
    { name: 'get_reputation_leaderboard', description: 'Get the server reputation ranking.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'search_server_messages', description: 'Search stored server message history for relevant context. Returns public channel messages only, newest first. Use for questions about recent conversations, announcements, news or what people discussed.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Text to search for; omit for newest messages.' }, limit: { type: 'integer', minimum: 1, maximum: 40 } }, additionalProperties: false } },
    { name: 'get_news_signals', description: 'Get the bound news/announcement channels and latest analysed market signals with sentiment, impact and affected goods/sectors.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
];
const openAiTools = definitions.map(def => ({
    type: 'function',
    function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
    },
}));
function execute(name, args, ctx) {
    const guildId = ctx.guildId;
    const userId = ctx.userId;
    switch (name) {
        case 'get_economy_overview': return overview(guildId);
        case 'get_goods_market': return goods(guildId);
        case 'get_company': return company(guildId, args && args.query);
        case 'list_companies': return companyList(guildId);
        case 'get_bank': return bankView(guildId);
        case 'get_government': return governmentView(guildId);
        case 'get_securities': return stocks(guildId);
        case 'get_stock_history': return stockHistory(guildId, args && args.query);
        case 'get_macro_history': return macroHistory(guildId);
        case 'get_jobs': return jobs(guildId);
        case 'get_my_portfolio': return portfolio(guildId, userId);
        case 'get_my_recent_transactions': return recentTransactions(guildId, userId);
        case 'get_audit_log':
            if (!permissions.hasPower(guildId, ctx.member, 'audit')) return { error: 'The audit authority is required.' };
            return audit(guildId, args && args.limit);
        case 'get_policy': return policy(guildId);
        case 'get_cycle_status': return cycle.status(guildId);
        case 'get_crypto_market': return cryptoView(guildId);
        case 'get_my_crypto': return myCrypto(guildId, userId);
        case 'get_wealth_leaderboard': return wealthRanking(guildId);
        case 'get_lottery': return lotteryView(guildId);
        case 'get_public_bets': return betsView(guildId);
        case 'get_update_channels':
            if (!permissions.isDeveloper(userId)) return { error: 'Developer authority is required.' };
            return updateChannels(guildId);
        case 'get_database_health':
            if (!permissions.isDeveloper(userId)) return { error: 'Developer authority is required.' };
            return databaseHealth(guildId);
        case 'get_server_context': return serverContext(ctx);
        case 'get_member_profile': return memberProfile(ctx, args && args.query);
        case 'get_member_activity': return memberActivity(ctx, args && args.query);
        case 'get_member_reputation': return memberReputation(ctx, args && args.query);
        case 'get_reputation_leaderboard': return reputationLeaderboard(guildId);
        case 'search_server_messages': return messageHistory(guildId, args && args.query, args && args.limit);
        case 'get_news_signals': return newsView(guildId);
        default: return { error: `Unknown tool: ${name}` };
    }
}

module.exports = {
    definitions,
    openAiTools,
    execute,
    executionContext,
    overview,
    goods,
    company,
    companyList,
    bankView,
    governmentView,
    stocks,
    stockHistory,
    macroHistory,
    jobs,
    portfolio,
    recentTransactions,
    audit,
    policy,
    cryptoView,
    myCrypto,
    wealthRanking,
    lotteryView,
    betsView,
    updateChannels,
    databaseHealth,
    serverContext,
    memberProfile,
    memberActivity,
    memberReputation,
    reputationLeaderboard,
    messageHistory,
    newsView,
};
