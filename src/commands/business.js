'use strict';

const { AttachmentBuilder } = require('discord.js');
const accounts = require('../economy/accounts');
const companies = require('../economy/companies');
const securities = require('../economy/securities');
const market = require('../economy/market');
const { renderStocks } = require('../ui/stocks');
const { embed, field, send, COLORS, fmt, parseAmount, parseUserId } = require('./helpers');
const { formatBps, formatPct, parsePercent } = require('../money');

function companyOrNull(ctx, query) {
    return companies.find(ctx.guildId, query);
}
async function company(ctx) {
    const sub = String(ctx.args[0] || 'list').toLowerCase();
    if (sub === 'create' || sub === 'new') return create(ctx);
    if (sub === 'list' || sub === 'all') return list(ctx);
    if (sub === 'info') return info(ctx, ctx.args[1]);
    if (sub === 'job' || sub === 'postjob') return postJob(ctx, ctx.args.slice(1));
    if (sub === 'price') return price(ctx, ctx.args.slice(1));
    if (sub === 'dividend') return dividend(ctx, ctx.args[1]);
    return info(ctx, ctx.args[0]);
}
async function list(ctx) {
    const rows = companies.listView(ctx.guildId).slice(0, 12);
    if (!rows.length) return send(ctx, { embeds: [embed('Company registry', 'No active companies. Create one with `-company create "Name" <sector> [capital]`.', COLORS.muted)] });
    const emb = embed('Company registry', `Active enterprises in **${ctx.guild.name}**.`, COLORS.accent);
    for (const item of rows) {
        const line = [
            `**${item.name}** · ${item.ticker} · ${item.sector}`,
            `Cash ${fmt(ctx, item.cash)} · book ${fmt(ctx, item.bookValue)} · ${item.employees} staff · ${item.openJobs} open roles`,
        ].join('\n');
        field(emb, item.public ? 'LISTED' : 'PRIVATE', line, false);
    }
    await send(ctx, { embeds: [emb] });
}
async function info(ctx, query) {
    if (!query) return send(ctx, { embeds: [embed('Usage', '`-company info <name|ticker|id>`', COLORS.warning)] });
    const found = companyOrNull(ctx, query);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${query}**.`, COLORS.danger)] });
    const fin = companies.financials(ctx.guildId, found.id);
    const emb = embed(`${fin.name} · ${fin.ticker}`, fin.description || `${fin.sector} company in ${ctx.guild.name}.`, COLORS.accent);
    field(emb, 'Cash', fmt(ctx, fin.cash), true);
    field(emb, 'Inventory', fmt(ctx, fin.inventoryValue), true);
    field(emb, 'Book value', fmt(ctx, fin.bookValue), true);
    field(emb, 'Market cap', fin.public ? fmt(ctx, fin.marketCap) : 'Private', true);
    field(emb, 'Share price', fmt(ctx, fin.last_price_cents), true);
    field(emb, 'Staff', `${fin.employees} · ${fin.openJobs} open roles`, true);
    field(emb, 'Revenue', fmt(ctx, fin.revenue), true);
    field(emb, 'Expenses', fmt(ctx, fin.expenses), true);
    field(emb, 'Period profit', fmt(ctx, fin.profit), true);
    field(emb, 'Corporate tax', fmt(ctx, fin.periodTax), true);
    field(emb, 'Profit after tax', fmt(ctx, fin.profitAfterTax), true);
    field(emb, 'Inventory lines', fin.inventory.length
        ? fin.inventory.map(row => `${row.good_key}: ${Number(row.quantity).toLocaleString('en-US')} @ ${fmt(ctx, row.price_cents)}`).join('\n')
        : 'No stock.', false);
    field(emb, 'Jobs', fin.openJobs
        ? companies.jobs(ctx.guildId, fin.id).map(job => `#${job.id} ${job.title} · ${fmt(ctx, job.wage_cents)} · ${job.filled}/${job.slots}`).join('\n')
        : 'No open jobs.', false);
    await send(ctx, { embeds: [emb] });
}
async function create(ctx) {
    const name = ctx.args[1];
    const sector = ctx.args[2];
    const rawCapital = ctx.args[3];
    const hasCapital = rawCapital && /^[+-]?[\d.,]+(?:[kmb])?$/i.test(String(rawCapital));
    const capital = hasCapital ? parseAmount(rawCapital) : undefined;
    const description = (hasCapital ? ctx.args.slice(4) : ctx.args.slice(3)).join(' ');
    if (!name || !sector) return send(ctx, { embeds: [embed('Usage', '`-company create "Name" <sector> [capital] [description]`', COLORS.warning)] });
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    const result = companies.create(ctx.guildId, ctx.userId, name, sector, description, capital);
    const emb = embed('Company incorporated', `**${result.name}** is registered in the ${result.sector} sector.`, COLORS.accent);
    field(emb, 'Ticker', result.ticker, true);
    field(emb, 'Capital', fmt(ctx, result.cash), true);
    field(emb, 'Shares', Number(result.shares_outstanding).toLocaleString('en-US'), true);
    field(emb, 'Licence', 'Paid', true);
    await send(ctx, { embeds: [emb] });
}
async function postJob(ctx, args) {
    const query = args[0];
    const wage = args[1] ? parseAmount(args[1]) : 0;
    const slots = Number(args[2]) || 1;
    const title = args.slice(3).join(' ');
    if (!query || !wage || !title) return send(ctx, { embeds: [embed('Usage', '`-company job <company> <wage> <slots> <title>`', COLORS.warning)] });
    const found = companyOrNull(ctx, query);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${query}**.`, COLORS.danger)] });
    const job = companies.postJob(ctx.guildId, ctx.userId, found.id, title, wage, slots);
    await send(ctx, { embeds: [embed('Position opened', `**${job.title}** at **${found.name}** · ${fmt(ctx, job.wage)} per shift · ${job.slots} slot${job.slots === 1 ? '' : 's'}.`, COLORS.accent)] });
}
async function price(ctx, args) {
    const found = companyOrNull(ctx, args[0]);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${args[0] || ''}**.`, COLORS.danger)] });
    if (String(found.owner_user_id) !== String(ctx.userId)) return send(ctx, { embeds: [embed('Authority required', 'Only the owner can change the company price modifier.', COLORS.danger)] });
    const percent = parsePercent(args[1]);
    if (percent < 80 || percent > 120) return send(ctx, { embeds: [embed('Price modifier', 'Use a percentage between 80 and 120.', COLORS.warning)] });
    companies.setPriceModifier(ctx.guildId, found.id, Math.round(percent * 100), ctx.userId);
    await send(ctx, { embeds: [embed('Price modifier updated', `**${found.name}** now sells at **${percent.toFixed(2)}%** of the market price.`, COLORS.accent)] });
}
async function dividend(ctx, query) {
    if (!query) return send(ctx, { embeds: [embed('Usage', '`-company dividend <company>`', COLORS.warning)] });
    const found = companyOrNull(ctx, query);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${query}**.`, COLORS.danger)] });
    const result = companies.dividend(ctx.guildId, ctx.userId, found.id);
    await send(ctx, { embeds: [embed('Dividend declared', `Distributed **${fmt(ctx, result.amount)}** to **${result.holders}** shareholder${result.holders === 1 ? '' : 's'}; withholding tax **${fmt(ctx, result.tax)}**.`, COLORS.accent)] });
}
async function buyGoods(ctx) {
    const found = companyOrNull(ctx, ctx.args[0]);
    const good = String(ctx.args[1] || '').toLowerCase();
    const quantity = Number(ctx.args[2]);
    if (!found || !good || !quantity) return send(ctx, { embeds: [embed('Usage', '`-buygoods <company> <good> <quantity>`', COLORS.warning)] });
    accounts.ensureUser(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName);
    const result = companies.sellGoods(ctx.guildId, ctx.userId, found.id, good, quantity);
    const emb = embed('Purchase settled', `Bought **${result.quantity} ${result.goodKey}** from **${result.company.name}**.`, COLORS.accent);
    field(emb, 'Unit price', fmt(ctx, result.unit), true);
    field(emb, 'Net', fmt(ctx, result.net), true);
    field(emb, 'VAT', fmt(ctx, result.vat), true);
    field(emb, 'Total', fmt(ctx, result.total), true);
    await send(ctx, { embeds: [emb] });
}
async function stocks(ctx) {
    const out = renderStocks(ctx.guildId);
    const file = new AttachmentBuilder(out.buffer, { name: out.filename });
    const emb = embed('Public equity', `**${out.view.listed.length}** listed companies · market capitalisation **${fmt(ctx, out.view.totalMarketCap)}**.`, COLORS.gold)
        .setImage(`attachment://${out.filename}`)
        .setFooter({ text: 'Server-scoped equity market' });
    await send(ctx, { files: [file], embeds: [emb] });
}
async function ipo(ctx) {
    const found = companyOrNull(ctx, ctx.args[0]);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${ctx.args[0] || ''}**.`, COLORS.danger)] });
    const offer = ctx.args[1] ? parseAmount(ctx.args[1]) : undefined;
    const result = securities.ipo(ctx.guildId, ctx.userId, found.id, offer);
    await send(ctx, { embeds: [embed('Company listed', `**${found.name}** is now publicly traded at **${fmt(ctx, result.offer)}** per share.`, COLORS.accent)] });
}
async function buyShares(ctx) {
    const found = companyOrNull(ctx, ctx.args[0]);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${ctx.args[0] || ''}**.`, COLORS.danger)] });
    const result = securities.buy(ctx.guildId, ctx.userId, found.id, parseAmount(ctx.args[1]));
    const emb = embed('Shares purchased', `Bought **${Number(result.shares).toLocaleString('en-US')}** shares of **${result.company.name}**.`, COLORS.accent);
    field(emb, 'Execution price', fmt(ctx, result.quote.ask), true);
    field(emb, 'Cost', fmt(ctx, result.cost), true);
    field(emb, 'Fee', fmt(ctx, result.fee), true);
    field(emb, 'Total charged', fmt(ctx, result.charged), true);
    field(emb, 'New last price', fmt(ctx, result.price), true);
    await send(ctx, { embeds: [emb] });
}
async function sellShares(ctx) {
    const found = companyOrNull(ctx, ctx.args[0]);
    if (!found) return send(ctx, { embeds: [embed('Company not found', `No company matched **${ctx.args[0] || ''}**.`, COLORS.danger)] });
    const shares = Number(ctx.args[1]);
    const result = securities.sell(ctx.guildId, ctx.userId, found.id, shares);
    const emb = embed('Shares sold', `Sold **${Number(result.shares).toLocaleString('en-US')}** shares of **${result.company.name}**.`, COLORS.accent);
    field(emb, 'Execution price', fmt(ctx, result.quote.bid), true);
    field(emb, 'Gross', fmt(ctx, result.gross), true);
    field(emb, 'Fee', fmt(ctx, result.fee), true);
    field(emb, 'Net proceeds', fmt(ctx, result.net), true);
    field(emb, 'New last price', fmt(ctx, result.price), true);
    await send(ctx, { embeds: [emb] });
}
async function holdings(ctx) {
    const rows = securities.holdings(ctx.guildId, ctx.userId);
    const emb = embed('Share holdings', rows.length
        ? rows.map(row => `**${row.ticker}** · ${Number(row.shares).toLocaleString('en-US')} shares · ${fmt(ctx, Number(row.shares) * Number(row.last_price_cents))}`).join('\n')
        : 'You hold no shares. Use `-stocks` to inspect listed companies.', COLORS.accent);
    await send(ctx, { embeds: [emb] });
}

module.exports = {
    company,
    list,
    info,
    create,
    postJob,
    price,
    dividend,
    buyGoods,
    stocks,
    ipo,
    buyShares,
    sellShares,
    holdings,
};
