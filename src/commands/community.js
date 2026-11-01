'use strict';

const db = require('../db');
const accounts = require('../economy/accounts');
const bank = require('../economy/bank');
const community = require('../economy/community');
const permissions = require('../permissions');
const style = require('../style');
const { embed, field, send, COLORS, fmt, pct, compact, parseAmount, resolveMember, userTag } = require('./helpers');
const { formatDateTime } = require('../money');

function title(ctx, key, fallback) {
    return style.title(ctx.guildId, key, fallback);
}
async function daily(ctx) {
    const result = community.daily(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    const emb = embed(title(ctx, 'daily', 'Daily allowance'), 'A daily allowance has been credited to your household.', COLORS.gold);
    field(emb, 'Allowance', fmt(ctx, result.amount), true);
    field(emb, 'Wallet', fmt(ctx, result.balance), true);
    field(emb, 'Next allowance', formatDateTime(result.nextAt), true);
    await send(ctx, { embeds: [emb] });
}
async function rob(ctx) {
    const target = await resolveMember(ctx, ctx.args[0]);
    if (!target) return send(ctx, { embeds: [embed(title(ctx, 'rob', 'Robbery'), '`rob @member`', COLORS.warning)] });
    if (target.user && target.user.bot) return send(ctx, { embeds: [embed(title(ctx, 'rob', 'Robbery'), 'That household cannot be robbed.', COLORS.warning)] });
    const result = community.rob(ctx.guildId, ctx.userId, target.id, ctx.member && ctx.member.displayName, target.displayName);
    const emb = embed(title(ctx, 'rob', 'Robbery'), result.success
        ? `You took **${fmt(ctx, result.amount)}** from **${userTag(target)}**.`
        : `The attempt failed. The authorities fined you **${fmt(ctx, result.fine)}**.`, result.success ? COLORS.gold : COLORS.danger);
    field(emb, 'Wallet', fmt(ctx, result.balance), true);
    field(emb, 'Next attempt', formatDateTime(result.nextAt), true);
    await send(ctx, { embeds: [emb] });
}
async function casino(ctx) {
    const game = String(ctx.args[0] || '').toLowerCase();
    if (!game) return send(ctx, { embeds: [embed(title(ctx, 'casino', 'Casino'), '`casino coinflip heads|tails <bet>`\n`casino dice 1-6 <bet>`\n`casino roulette red|black|green|0-36 <bet>`\n`casino slots <bet>`\n`casino blackjack <bet>`', COLORS.warning)] });
    const simple = game === 'slots' || game === 'blackjack';
    const choice = simple ? '' : String(ctx.args[1] || '').toLowerCase();
    const rawBet = simple ? ctx.args[1] : ctx.args[2];
    const result = community.casino(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName, game, choice, parseAmount(rawBet));
    const emb = embed(title(ctx, 'casino', 'Casino'), result.detail, result.profit > 0 ? COLORS.gold : result.profit < 0 ? COLORS.danger : COLORS.muted);
    field(emb, 'Wager', fmt(ctx, result.wager), true);
    field(emb, 'Payout', fmt(ctx, result.payout), true);
    field(emb, 'Net', `${result.profit >= 0 ? '+' : ''}${fmt(ctx, result.profit)}`, true);
    field(emb, 'Wallet', fmt(ctx, result.balance), true);
    await send(ctx, { embeds: [emb] });
}
async function lottery(ctx) {
    const sub = String(ctx.args[0] || 'status').toLowerCase();
    if (sub === 'buy' || sub === 'ticket' || sub === 'tickets') {
        const result = community.buyLottery(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName, Number(ctx.args[1]) || 1);
        const emb = embed(title(ctx, 'lottery', 'Reichslotterie'), `Purchased **${result.tickets}** ticket(s).`, COLORS.gold);
        field(emb, 'Cost', fmt(ctx, result.cost), true);
        field(emb, 'Jackpot', fmt(ctx, result.jackpot), true);
        return send(ctx, { embeds: [emb] });
    }
    if (sub === 'draw') {
        permissions.requirePower(ctx.guildId, ctx.member, 'markets');
        const result = community.drawLottery(ctx.guildId, ctx.userId);
        const emb = embed(title(ctx, 'lottery', 'Reichslotterie'), result.rescheduled
            ? 'No tickets were sold. The draw has been rescheduled.'
            : result.winnerId
                ? `The winning ticket belongs to <@${result.winnerId}>.`
                : 'The draw is complete.', COLORS.gold);
        field(emb, 'Prize', fmt(ctx, result.jackpot), true);
        field(emb, 'Tickets', String(result.tickets), true);
        field(emb, 'Next draw', formatDateTime(result.drawAt), true);
        return send(ctx, { embeds: [emb] });
    }
    const view = community.lotteryStatus(ctx.guildId);
    const emb = embed(title(ctx, 'lottery', 'Reichslotterie'), 'Buy tickets with `lottery buy <count>`. The next draw is conducted by the Reichsbank.', COLORS.gold);
    field(emb, 'Jackpot', fmt(ctx, view.jackpot), true);
    field(emb, 'Ticket', fmt(ctx, view.ticketPrice), true);
    field(emb, 'Tickets sold', String(view.tickets), true);
    field(emb, 'Participants', String(view.holders), true);
    field(emb, 'Draw', formatDateTime(view.drawAt), false);
    await send(ctx, { embeds: [emb] });
}
async function shop(ctx) {
    const sub = String(ctx.args[0] || '').toLowerCase();
    if (sub === 'buy' || sub === 'purchase') {
        const result = community.buyItem(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName, ctx.args.slice(1).join(' '));
        const emb = embed(title(ctx, 'shop', 'Reichsmarkt'), `Purchased **${result.item.name}**.`, COLORS.gold);
        field(emb, 'Price', fmt(ctx, result.item.price_cents), true);
        field(emb, 'VAT', fmt(ctx, result.tax), true);
        field(emb, 'Total', fmt(ctx, result.total), true);
        field(emb, 'Wallet', fmt(ctx, result.balance), true);
        return send(ctx, { embeds: [emb] });
    }
    if (sub === 'use') {
        const result = community.useItem(ctx.guildId, ctx.userId, ctx.args.slice(1).join(' '));
        return send(ctx, { embeds: [embed(title(ctx, 'inventory', 'Inventory'), `Used **${result.item.name}**. Remaining **${result.remaining}**.`, COLORS.muted)] });
    }
    const items = community.shopList(ctx.guildId);
    const emb = embed(title(ctx, 'shop', 'Reichsmarkt'), items.length
        ? items.map(item => `**#${item.id} ${item.name}** - ${fmt(ctx, item.price_cents)}\n${item.description}\nStock ${Number(item.stock).toLocaleString('en-US')} - \`shop buy ${item.id}\``).join('\n\n')
        : 'The market has no active listings.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function inventory(ctx) {
    const items = community.inventory(ctx.guildId, ctx.userId);
    const emb = embed(title(ctx, 'inventory', 'Inventory'), items.length
        ? items.map(item => `**${item.name}** x${item.quantity} - ${fmt(ctx, Number(item.price_cents) * Number(item.quantity))}`).join('\n')
        : 'Your inventory is empty.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function properties(ctx) {
    const list = community.properties(ctx.guildId, ctx.userId);
    const emb = embed(title(ctx, 'properties', 'Properties'), list.length
        ? list.map(row => `**${row.name}** - ${fmt(ctx, row.value_cents)}${Number(row.income_cents) ? ` - income ${fmt(ctx, row.income_cents)}` : ''}`).join('\n')
        : 'You own no property.', COLORS.gold);
    field(emb, 'Total value', fmt(ctx, list.reduce((sum, row) => sum + Number(row.value_cents), 0)), true);
    await send(ctx, { embeds: [emb] });
}
async function leaderboard(ctx) {
    const rows = community.leaderboard(ctx.guildId, Number(ctx.args[0]) || 10);
    const emb = embed(title(ctx, 'leaderboard', 'Wealth leaderboard'), rows.length
        ? rows.map((row, index) => `**${index + 1}.** ${row.name} - ${fmt(ctx, row.total)}`).join('\n')
        : 'No households recorded yet.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function wealth(ctx) {
    const target = ctx.args[0] ? await resolveMember(ctx, ctx.args[0]) : ctx.member;
    const userId = target ? target.id : ctx.userId;
    const name = target ? target.displayName : ctx.member && ctx.member.displayName;
    const row = community.wealth(ctx.guildId, userId, name);
    const emb = embed(title(ctx, 'wealth', 'Wealth'), `Position for **${row.name}**.`, COLORS.gold);
    field(emb, 'Cash and deposits', fmt(ctx, row.cash), true);
    field(emb, 'Shares', fmt(ctx, row.shares), true);
    field(emb, 'Property', fmt(ctx, row.properties), true);
    field(emb, 'Total', fmt(ctx, row.total), true);
    await send(ctx, { embeds: [emb] });
}
async function bet(ctx) {
    const sub = String(ctx.args[0] || 'list').toLowerCase();
    if (sub === 'create') {
        permissions.requirePower(ctx.guildId, ctx.member, 'markets');
        const result = community.createBet(ctx.guildId, ctx.userId, ctx.args[1], ctx.args[2], ctx.args[3]);
        return send(ctx, { embeds: [embed(title(ctx, 'bet', 'Public wagers'), `Opened wager **#${result.id} ${result.title}**.\nA: ${result.option_a}\nB: ${result.option_b}`, COLORS.gold)] });
    }
    if (sub === 'settle') {
        permissions.requirePower(ctx.guildId, ctx.member, 'markets');
        const result = community.settleBet(ctx.guildId, ctx.userId, Number(ctx.args[1]), ctx.args[2]);
        return send(ctx, { embeds: [embed(title(ctx, 'bet', 'Public wagers'), `Wager **#${result.bet.id}** settled on **${result.side.toUpperCase()}**.\nPot ${fmt(ctx, result.total)} - winners ${result.winners}.`, COLORS.gold)] });
    }
    if (sub === 'enter' || sub === 'join') {
        const result = community.enterBet(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName, Number(ctx.args[1]), ctx.args[2], parseAmount(ctx.args[3]));
        return send(ctx, { embeds: [embed(title(ctx, 'bet', 'Public wagers'), `Entered wager **#${result.bet.id}** on **${result.side.toUpperCase()}** with ${fmt(ctx, result.amount)}.`, COLORS.gold)] });
    }
    const list = community.openBets(ctx.guildId);
    const emb = embed(title(ctx, 'bet', 'Public wagers'), list.length
        ? list.map(row => {
            const stats = community.betStats(ctx.guildId, row.id);
            return `**#${row.id} ${row.title}**\nA: ${row.option_a} - ${fmt(ctx, stats.a.total)}\nB: ${row.option_b} - ${fmt(ctx, stats.b.total)}\n\`bet enter ${row.id} a|b <amount>\``;
        }).join('\n\n')
        : 'No open wagers. An administrator can open one with `bet create "title" "A" "B"`.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function finance(ctx) {
    const data = community.report(ctx.guildId);
    const emb = embed(title(ctx, 'finance', 'Finance'), `Public and monetary position for **${ctx.guild.name}**.`, COLORS.gold);
    field(emb, 'Treasury', fmt(ctx, data.gov.balance), true);
    field(emb, 'Money supply', fmt(ctx, data.moneySupply), true);
    field(emb, 'Bank vault', fmt(ctx, data.bank.vault), true);
    field(emb, 'Deposits', fmt(ctx, data.bank.deposits), true);
    field(emb, 'Loans', fmt(ctx, data.bank.loans), true);
    field(emb, 'Companies', String(data.companies), true);
    field(emb, 'Stock market cap', fmt(ctx, data.stocks.totalMarketCap || 0), true);
    if (data.lottery) field(emb, 'Lottery jackpot', fmt(ctx, data.lottery.jackpot), true);
    await send(ctx, { embeds: [emb] });
}
async function report(ctx) {
    const data = community.report(ctx.guildId);
    const latest = data.live.snapshot;
    const emb = embed(title(ctx, 'report', 'Economy report'), `Economic position for **${ctx.guild.name}**.`, COLORS.gold);
    field(emb, 'Output', fmt(ctx, latest ? latest.gdp_cents : 0), true);
    field(emb, 'Inflation', `${(Number(data.live.inflationBps) / 100).toFixed(2)}%`, true);
    field(emb, 'Unemployment', `${(Number(data.live.unemploymentBps) / 100).toFixed(2)}%`, true);
    field(emb, 'Price index', (Number(data.live.priceIndex) / 100).toFixed(2), true);
    field(emb, 'Treasury', fmt(ctx, data.gov.balance), true);
    field(emb, 'Money supply', fmt(ctx, data.moneySupply), true);
    field(emb, 'Companies', String(data.companies), true);
    field(emb, 'Market cap', fmt(ctx, data.stocks.totalMarketCap || 0), true);
    field(emb, 'Bank status', data.bank.status, true);
    await send(ctx, { embeds: [emb] });
}
async function history(ctx) {
    const rows = community.economyHistory(ctx.guildId, Number(ctx.args[0]) || 12);
    const emb = embed(title(ctx, 'report', 'Economy report'), rows.length
        ? rows.map(row => `**Cycle ${row.tick}** - output ${compact(ctx, row.gdp_cents)} - price index ${(Number(row.price_index) / 100).toFixed(2)} - unemployment ${(Number(row.unemployment_bps) / 100).toFixed(2)}%`).join('\n')
        : 'No completed cycles yet.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function credit(ctx) {
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    const view = bank.loanView(ctx.guildId, ctx.userId);
    const emb = embed(title(ctx, 'credit', 'Credit position'), `Credit standing for **${userTag(ctx.member)}**.`, COLORS.gold);
    field(emb, 'Score', String(view.score), true);
    field(emb, 'Available limit', fmt(ctx, view.limit), true);
    const active = view.loans.filter(loan => ['active', 'delinquent'].includes(loan.status));
    field(emb, 'Active loans', active.length
        ? active.map(loan => `#${loan.id} - ${fmt(ctx, loan.balance_cents)} - ${pct(ctx, loan.rate_bps)} - ${loan.status}`).join('\n')
        : 'None', false);
    await send(ctx, { embeds: [emb] });
}
async function transactions(ctx) {
    const rows = community.transactions(ctx.guildId, ctx.userId, Number(ctx.args[0]) || 12);
    const emb = embed(title(ctx, 'transactions', 'Transactions'), rows.length
        ? rows.map(row => `**${row.kind}** ${row.delta >= 0 ? '+' : ''}${fmt(ctx, row.delta)}\n${row.memo || 'Ledger entry'} - ${formatDateTime(row.created_at)}`).join('\n\n')
        : 'No wallet transactions recorded.', COLORS.gold);
    await send(ctx, { embeds: [emb] });
}
async function reichsbank(ctx) {
    const sub = String(ctx.args[0] || '').toLowerCase();
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    if (sub === 'deposit') {
        const amount = parseAmount(ctx.args[1]);
        accounts.depositToBank(ctx.guildId, ctx.userId, amount);
        return send(ctx, { embeds: [embed(title(ctx, 'reichsbank', 'Reichsbank'), `${fmt(ctx, amount)} deposited.`, COLORS.gold)] });
    }
    if (sub === 'withdraw') {
        const amount = parseAmount(ctx.args[1]);
        accounts.withdrawFromBank(ctx.guildId, ctx.userId, amount);
        return send(ctx, { embeds: [embed(title(ctx, 'reichsbank', 'Reichsbank'), `${fmt(ctx, amount)} withdrawn.`, COLORS.gold)] });
    }
    const guild = db.getGuild(ctx.guildId);
    const wallet = db.walletBalance(ctx.guildId, ctx.userId);
    const deposit = db.depositBalance(ctx.guildId, ctx.userId);
    const emb = embed(title(ctx, 'reichsbank', 'Reichsbank'), `Household account at the ${guild.central_bank_name}.`, COLORS.gold);
    field(emb, 'Wallet', fmt(ctx, wallet), true);
    field(emb, 'Deposits', fmt(ctx, deposit), true);
    field(emb, 'Deposit rate', pct(ctx, bank.depositRateBps(ctx.guildId)), true);
    field(emb, 'Policy rate', pct(ctx, bank.policyRateBps(ctx.guildId)), true);
    field(emb, 'Deposit', '`reichsbank deposit <amount>`', true);
    field(emb, 'Withdraw', '`reichsbank withdraw <amount>`', true);
    await send(ctx, { embeds: [emb] });
}

module.exports = {
    daily,
    rob,
    casino,
    lottery,
    shop,
    inventory,
    properties,
    leaderboard,
    wealth,
    bet,
    finance,
    report,
    history,
    credit,
    transactions,
    reichsbank,
};
