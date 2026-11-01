'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const db = require('./db');
const jarvis = require('./jarvis');
const style = require('./style');
const { nowIso, formatDateTime } = require('./money');

const ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'bugfixes');
const RUN_CMD = path.join(ROOT, 'runbugfix.cmd');
const MAX_CONTEXT_CHARS = 62000;
const MAX_FILE_CHARS = 7500;

function bugButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('jarvis:bug')
            .setLabel('Bug? report here!')
            .setStyle(ButtonStyle.Danger),
    );
}
function modal() {
    return new ModalBuilder()
        .setCustomId('jarvis:bug:modal')
        .setTitle('Report a bug to Jarvis')
        .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('summary').setLabel('What is broken?').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('command').setLabel('Command or feature').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('actual').setLabel('What happened?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('expected').setLabel('What should happen?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('steps').setLabel('Steps / error text').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false)),
        );
}
function ensureArtifacts() {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    if (!fs.existsSync(RUN_CMD)) {
        const script = [
            '@echo off',
            'setlocal',
            'cd /d "%~dp0"',
            'for /f "delims=" %%f in (\'dir /b /o-d "bugfixes\\BUG-*.html" 2^>nul\') do (',
            '  start "" "%~dp0bugfixes\\%%f"',
            '  exit /b 0',
            ')',
            'echo No bug reports found.',
            'pause',
            '',
        ].join('\r\n');
        fs.writeFileSync(RUN_CMD, script, 'utf8');
    }
}
function sourceFiles() {
    const out = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === 'data' || entry.name === '.git') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(js|json|md)$/i.test(entry.name)) out.push(full);
        }
    };
    walk(path.join(ROOT, 'src'));
    for (const name of ['package.json', path.join('tests', 'run.js')]) {
        const full = path.join(ROOT, name);
        if (fs.existsSync(full)) out.push(full);
    }
    return out;
}
function collectCodeContext(report) {
    const files = sourceFiles();
    const haystack = `${report.command} ${report.summary} ${report.actual} ${report.steps}`.toLowerCase();
    const tokens = [...new Set(haystack.split(/[^a-z0-9_]+/).filter(token => token.length > 3))];
    const command = String(report.command || '').toLowerCase().split(/\s+/)[0];
    const commandFiles = {
        work: ['src/commands/economy.js', 'src/economy/companies.js', 'src/economy/community.js'],
        jobs: ['src/commands/economy.js', 'src/economy/companies.js'],
        apply: ['src/commands/economy.js', 'src/economy/companies.js'],
        bank: ['src/commands/economy.js', 'src/economy/bank.js'],
        deposit: ['src/commands/economy.js', 'src/economy/bank.js'],
        withdraw: ['src/commands/economy.js', 'src/economy/bank.js'],
        loan: ['src/commands/economy.js', 'src/economy/bank.js'],
        credit: ['src/commands/community.js', 'src/economy/bank.js'],
        portfolio: ['src/commands/economy.js', 'src/economy/securities.js'],
        daily: ['src/commands/community.js', 'src/economy/community.js'],
        rob: ['src/commands/community.js', 'src/economy/community.js'],
        casino: ['src/commands/community.js', 'src/economy/community.js'],
        lottery: ['src/commands/community.js', 'src/economy/community.js'],
        shop: ['src/commands/community.js', 'src/economy/community.js'],
        crypto: ['src/commands/crypto.js', 'src/economy/crypto.js', 'src/ui/crypto.js'],
        stocks: ['src/commands/business.js', 'src/economy/securities.js', 'src/ui/stocks.js'],
        company: ['src/commands/business.js', 'src/economy/companies.js'],
        config: ['src/commands/admin.js', 'src/feeds.js', 'src/style.js'],
        help: ['src/help.js', 'src/commands/index.js'],
        jarvis: ['src/jarvis.js', 'src/tools.js', 'src/bugfix.js'],
        profile: ['src/commands/social.js', 'src/economy/social.js', 'src/tools.js'],
        rep: ['src/commands/social.js', 'src/economy/social.js'],
        reputation: ['src/commands/social.js', 'src/economy/social.js', 'src/tools.js'],
        activity: ['src/commands/social.js', 'src/economy/social.js', 'src/tools.js'],
        toprep: ['src/commands/social.js', 'src/economy/social.js'],
        sys: ['src/commands/developer.js', 'src/permissions.js'],
    };
    const hinted = commandFiles[command] || [];
    const mandatory = ['commands/index.js', 'db.js', 'bot.js', 'jarvis.js', 'bugfix.js', 'slash.js'];
    const ranked = files.map(file => {
        const rel = path.relative(ROOT, file).replace(/\\/g, '/');
        const content = fs.readFileSync(file, 'utf8');
        const lower = content.toLowerCase();
        let score = mandatory.some(item => rel.endsWith(item)) ? 70 : 0;
        if (hinted.includes(rel)) score += 220;
        if (rel.startsWith('src/commands/')) score += 8;
        if (rel.startsWith('src/economy/')) score += 4;
        for (const token of tokens.slice(0, 40)) if (lower.includes(token)) score += 1;
        if (rel === 'tests/run.js') score += 2;
        return { rel, content, score };
    }).sort((a, b) => b.score - a.score);
    const tree = files.map(file => path.relative(ROOT, file).replace(/\\/g, '/')).join('\n');
    let used = 0;
    const chunks = [`PROJECT TREE\n${tree}\n`];
    for (const file of ranked) {
        if (used >= MAX_CONTEXT_CHARS) break;
        if (file.score <= 0 && chunks.length > 8) continue;
        const slice = file.content.slice(0, Math.min(MAX_FILE_CHARS, MAX_CONTEXT_CHARS - used));
        chunks.push(`\n===== FILE: ${file.rel} =====\n${slice}`);
        used += slice.length;
    }
    return chunks.join('\n');
}
function fallbackAnalysis(report) {
    return [
        `Report #${report.id} was recorded.`,
        '',
        'The live fix model was unavailable, so Jarvis has not produced a code diagnosis for this report.',
        'The report has still been written to the HTML fix folder with the full reproduction context.',
        '',
        `Command: ${report.command || 'not supplied'}`,
        `Summary: ${report.summary}`,
        `Actual: ${report.actual}`,
        `Expected: ${report.expected || 'not supplied'}`,
        `Steps: ${report.steps || 'not supplied'}`,
    ].join('\n');
}
async function analyze(report) {
    const code = collectCodeContext(report);
    const prompt = [
        `You are Jarvis, the senior engineer for a Discord economy bot. A user reported bug #${report.id}.`,
        `Server: ${report.guild_id}. Command/feature: ${report.command || 'not supplied'}.`,
        '',
        'Review the report and the code context. Produce a precise engineering report with these sections:',
        '1. Triage',
        '2. Root cause',
        '3. Exact fix',
        '4. Verification',
        '5. Risk / follow-up',
        '',
        'Rules:',
        '- Cite exact file paths and line numbers where the context makes them visible.',
        '- Prefer a unified diff or exact replacement blocks when you are confident.',
        '- Never claim to have applied a change; this is a proposal.',
        '- Never reveal secrets, tokens, credentials, .env values or database contents.',
        '- If the evidence is insufficient, say exactly what is missing.',
        '',
        'BUG REPORT',
        `Summary: ${report.summary}`,
        `Actual: ${report.actual}`,
        `Expected: ${report.expected || 'not supplied'}`,
        `Steps/error: ${report.steps || 'not supplied'}`,
        '',
        'CODE CONTEXT',
        code,
    ].join('\n');
    try {
        const messages = [
            { role: 'system', content: 'You are a senior software engineer performing careful root-cause analysis. Be concrete, conservative and precise.' },
            { role: 'user', content: prompt },
        ];
        const first = await jarvis.complete(messages, { model: jarvis.fixModelName(), maxTokens: 5200, timeout: 180000 });
        if (first && first.trim()) return first;
        const second = await jarvis.complete(messages, { model: jarvis.modelName(), maxTokens: 3600, timeout: 150000 });
        if (second && second.trim()) return second;
        return fallbackAnalysis(report);
    } catch (error) {
        return `${fallbackAnalysis(report)}\n\nProvider error: ${error.message}`;
    }
}
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function markdown(value) {
    const parts = String(value || '').split(/```/);
    return parts.map((part, index) => {
        if (index % 2 === 1) {
            const lines = part.replace(/^[a-z0-9_-]+\n/i, '');
            return `<pre><code>${escapeHtml(lines)}</code></pre>`;
        }
        return escapeHtml(part)
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }).join('');
}
function writeHtml(report, analysis) {
    ensureArtifacts();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `BUG-${String(report.id).padStart(6, '0')}-${stamp}.html`;
    const full = path.join(REPORT_DIR, filename);
    const selected = style.forGuild(report.guild_id);
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bug #${report.id} · Jarvis fix report</title>
<style>
:root{color-scheme:dark;--bg:#0f0d0a;--surface:#1a1712;--line:#3a3020;--gold:#c9a227;--text:#f2ead8;--muted:#b3a385;--danger:#b34a4a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}
main{max-width:1100px;margin:36px auto;padding:0 22px 60px}h1{font-size:30px;margin:0 0 4px;color:var(--gold)}
.sub{color:var(--muted);margin-bottom:24px}.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;margin:16px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.value{margin-top:4px;white-space:pre-wrap}.analysis{white-space:normal}.analysis pre{background:#0b0906;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;white-space:pre-wrap}
.analysis code{background:#0b0906;border:1px solid var(--line);border-radius:5px;padding:1px 5px}.analysis h2,.analysis h3{color:var(--gold)}
a{color:var(--gold)}.warn{border-left:3px solid var(--danger);padding-left:14px;color:#e7c5c5}
</style>
</head>
<body><main>
<div class="sub">${escapeHtml(selected ? selected.label : 'Server ledger')} · ${escapeHtml(report.guild_id)}</div>
<h1>Bug #${report.id}</h1>
<div class="sub">${escapeHtml(report.summary)} · ${escapeHtml(formatDateTime(report.created_at))}</div>
<div class="card"><div class="grid">
<div><div class="label">Reported by</div><div class="value">${escapeHtml(report.user_id)}</div></div>
<div><div class="label">Command / feature</div><div class="value">${escapeHtml(report.command || 'not supplied')}</div></div>
<div><div class="label">Status</div><div class="value">${escapeHtml(report.status)}</div></div>
</div></div>
<div class="card"><h2>What happened</h2><div class="value">${escapeHtml(report.actual)}</div></div>
<div class="card"><h2>Expected</h2><div class="value">${escapeHtml(report.expected || 'not supplied')}</div></div>
<div class="card"><h2>Steps / error</h2><div class="value">${escapeHtml(report.steps || 'not supplied')}</div></div>
<div class="card"><h2>Jarvis diagnosis</h2><div class="analysis value">${markdown(analysis)}</div></div>
<div class="card warn"><strong>Review before applying.</strong> This report is a proposal generated from read-only code context. It has not been applied automatically.</div>
</main></body></html>`;
    fs.writeFileSync(full, html, 'utf8');
    return { filename, full };
}
async function handleSubmit(interaction) {
    const summary = interaction.fields.getTextInputValue('summary').trim();
    const command = interaction.fields.getTextInputValue('command').trim();
    const actual = interaction.fields.getTextInputValue('actual').trim();
    const expected = interaction.fields.getTextInputValue('expected').trim();
    const steps = interaction.fields.getTextInputValue('steps').trim();
    if (!summary || !actual) {
        return interaction.reply({ content: 'A summary and a description of what happened are required.', ephemeral: true });
    }
    await interaction.deferReply();
    const at = nowIso();
    const result = db.run(`INSERT INTO bug_reports
        (guild_id, channel_id, user_id, command, summary, expected, actual, steps, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'analyzing', ?, ?)`,
        [String(interaction.guildId), String(interaction.channelId || ''), String(interaction.user.id), command, summary, expected, actual, steps, at, at]);
    const id = Number(result.lastInsertRowid);
    let report = db.get('SELECT * FROM bug_reports WHERE id = ?', [id]);
    let analysis;
    try {
        analysis = await analyze(report);
    } catch (error) {
        analysis = `${fallbackAnalysis(report)}\n\nUnexpected analysis error: ${error.message}`;
    }
    if (!analysis || !String(analysis).trim()) {
        analysis = `${fallbackAnalysis(report)}\n\nThe live fix model returned an empty answer.`;
    }
    report.status = 'ready';
    const html = writeHtml(report, analysis);
    db.run('UPDATE bug_reports SET status = ?, analysis = ?, html_path = ?, updated_at = ? WHERE id = ?',
        ['ready', analysis, path.relative(ROOT, html.full), nowIso(), id]);
    report = db.get('SELECT * FROM bug_reports WHERE id = ?', [id]);
    const selected = style.forGuild(interaction.guildId);
    const emb = new EmbedBuilder()
        .setColor(selected ? selected.color : 0x4ade80)
        .setTitle(`Bug #${id} · fix report`)
        .setDescription(analysis.slice(0, 1500))
        .addFields(
            { name: 'Report', value: summary, inline: false },
            { name: 'Command / feature', value: command || 'not supplied', inline: true },
            { name: 'Status', value: 'ready for review', inline: true },
        )
        .setFooter({ text: selected ? selected.footer : 'Server-scoped ledger' });
    return interaction.editReply({
        embeds: [emb],
        files: [new AttachmentBuilder(fs.readFileSync(html.full), { name: html.filename })],
        components: [bugButton()],
    });
}
async function handleComponent(interaction) {
    if (interaction.isButton() && interaction.customId === 'jarvis:bug') {
        return interaction.showModal(modal());
    }
    if (interaction.isModalSubmit() && interaction.customId === 'jarvis:bug:modal') {
        try {
            return await handleSubmit(interaction);
        } catch (error) {
            console.error('[bugfix]', error);
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ content: `Bug report failed: ${error.message}` });
            }
            return interaction.reply({ content: `Bug report failed: ${error.message}`, ephemeral: true });
        }
    }
    return null;
}
function reports(guildId, limit) {
    return db.all('SELECT * FROM bug_reports WHERE guild_id = ? ORDER BY id DESC LIMIT ?', [String(guildId), Math.max(1, Math.min(20, Number(limit) || 5))]);
}

module.exports = {
    bugButton,
    modal,
    handleComponent,
    reports,
    ensureArtifacts,
    collectCodeContext,
};
