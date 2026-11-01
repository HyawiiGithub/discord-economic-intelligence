'use strict';

const { AttachmentBuilder } = require('discord.js');
const cryptoMarket = require('../economy/crypto');
const { renderCrypto } = require('../ui/crypto');
const { embed, field, send, COLORS, fmt, compact, parseAmount } = require('./helpers');
const { formatMoney } = require('../money');

function coin(ctx, minor) {
    return formatMoney(minor, ctx.guildRow.currency_code, { decimals: Number(minor) < 100 ? 4 : 2 });
}
async function overview(ctx) {
    const out = renderCrypto(ctx.guildId);
    const file = new AttachmentBuilder(out.buffer, { name: out.filename });
    const emb = embed('Digital assets', `Local coin and memecoin market for **${ctx.guild.name}**.`, COLORS.gold)
        .setImage(`attachment://${out.filename}`)
        .setFooter({ text: 'Server-scoped clearing layer · prices update each cycle' });
    await send(ctx, { files: [file], embeds: [emb] });
}
async function buy(ctx) {
    const result = cryptoMarket.buy(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName, ctx.args[0], parseAmount(ctx.args[1]));
    const emb = embed('Coin purchase', `Bought **${result.tokens.toLocaleString('en-US')} ${result.asset.symbol}**.`, COLORS.gold);
    field(emb, 'Spent', fmt(ctx, result.amount), true);
    field(emb, 'Fee', fmt(ctx, result.fee), true);
    field(emb, 'Execution price', coin(ctx, result.price), true);
    field(emb, 'Next price', coin(ctx, result.nextPrice), true);
    field(emb, 'Holding', `${Number(result.holdings.amount).toLocaleString('en-US')} ${result.asset.symbol}`, true);
    await send(ctx, { embeds: [emb] });
}
async function sell(ctx) {
    const result = cryptoMarket.sell(ctx.guildId, ctx.userId, ctx.args[0], ctx.args[1]);
    const emb = embed('Coin sale', `Sold **${result.tokens.toLocaleString('en-US')} ${result.asset.symbol}**.`, COLORS.gold);
    field(emb, 'Gross', fmt(ctx, result.gross), true);
    field(emb, 'Fee', fmt(ctx, result.fee), true);
    field(emb, 'Received', fmt(ctx, result.net), true);
    field(emb, 'Execution price', coin(ctx, result.price), true);
    field(emb, 'Holding', `${Number(result.holdings.amount).toLocaleString('en-US')} ${result.asset.symbol}`, true);
    await send(ctx, { embeds: [emb] });
}
async function create(ctx) {
    const result = cryptoMarket.create(ctx.guildId, ctx.userId, ctx.member && ctx.member.displayName,
        ctx.args[1], ctx.args[2], parseAmount(ctx.args[3]));
    const emb = embed('Memecoin listed', `**${result.name} (${result.symbol})** is now trading on the local clearing layer.`, COLORS.gold);
    field(emb, 'Initial liquidity', fmt(ctx, result.reserve_cents), true);
    field(emb, 'Starting price', coin(ctx, result.price_cents), true);
    field(emb, 'Creator', `<@${result.creator_user_id}>`, true);
    await send(ctx, { embeds: [emb] });
}
async function portfolio(ctx) {
    const rows = cryptoMarket.portfolio(ctx.guildId, ctx.userId);
    const emb = embed('Coin portfolio', rows.length
        ? rows.map(row => `**${row.symbol}** · ${Number(row.amount).toLocaleString('en-US')} · ${fmt(ctx, row.value_cents)}`).join('\n')
        : 'You hold no digital assets.', COLORS.gold);
    field(emb, 'Total value', fmt(ctx, rows.reduce((sum, row) => sum + Number(row.value_cents), 0)), true);
    await send(ctx, { embeds: [emb] });
}
async function chart(ctx) {
    const asset = cryptoMarket.find(ctx.guildId, ctx.args[0]);
    if (!asset) return send(ctx, { embeds: [embed('Coin not found', 'Use `crypto` to list assets.', COLORS.danger)] });
    const rows = cryptoMarket.history(ctx.guildId, asset.id, 25);
    const emb = embed(`${asset.symbol} · ${asset.name}`, rows.length
        ? rows.map(row => `**Cycle ${row.tick}** · ${coin(ctx, row.price_cents)} · pool ${compact(ctx, row.reserve_cents)}`).join('\n')
        : 'No price history yet.', COLORS.gold);
    field(emb, 'Volatility', `${(Number(asset.volatility_bps) / 100).toFixed(2)}%`, true);
    field(emb, 'Fee', `${(Number(asset.fee_bps) / 100).toFixed(2)}%`, true);
    await send(ctx, { embeds: [emb] });
}

async function command(ctx) {
    const sub = String(ctx.args[0] || 'list').toLowerCase();
    if (sub === 'buy' || sub === 'purchase') return buy(ctx);
    if (sub === 'sell') return sell(ctx);
    if (sub === 'create' || sub === 'launch') return create(ctx);
    if (sub === 'portfolio' || sub === 'bag' || sub === 'holdings') return portfolio(ctx);
    if (sub === 'chart' || sub === 'history') return chart(ctx);
    return overview(ctx);
}

module.exports = { command, overview, buy, sell, create, portfolio, chart };
