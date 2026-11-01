'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./db');
const cycle = require('./economy/cycle');
const community = require('./economy/community');
const social = require('./economy/social');
const news = require('./economy/news');
const feeds = require('./feeds');
const help = require('./help');
const bugfix = require('./bugfix');
const commands = require('./commands');
const slash = require('./slash');

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('DISCORD_TOKEN is not set. Add it to the environment or to bot stuff/.env.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User],
});

async function registerGuild(guild) {
    try {
        db.ensureGuild(guild.id, guild.name);
        community.ensure(guild.id);
        await news.backfillBound(client, guild.id).catch(error => console.error(`[news:backfill:${guild.id}]`, error.message));
        await guild.commands.set(slash.commands.map(command => command.toJSON()));
        console.log(`[slash] registered ${slash.commands.length} commands in ${guild.name}`);
    } catch (error) {
        console.error(`[slash:${guild.id}]`, error.message);
    }
}

client.once('ready', async () => {
    console.log(`[bot] ${client.user.tag} ready in ${client.guilds.cache.size} guilds`);
    for (const guild of client.guilds.cache.values()) {
        await registerGuild(guild);
    }
    cycle.startScheduler(client);
});

client.on('economy:cycles', async results => {
    for (const result of results) {
        try {
            await feeds.updateGuild(client, result.guildId);
        } catch (error) {
            console.error(`[feeds:${result.guildId}]`, error.message);
        }
    }
});

client.on('guildCreate', async guild => {
    await registerGuild(guild);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        const customId = String(interaction.customId || '');
        try {
            if (customId.startsWith('help:')) await help.handleComponent(interaction);
            else if (customId.startsWith('jarvis:')) await bugfix.handleComponent(interaction);
        } catch (error) {
            console.error('[component]', error.message);
        }
        return;
    }
    if (!interaction.isChatInputCommand()) return;
    try {
        await interaction.deferReply();
        if (!interaction.guild) {
            return interaction.editReply('This command only works in a server.');
        }
        const guildRow = db.ensureGuild(interaction.guild.id, interaction.guild.name);
        const mapped = slash.toCommand(interaction);
        const ctx = {
            client,
            interaction,
            message: null,
            guild: interaction.guild,
            guildRow,
            guildId: String(interaction.guild.id),
            member: interaction.member,
            userId: String(interaction.user.id),
            prefix: guildRow.prefix,
            command: mapped.command,
            args: mapped.args || [],
            rest: mapped.rest || '',
        };
        await commands.dispatch(ctx);
    } catch (error) {
        console.error('[interaction]', error);
        const message = error && error.message ? error.message : 'The operation could not be completed.';
        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message });
            else await interaction.reply({ content: message, ephemeral: true });
        } catch {}
    }
});

client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    try {
        const guildRow = db.ensureGuild(message.guild.id, message.guild.name);
        const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
        db.touchMemberActivity(message.guild.id, message.author.id, member && member.displayName, message.channelId);
        news.ingest(message.guild.id, message.channelId, {
            id: message.id,
            authorId: message.author.id,
            authorName: member && member.displayName,
            content: message.content,
            createdAt: message.createdAt ? message.createdAt.toISOString() : undefined,
        }).catch(error => console.error('[news:ingest]', error.message));
        const content = message.content.trim();
        let command = '';
        let args = [];
        let rest = '';
        if (client.user && message.mentions.users.has(client.user.id)) {
            rest = content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            if (!rest) {
                command = 'help';
            } else {
                command = 'jarvis';
                args = rest.split(/\s+/);
            }
        } else {
            const prefix = guildRow.prefix || '-';
            if (!content.startsWith(prefix)) return;
            const raw = content.slice(prefix.length).trim();
            if (!raw) return;
            const parsed = commands.parseInput(raw);
            command = parsed.command;
            args = parsed.args;
            rest = parsed.rest;
        }
        if (!command) return;
        if (command === 'jarvis') message.channel.sendTyping().catch(() => {});
        const ctx = {
            client,
            interaction: null,
            message,
            guild: message.guild,
            guildRow,
            guildId: String(message.guild.id),
            member,
            userId: String(message.author.id),
            prefix: guildRow.prefix,
            command,
            args,
            rest,
        };
        await commands.dispatch(ctx);
    } catch (error) {
        console.error('[message]', error);
        try { await message.reply(error.message || 'The operation could not be completed.'); } catch {}
    }
});

client.on('guildMemberAdd', member => {
    try {
        db.recordMemberEvent(member.guild.id, member.id, 'joined', {
            accountCreatedAt: member.user && member.user.createdAt ? member.user.createdAt.toISOString() : null,
            joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
        });
    } catch (error) {
        console.error('[member:add]', error.message);
    }
});

client.on('guildMemberRemove', member => {
    try {
        db.recordMemberEvent(member.guild.id, member.id, 'left', {});
    } catch (error) {
        console.error('[member:remove]', error.message);
    }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
    try {
        const before = new Set(oldMember.roles.cache.keys());
        const after = new Set(newMember.roles.cache.keys());
        const added = [...after].filter(id => !before.has(id));
        const removed = [...before].filter(id => !after.has(id));
        if (added.length) db.recordMemberEvent(newMember.guild.id, newMember.id, 'roles_added', { roleIds: added });
        if (removed.length) db.recordMemberEvent(newMember.guild.id, newMember.id, 'roles_removed', { roleIds: removed });
    } catch (error) {
        console.error('[member:update]', error.message);
    }
});

async function trackReaction(reaction, delta) {
    try {
        let message = reaction.message;
        if (message.partial) message = await message.fetch().catch(() => null);
        if (!message || !message.guildId || !message.author || message.author.bot) return;
        social.react(message.guildId, message.author.id, delta);
    } catch (error) {
        console.error('[reaction:track]', error.message);
    }
}
client.on('messageReactionAdd', reaction => { trackReaction(reaction, 1); });
client.on('messageReactionRemove', reaction => { trackReaction(reaction, -1); });

client.on('error', error => {
    console.error('[discord]', error);
});

process.on('unhandledRejection', error => {
    console.error('[unhandled]', error);
});

client.login(token).catch(error => {
    console.error('[login]', error.message);
    process.exit(1);
});
