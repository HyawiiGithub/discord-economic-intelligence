'use strict';

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const style = require('./style');
const permissions = require('./permissions');
const { send } = require('./commands/helpers');

const PAGES = [
    {
        title: 'Overview',
        subtitle: 'Macro position, prices, public accounts and personal ledger.',
        fields: [
            ['Dashboard', '`economy` / `overview` — full macro dashboard\n`market` — goods, stock and demand\n`finance` — treasury, money supply and bank position\n`report` — output, inflation, unemployment\n`history` — recent cycle history'],
            ['Household', '`balance` / `portfolio` — wallet, deposits, loans, shares, property\n`wealth [@member]` — full household balance sheet\n`leaderboard` — wealth ranking\n`transactions` — recent wallet ledger'],
        ],
    },
    {
        title: 'Banking & credit',
        subtitle: 'Reichsbank deposits, loans, bonds and credit standing.',
        fields: [
            ['Reichsbank', '`bank` — policy rates, reserves and your credit\n`deposit <amount>` / `withdraw <amount>`\n`reichsbank` — deposit account overview\n`loan` — credit position and borrowing limit\n`loan <amount> [term]` — take a loan\n`repay <amount>` — repay an active loan'],
            ['Bonds & credit', '`bond` — list your government bonds\n`bond buy <amount> [term]` — purchase a bond\n`credit` — score, available limit and active loans'],
        ],
    },
    {
        title: 'Companies & jobs',
        subtitle: 'Enterprise formation, payroll, production, dividends and employment.',
        fields: [
            ['Enterprise', '`company create "Name" <sector> [capital]`\n`company list` / `company info <query>`\n`company job <company> <wage> <slots> <title>`\n`company price <company> <percent>`\n`company dividend <company>`'],
            ['Labour', '`jobs` — open positions\n`apply <job id>` — take a position\n`work` — work a company shift or civil-service shift\n`resign` — leave your position\n`pay @member <amount>` — transfer funds\n`buygoods <company> <good> <qty>` — purchase goods'],
        ],
    },
    {
        title: 'Markets',
        subtitle: 'Listed equity, IPOs, stock trading and the crypto/meme desk.',
        fields: [
            ['Stock market', '`stocks` — stock exchange dashboard\n`ipo <company> [price]` — list a company\n`buy <company> <budget>` — buy shares\n`sellshares <company> <shares>` — sell shares\n`holdings` — your share positions'],
            ['Crypto & memecoins', '`crypto` — crypto market dashboard\n`crypto buy <symbol> <amount>`\n`crypto sell <symbol> <tokens>`\n`crypto create "Name" <SYMBOL> [liquidity]`\n`crypto portfolio`\n`crypto chart <symbol>`'],
        ],
    },
    {
        title: 'Government & policy',
        subtitle: 'Treasury, taxes, appointments and institutional settings.',
        fields: [
            ['Fiscal', '`gov` / `government` — treasury, revenue, spending and bonds\n`config model <market|social_market|mixed|state_led>`\n`config tax <income|corporate|payroll|vat|wealth> <percent>`\n`config rate <percent>` / `config reserve <percent>`'],
            ['Institutions', '`config cycle <minutes>` / `config workcooldown <minutes>`\n`config starter <amount>` / `config jarvis <uses>`\n`config style <reichsmark|german_empire_1914|ussr|none>`\n`powers` / `powers role @role <powers>`\n`appoint @member <office> [days]` / `dismiss @member` / `appointments`'],
        ],
    },
    {
        title: 'Community & games',
        subtitle: 'Daily allowances, civil work, gaming tables and public wagers.',
        fields: [
            ['Household activity', '`daily` — daily allowance\n`rob @member` — attempted robbery\n`casino coinflip|dice|roulette|slots|blackjack`\n`lottery` / `lottery buy <count>`\n`shop` / `shop buy <id|name>` / `use <item>`'],
            ['Assets & wagers', '`inventory` - held items\n`properties` - owned property\n`bet` - open public wagers\n`bet enter <id> a|b <amount>`\nAdministrators: `bet create` / `bet settle`'],
            ['People & reputation', '`profile @member` - roles, join date, activity and history\n`activity @member` - observed messages and role events\n`rep @member [+|-] [reason]` - rate a member (12h cooldown)\n`reputation [@member]` - public standing\n`toprep` - reputation ranking'],
        ],
    },
    {
        title: 'Administration',
        subtitle: 'Server configuration, update channels, cycles and audit.',
        fields: [
            ['Configuration', '`config show` - current configuration\n`config help` - configuration guide\n`config channel <overview|market|stocks|crypto|lottery|report|audit> #channel`\n`config channel <feed> off` - remove a binding\n`config channels` - list update channels\n`config news #channel` / `config announcements #channel` - Jarvis market intelligence\n`config signals` - list signal channels\n`config currency <CODE>` / `config prefix <prefix>`\n`config bankname <name>` / `config govname <name>`'],
            ['Operations', '`config refresh` — repost or edit all bound feeds\n`audit [limit]` — recent administrative actions\n`cycle` — cycle status\n`cycle run` — run a cycle now\n`help` — this menu\nUpdate feeds post one message and edit it in place.'],
        ],
    },
    {
        title: 'Jarvis & help',
        subtitle: 'Live economic intelligence and command discovery.',
        fields: [
            ['Jarvis', '`jarvis <question>` - ask about the live economy\nMention the bot with a question\n`jarvisstatus` - model, usage and remaining calls\n`Bug? report here!` - button on Jarvis replies\nJarvis writes a fix proposal to `bugfixes/` and attaches the HTML report.'],
            ['Help', '`help` — paginated command menu\n`help <query>` — search commands\nUse the category selector or Search button in the menu.'],
        ],
    },
    {
        title: 'Developer systems',
        subtitle: 'Restricted internal tools for the bot developer.',
        fields: [
            ['Server operations', '`sys guilds` — list registered servers\n`sys guild <id>` — inspect a server\n`sys integrity [id]` - ledger and database checks\n`sys reconcile <id>` - repair account balances from the ledger\n`sys bugs <id>` - list Jarvis bug reports\n`sys jarvis reset <id> [user]` - reset Jarvis usage'],
            ['Direct configuration', '`sys set <id> <key> <value>` — configure a server by id\n`sys vacuum` — database maintenance\nThese commands are restricted to the developer account.'],
        ],
    },
];

