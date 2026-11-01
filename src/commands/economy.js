'use strict';

const { AttachmentBuilder } = require('discord.js');
const db = require('../db');
const accounts = require('../economy/accounts');
const bank = require('../economy/bank');
const government = require('../economy/government');
const companies = require('../economy/companies');
const market = require('../economy/market');
const securities = require('../economy/securities');
const cycle = require('../economy/cycle');
const community = require('../economy/community');
const style = require('../style');
const jarvis = require('../jarvis');
const bugfix = require('../bugfix');
const { renderOverview } = require('../ui/overview');
const { renderMarket } = require('../ui/market');
const { embed, field, send, COLORS, fmt, compact, pct, parseAmount, resolveMember, userTag } = require('./helpers');
const { formatPct, formatDateTime, formatBps, formatMoney } = require('../money');

async function overview(ctx) {
    const out = renderOverview(ctx.guildId);
    const file = new AttachmentBuilder(out.buffer, { name: out.filename });
    const view = market.live(ctx.guildId);
    const state = cycle.status(ctx.guildId);
    const emb = embed('Economic overview', [
        `**${ctx.guild.name}** · cycle **${state.tick}** · ${ctx.guildRow.currency_name}`,
        `Output **${compact(ctx, view.snapshot ? view.snapshot.gdp_cents : 0)}** · inflation **${formatPct(view.inflationBps / 100)}** · unemployment **${formatPct(view.unemploymentBps / 100)}**`,
    ].join('\n'), COLORS.accent)
        .setImage(`attachment://${out.filename}`)
        .setFooter({ text: 'Server-scoped ledger · final values update each cycle' });
    await send(ctx, { files: [file], embeds: [emb] });
}
async function marketView(ctx) {
    const out = renderMarket(ctx.guildId);
    const file = new AttachmentBuilder(out.buffer, { name: out.filename });
    const live = market.live(ctx.guildId);
    const emb = embed('Goods market', `Price index **${(Number(live.priceIndex) / 100).toFixed(2)}** · inflation **${formatPct(live.inflationBps / 100)}** · prices adjust to stock and demand.`, COLORS.gold)
        .setImage(`attachment://${out.filename}`)
        .setFooter({ text: `Cycle ${cycle.status(ctx.guildId).tick} · values in ${ctx.guildRow.currency_code}` });
    await send(ctx, { files: [file], embeds: [emb] });
}
async function bankView(ctx) {
    const s = bank.health(ctx.guildId);
    const user = ctx.userId;
    const loans = bank.loanView(ctx.guildId, user);
    const emb = embed(ctx.guildRow.central_bank_name || 'State Bank', `Monetary conditions for **${ctx.guild.name}**.`, COLORS.blue);
    field(emb, 'Policy rate', pct(ctx, s.policyRateBps), true);
    field(emb, 'Deposit rate', pct(ctx, s.depositRateBps), true);
    field(emb, 'Reserve requirement', pct(ctx, s.reserveRatioBps), true);
    field(emb, 'Vault', fmt(ctx, s.vault), true);
    field(emb, 'Deposits', fmt(ctx, s.deposits), true);
    field(emb, 'Loans', fmt(ctx, s.loans), true);
    field(emb, 'Capital', fmt(ctx, s.capital), true);
    field(emb, 'Reserve coverage', `${(Number(s.reserveBps) / 100).toFixed(2)}%`, true);
    field(emb, 'Status', s.status, true);
    field(emb, 'Your credit', `${loans.score} · limit ${fmt(ctx, loans.limit)}`, false);
    if (loans.loans.length) {
        const active = loans.loans.filter(loan => ['active', 'delinquent'].includes(loan.status));
        field(emb, 'Your loans', active.length
            ? active.map(loan => `#${loan.id} · ${fmt(ctx, loan.balance_cents)} · ${pct(ctx, loan.rate_bps)} · ${loan.status}`).join('\n')
            : 'No active loans.', false);
    }
    await send(ctx, { embeds: [emb] });
}
async function governmentView(ctx) {
    const s = government.summary(ctx.guildId);
    const emb = embed(ctx.guildRow.government_name || 'Treasury', `Public accounts for **${ctx.guild.name}**.`, COLORS.gold);
    field(emb, 'Balance', fmt(ctx, s.balance), true);
    field(emb, 'Recorded revenue', fmt(ctx, s.revenue), true);
    field(emb, 'Recorded spending', fmt(ctx, s.spending), true);
    field(emb, 'Outstanding bonds', String(s.bonds), true);
    field(emb, 'Bond face value', fmt(ctx, s.bondFace), true);
    field(emb, 'Fiscal position', s.revenue >= s.spending ? 'surplus' : 'deficit', true);
    await send(ctx, { embeds: [emb] });
}
async function jobs(ctx) {
    const list = companies.allJobs(ctx.guildId).slice(0, 15);
    const emb = embed('Open positions', list.length
        ? list.map(job => `**#${job.id} ${job.title}** · ${job.company_name} (${job.ticker})\n${fmt(ctx, job.wage_cents)} per shift · ${job.filled}/${job.slots} filled`).join('\n\n')
        : 'No open positions. Company owners can post jobs with `-company job`.', COLORS.accent);
    await send(ctx, { embeds: [emb] });
}
async function work(ctx) {
    let result;
    try {
        result = companies.work(ctx.guildId, ctx.userId);
    } catch (err) {
        if (!/not employed/i.test(err.message || '')) throw err;
        const civil = community.civilWork(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
        const emb = embed(style.title(ctx.guildId, 'civil', 'Civil service shift'), `You worked as **${civil.job}**.`, COLORS.gold);
        field(emb, 'Gross wage', fmt(ctx, civil.amount), true);
        field(emb, 'Net pay', fmt(ctx, civil.amount), true);
        field(emb, 'Wallet', fmt(ctx, civil.balance), true);
        field(emb, 'Next shift', formatDateTime(civil.nextAt), true);
        return send(ctx, { embeds: [emb] });
    }
    const emb = embed(style.title(ctx.guildId, 'work', 'Shift completed'), `You worked at **${result.company}** as **${result.title}**.`, COLORS.accent);
    field(emb, 'Gross wage', fmt(ctx, result.gross), true);
    field(emb, 'Income tax', `-${fmt(ctx, result.incomeTax)}`, true);
    field(emb, 'Payroll tax', `-${fmt(ctx, result.payrollTax)}`, true);
    field(emb, 'Net pay', fmt(ctx, result.net), true);
    field(emb, 'Output', `${result.output} ${result.good}`, true);
    field(emb, 'Next shift', formatDateTime(result.nextAt), true);
    await send(ctx, { embeds: [emb] });
}
async function apply(ctx) {
    const jobId = Number(ctx.args[0]);
    if (!jobId) return send(ctx, { embeds: [embed('Usage', '`-apply <job id>`', COLORS.warning)] });
    const result = companies.applyJob(ctx.guildId, ctx.userId, jobId);
    await send(ctx, { embeds: [embed('Position accepted', `You joined **${result.company_name}** as **${result.title}** at ${fmt(ctx, result.wage_cents)} per shift.`, COLORS.accent)] });
}
async function resign(ctx) {
    const result = companies.resign(ctx.guildId, ctx.userId);
    await send(ctx, { embeds: [embed('Position resigned', `You left **${result.company_name}**.`, COLORS.muted)] });
}
async function pay(ctx) {
    const member = await resolveMember(ctx, ctx.args[0]);
    if (!member) return send(ctx, { embeds: [embed('Usage', '`-pay @member <amount>`', COLORS.warning)] });
    const amount = parseAmount(ctx.args[1]);
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    accounts.ensureUser(ctx.guildId, member.id, member.displayName);
    accounts.pay(ctx.guildId, ctx.userId, member.id, amount, `Payment to ${userTag(member)}`, ctx.userId);
    await send(ctx, { embeds: [embed('Payment sent', `${fmt(ctx, amount)} to **${userTag(member)}**.`, COLORS.accent)] });
}
async function deposit(ctx) {
    const amount = parseAmount(ctx.args[0]);
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    accounts.depositToBank(ctx.guildId, ctx.userId, amount);
    await send(ctx, { embeds: [embed('Deposit accepted', `${fmt(ctx, amount)} moved into your deposit account at the State Bank.`, COLORS.accent)] });
}
async function withdraw(ctx) {
    const amount = parseAmount(ctx.args[0]);
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    accounts.withdrawFromBank(ctx.guildId, ctx.userId, amount);
    await send(ctx, { embeds: [embed('Withdrawal complete', `${fmt(ctx, amount)} returned to your wallet.`, COLORS.accent)] });
}
async function loan(ctx) {
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    if (!ctx.args.length) {
        const view = bank.loanView(ctx.guildId, ctx.userId);
        const emb = embed('Credit position', `Credit score **${view.score}** · available limit **${fmt(ctx, view.limit)}**.`, COLORS.blue);
        const active = view.loans.filter(x => ['active', 'delinquent'].includes(x.status));
        field(emb, 'Outstanding', active.length ? active.map(x => `#${x.id} · ${fmt(ctx, x.balance_cents)} · ${formatBps(x.rate_bps)} · ${x.status}`).join('\n') : 'No active loans.', false);
        return send(ctx, { embeds: [emb] });
    }
    if (ctx.args[0] === 'quote') {
        const quote = bank.quote(ctx.guildId, ctx.userId, parseAmount(ctx.args[1]), Number(ctx.args[2]) || 24);
        return send(ctx, { embeds: [embed('Loan quote', `Principal **${fmt(ctx, quote.principal)}** · rate **${formatBps(quote.annualBps)}** · term **${quote.term}** cycles · payment **${fmt(ctx, quote.payment)}**.`, quote.eligible ? COLORS.blue : COLORS.danger)] });
    }
    const result = bank.borrow(ctx.guildId, ctx.userId, parseAmount(ctx.args[0]), Number(ctx.args[1]) || 24);
    const emb = embed('Loan originated', `Principal **${fmt(ctx, result.principal)}** credited to your wallet.`, COLORS.blue);
    field(emb, 'Rate', formatBps(result.annualBps), true);
    field(emb, 'Term', `${result.term} cycles`, true);
    field(emb, 'Payment', fmt(ctx, result.payment), true);
    await send(ctx, { embeds: [emb] });
}
async function repay(ctx) {
    const result = bank.repay(ctx.guildId, ctx.userId, parseAmount(ctx.args[0]));
    await send(ctx, { embeds: [embed('Loan repayment', `Paid **${fmt(ctx, result.payment)}** on loan #${result.loanId}. Remaining **${fmt(ctx, result.remaining)}**.`, COLORS.accent)] });
}
async function bond(ctx) {
    const sub = String(ctx.args[0] || '').toLowerCase();
    if (sub === 'buy' || sub === 'purchase') {
        const result = government.purchaseBond(ctx.guildId, ctx.userId, parseAmount(ctx.args[1]), Number(ctx.args[2]) || 12);
        return send(ctx, { embeds: [embed('Bond purchased', `Face value **${fmt(ctx, result.face)}** · coupon **${formatBps(result.rate)}** · term **${result.term}** cycles.`, COLORS.gold)] });
    }
    return bonds(ctx);
}
async function bonds(ctx) {
    const list = government.bondsFor(ctx.guildId, ctx.userId);
    const emb = embed('Your bonds', list.length
        ? list.map(item => `#${item.id} · ${fmt(ctx, item.face_cents)} · ${formatBps(item.rate_bps)} · ${item.status} · ${item.cycles_paid}/${item.term_cycles}`).join('\n')
        : 'You hold no government bonds. Use `-bond buy <amount> [term]`.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function portfolio(ctx) {
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    const wallet = db.walletBalance(ctx.guildId, ctx.userId);
    const deposit = db.depositBalance(ctx.guildId, ctx.userId);
    const position = community.wealth(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    const net = position.total;
    const employment = companies.employmentOf(ctx.guildId, ctx.userId);
    const loans = bank.loansFor(ctx.guildId, ctx.userId).filter(x => ['active', 'delinquent'].includes(x.status));
    const bonds = government.bondsFor(ctx.guildId, ctx.userId).filter(x => ['active', 'delinquent'].includes(x.status));
    const holdings = securities.holdings(ctx.guildId, ctx.userId);
    const emb = embed(style.title(ctx.guildId, 'account', 'Portfolio'), `Household position for **${userTag(ctx.member)}**.`, COLORS.accent);
    field(emb, 'Wallet', fmt(ctx, wallet), true);
    field(emb, 'Deposits', fmt(ctx, deposit), true);
    field(emb, 'Net worth', fmt(ctx, net), true);
    field(emb, 'Employment', employment ? `${employment.title} at ${employment.company_name}\n${fmt(ctx, employment.wage_cents)} per shift` : 'Not employed', false);
    field(emb, 'Loans', loans.length ? loans.map(x => `#${x.id} · ${fmt(ctx, x.balance_cents)} · ${x.status}`).join('\n') : 'None', false);
    field(emb, 'Bonds', bonds.length ? bonds.map(x => `#${x.id} · ${fmt(ctx, x.face_cents)} · ${x.status}`).join('\n') : 'None', false);
    field(emb, 'Shares', holdings.length ? holdings.map(x => `${x.ticker} · ${Number(x.shares).toLocaleString('en-US')} shares · ${fmt(ctx, Number(x.shares) * Number(x.last_price_cents))}`).join('\n') : 'None', false);
    field(emb, 'Property', position.properties > 0 ? fmt(ctx, position.properties) : 'None', true);
    field(emb, 'Financial assets', fmt(ctx, position.shares), true);
    await send(ctx, { embeds: [emb] });
}
async function channelContext(ctx) {
    try {
        const channel = ctx.message && ctx.message.channel ? ctx.message.channel : ctx.interaction && ctx.interaction.channel;
        if (!channel || !channel.messages) return '';
        const messages = await channel.messages.fetch({ limit: 12 });
        return [...messages.values()]
            .reverse()
            .map(message => `${message.author && message.author.bot ? 'bot' : (message.member && message.member.displayName) || (message.author && message.author.username) || 'member'}: ${String(message.content || '').replace(/\s+/g, ' ').slice(0, 300)}`)
            .filter(line => line.trim().length > 6)
            .join('\n');
    } catch {
        return '';
    }
}
async function askJarvis(ctx) {
    const question = ctx.rest || ctx.args.join(' ');
    if (!question) return send(ctx, { embeds: [embed('Jarvis', 'Ask about the server, a member, a command, the economy or anything else.', COLORS.accent)], components: [bugfix.bugButton()] });
    const answer = await jarvis.ask({
        guildId: ctx.guildId,
        userId: ctx.userId,
        member: ctx.member,
        guild: ctx.guild,
        channelContext: await channelContext(ctx),
        question,
    });
    const usageText = answer.smallTalk
        ? 'chat'
        : answer.remaining === Infinity
            ? 'developer unlimited'
            : `${answer.remaining} of ${answer.used + answer.remaining} uses left today`;
    const emb = embed('Jarvis', answer.text, COLORS.accent)
        .setFooter({ text: `${answer.fallback ? 'Ledger brief' : answer.model} · ${usageText}` });
    await send(ctx, { embeds: [emb], components: [bugfix.bugButton()] });
}
async function jarvisStatus(ctx) {
    const info = jarvis.status();
    const usage = jarvis.usageFor(ctx.guildId, ctx.userId);
    const emb = embed('Jarvis status', info.configured ? 'Live economic intelligence is configured.' : 'No model key is configured; Jarvis will answer with ledger briefs.', COLORS.accent);
    field(emb, 'Model', info.model, false);
    field(emb, 'Today', usage.unlimited ? `${usage.used} uses` : `${usage.used}/${usage.limit} uses`, true);
    field(emb, 'Remaining', usage.unlimited ? 'Unlimited' : String(usage.remaining), true);
    await send(ctx, { embeds: [emb], components: [bugfix.bugButton()] });
}

module.exports = {
    overview,
    marketView,
    bankView,
    governmentView,
    jobs,
    work,
    apply,
    resign,
    pay,
    deposit,
    withdraw,
    loan,
    repay,
    bond,
    bonds,
    portfolio,
    askJarvis,
    jarvisStatus,
};
