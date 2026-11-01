# Economic Intelligence

A per-server Discord economy bot with a real double-entry ledger, companies, banking, government finance, stock and crypto markets, social intelligence, Jarvis AI and a full authenticated administration dashboard.

Everything is scoped to the Discord guild that invokes it. There is no global economy.

## Highlights

### Economy

- Double-entry ledger with integer minor units
- Per-server wallets, deposits, loans, bonds, taxes and treasury
- Central-bank policy rate and reserve requirements
- Company formation, payroll, production, inventory and dividends
- Corporate, income, payroll, VAT and wealth tax configuration
- Goods market with supply, demand, stock and price movement
- GDP, inflation, unemployment, money supply and price-index snapshots
- Atomic scheduled economic cycles

### Markets

- Stock exchange with IPOs, bid/ask spread, trading fees and price impact
- Public share holdings, company buybacks and market capitalisation
- Crypto and memecoin desk with local liquidity pools and issuance
- Price history and cycle-driven volatility
- Stock and crypto dashboards rendered as PNG

### Community

- Daily allowance
- Company work shifts
- Civil-service fallback for unemployed members
- Robbery, casino, lottery, shop, inventory and property
- Wealth leaderboard
- Public bets
- Member activity, role history and explicit reputation

### Jarvis

- Discord AI assistant with live economy tools
- General conversation, not just economy answers
- Server context: roles, join date, activity, reputation and channel history
- Stored public message history and search
- News/announcement intelligence that changes goods and stock volatility
- Daily limits, with unlimited developer access
- Bug reporting button on every Jarvis reply
- Generates a detailed HTML fix report and opens the newest report with `runbugfix.cmd`

### Themes and UI

- TA Reichsmark
- German Empire 1914
- USSR / Soviet command economy
- Plain institutional
- Per-guild custom color, label, footer and seal overrides
- Generated PNG command cards and dashboards

### Administration

- Discord permission checks and delegated bot powers
- Role-bound powers and appointed offices
- Audit trail
- Update channels that post once and edit the same message
- News and announcement signal channels
- Full web dashboard with Discord OAuth

## Repository layout

```text
src/
  bot.js                    Discord entry point
  db.js                     schema, migrations, ledger helpers
  config.js                 presets and currencies
  permissions.js            authority checks
  style.js                  visual and institutional themes
  jarvis.js                 AI provider loop
  tools.js                  read-only Jarvis tools
  bugfix.js                 HTML fix-report generation
  feeds.js                  update-channel message editing
  help.js                   paginated interactive help
  commands/                 Discord command handlers
  economy/                  banking, companies, markets, crypto, news, social
  ui/                       PNG dashboards and cards
  web/server.js             authenticated dashboard API
web/                        static Cloudflare Pages dashboard
cloudflare-worker/          Discord OAuth Cloudflare Worker
tests/run.js                integration test suite
assets/fonts/               Aldrich and Noto Sans
runbugfix.cmd               opens the newest Jarvis fix report
message (2).py              original reference source
```

## Requirements

- Node.js 22.19 or newer
- SQLite through Node's built-in `node:sqlite`
- Discord bot token
- Discord bot intents:
  - Server Members
  - Message Content
  - Guild Message Reactions
- Optional: TokenHub, OpenRouter or OpenCode API key for Jarvis

## Quick start

```bash
npm install
cp .env.example .env
# edit .env
npm test
node src/bot.js
```

The default database is created at:

```text
data/economy.db
```

Never commit that file.

## Environment

See `.env.example`.

Minimum Discord setup:

```env
DISCORD_TOKEN=
```

Jarvis through TokenHub:

```env
JARVIS_BASE_URL=https://us-api.tokenhub.com/v1
JARVIS_API_KEY=
JARVIS_MODEL=deepseek-v4.1-flash
JARVIS_FIX_MODEL=deepseek-v4-pro
```

The developer ID `1082686076491137115` has full internal access and unlimited Jarvis usage.

## Discord commands

Use the interactive help menu:

```text
help
help <query>
```

Main areas:

```text
overview / economy / market / finance / report
balance / portfolio / wealth / leaderboard / transactions
bank / deposit / withdraw / loan / repay / bond / credit
company / companies / jobs / apply / work / resign / pay
stocks / ipo / buy / sellshares / holdings
crypto / crypto buy / crypto sell / crypto create / crypto portfolio
daily / rob / casino / lottery / shop / inventory / properties
profile / activity / rep / reputation / toprep
config / powers / appoint / dismiss / appointments / audit / cycle
jarvis / jarvisstatus
sys
```

Configuration examples:

```text
config style german_empire_1914
config style ussr
config workcooldown 10
config news #news
config announcements #announcements
config channel stocks #stock-updates
config channel market #market-updates
config channels
config refresh
```

## Themes

```text
config style reichsmark
config style german_empire_1914
config style ussr
config style none
```

The USSR preset sets the state-led model, ruble currency, Soviet institutions and a red/gold canvas theme.

## Dashboard

The dashboard is split from the bot so the static site can be hosted on Cloudflare Pages while the API stays on the bot server.

```text
web/                    static dashboard
cloudflare-worker/      Discord OAuth Worker
src/web/server.js       API
```

Start the API:

```bash
npm run web
```

Or:

```bash
pm2 start src/web/server.js --name economy-dashboard-api
pm2 save
```

Dashboard setup, Discord OAuth, Cloudflare Pages and API routes are documented in [web/README.md](web/README.md) and [cloudflare-worker/README.md](cloudflare-worker/README.md).

The dashboard requires Discord `Manage Server`, `Administrator`, server ownership or developer access for writes.

## Security

- `.env` is ignored and must never be committed.
- The dashboard API uses a signed Discord session JWT or a local API token.
- `DASHBOARD_SESSION_SECRET` must match the Worker's `SESSION_SECRET`.
- Keep the bot token, Discord client secret, Jarvis key and dashboard session secret private.
- Put the API behind HTTPS and restrict CORS with `ECON_WEB_ORIGIN`.
- All dashboard writes are audited.
- Restarting an economy requires a typed `RESET <guild_id>` confirmation.

## Tests

```bash
npm test
```

The suite covers the ledger, taxes, banking, bonds, corporate tax, dividends, stock trading, market rendering, themes, crypto, feeds, help search, Jarvis limits, social reputation, news market pressure and economy reset.

## Reference source

`message (2).py` is the original TA Reichsmark reference file retained for comparison. The running implementation is the CommonJS source under `src/`.