function selectedStyle(guildId) {
    return style.forGuild(guildId);
}
function makeEmbed(guildId, title, subtitle, fields) {
    const selected = selectedStyle(guildId);
    const emb = new EmbedBuilder()
        .setColor(selected ? selected.color : 0x4ade80)
        .setTitle(title)
        .setDescription(subtitle || null)
        .setFooter({ text: selected ? selected.footer : 'Server-scoped ledger' });
    if (fields && fields.length) {
        emb.addFields(fields.map(([name, value]) => ({ name, value, inline: false })));
    }
    return emb;
}
function search(guildId, query, developer) {
    const term = String(query || '').trim().toLowerCase();
    const matches = [];
    for (const page of PAGES) {
        if (page.title === 'Developer systems' && !developer) continue;
        for (const [name, value] of page.fields) {
            for (const line of String(value).split('\n')) {
                if (line.toLowerCase().includes(term) || name.toLowerCase().includes(term)) {
                    matches.push(`**${page.title}** · ${line.trim()}`);
                }
            }
        }
    }
    const unique = [...new Set(matches)];
    return {
        title: `Search · ${query}`,
        subtitle: unique.length ? `${unique.length} matching command reference${unique.length === 1 ? '' : 's'}.` : 'No command references matched.',
        fields: [{ name: 'Results', value: unique.slice(0, 18).join('\n').slice(0, 1000) || 'Try `bank`, `crypto`, `channel`, `jarvis`, `company` or `lottery`.' }],
    };
}
function components(pageIndex, developer, searching) {
    const pages = PAGES.filter(page => developer || page.title !== 'Developer systems');
    const current = Math.max(0, Math.min(pages.length - 1, pageIndex));
    const select = new StringSelectMenuBuilder()
        .setCustomId('help:select')
        .setPlaceholder('Jump to a category')
        .addOptions(pages.map((page, index) => ({
            label: page.title,
            value: String(index),
            description: page.subtitle.slice(0, 90),
            default: index === current && !searching,
        })));
    const nav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`help:page:${current - 1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(current <= 0 || searching),
        new ButtonBuilder().setCustomId(`help:page:${current + 1}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(current >= pages.length - 1 || searching),
        new ButtonBuilder().setCustomId('help:search').setLabel('Search').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('help:close').setLabel('Close').setStyle(ButtonStyle.Danger),
    );
    return [new ActionRowBuilder().addComponents(select), nav];
}
function pageCount(developer) {
    return PAGES.filter(page => developer || page.title !== 'Developer systems').length;
}
function payload(guildId, pageIndex, developer, query) {
    const pages = PAGES.filter(page => developer || page.title !== 'Developer systems');
    const current = Math.max(0, Math.min(pages.length - 1, Number(pageIndex) || 0));
    const page = query ? search(guildId, query, developer) : pages[current];
    const emb = makeEmbed(guildId, page.title, page.subtitle, page.fields);
    return { embeds: [emb], components: components(current, developer, !!query) };
}
async function open(ctx) {
    const query = String((ctx.args || []).join(' ') || '').trim();
    const developer = permissions.isDeveloper(ctx.userId);
    const data = payload(ctx.guildId, 0, developer, query || null);
    data.noCard = true;
    return send(ctx, data);
}
function modal() {
    return new ModalBuilder()
        .setCustomId('help:search')
        .setTitle('Search command reference')
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('query')
                .setLabel('Search commands')
                .setPlaceholder('e.g. crypto, stock, channel, jarvis')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(80)
                .setRequired(true),
        ));
}
async function handleComponent(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'The command reference is only available in a server.', ephemeral: true });
    const developer = permissions.isDeveloper(interaction.user.id);
    if (interaction.isButton()) {
        if (interaction.customId === 'help:search') {
            return interaction.showModal(modal());
        }
        if (interaction.customId === 'help:close') {
            return interaction.update({ embeds: [makeEmbed(interaction.guildId, 'Command reference closed', 'Use `help` to reopen it.', [])], components: [] });
        }
        if (interaction.customId.startsWith('help:page:')) {
            const index = Number(interaction.customId.split(':')[2]) || 0;
            const next = Math.max(0, Math.min(pageCount(developer) - 1, index));
            return interaction.update(payload(interaction.guildId, next, developer, null));
        }
        return null;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'help:select') {
        return interaction.update(payload(interaction.guildId, Number(interaction.values[0]) || 0, developer, null));
    }
    if (interaction.isModalSubmit() && interaction.customId === 'help:search') {
        const query = interaction.fields.getTextInputValue('query');
        return interaction.update(payload(interaction.guildId, 0, developer, query));
    }
    return null;
}

module.exports = {
    PAGES,
    open,
    payload,
    search,
    handleComponent,
    pageCount,
};
