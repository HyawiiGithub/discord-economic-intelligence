# Economic Intelligence Dashboard

A full server-administration dashboard for the Discord economy bot.

The repository is split so the website can be deployed separately:

```text
web/                    static Cloudflare Pages site
cloudflare-worker/      Discord OAuth Worker
src/web/server.js       bot-side dashboard API
```

The website never receives the SQLite file. It talks to the bot API over HTTPS.

## What the dashboard can do

### Read

- economic overview
- goods market
- stock market and price paths
- crypto / memecoin desk
- company registry and financials
- treasury and taxes
- wealth and reputation rankings
- observed member activity
- permissions and appointments
- update feed bindings
- news and announcement signal channels
- analysed news signals and their market impact
- audit trail

### Write

With Discord `Manage Server`, `Administrator`, server-owner, or developer access:

- economic model and theme
- currency, prefix, central-bank and government names
- all tax rates
- policy rate and reserve ratio
- cycle interval and work cooldown
- starter balance and Jarvis limit
- welfare rate, central-bank independence and market openness
- custom theme colors, label, footer and seal
- update feed channel bindings
- news and announcement signal channels
- startup company creation and dividend distribution
- role powers and appointments
- lottery draw
- Jarvis usage reset
- manually run an economic cycle
- restart the entire server economy

Restarting the economy deletes wallets, companies, markets, crypto, loans, bonds, activity and history. Configuration, permissions, update channels and bug reports are preserved. The UI requires a typed confirmation phrase.

## News and market intelligence

Bind one or both signal channels from Discord:

```text
config news #channel
config announcements #channel
config signals
```

Or use the dashboard **News & signals** page.

Every non-bot message is stored in the server message history for Jarvis context. Messages posted in a bound news/announcement channel are additionally analysed by Jarvis into:

- sentiment: positive, negative or neutral
- impact in basis points
- affected goods
- affected sectors
- a short explanation

The next economic cycle applies that pressure to goods prices and stock drift. The pressure is then decayed, so it is an event shock rather than a permanent change. If the model is unavailable, a deterministic keyword classifier is used instead.

## 1. Discord application

Create an application at <https://discord.com/developers/applications>.

Add the Worker callback URL:

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/callback
```

Scopes:

```text
identify guilds
```

The dashboard uses the user's guild list and checks:

```text
owner OR Administrator OR Manage Server
```

The developer account always has full access.

## 2. Deploy the login Worker

```bash
cd cloudflare-worker
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler deploy
```

Fill in `cloudflare-worker/wrangler.toml` first:

- `DISCORD_CLIENT_ID`
- `DISCORD_REDIRECT_URI`
- `DASHBOARD_URL`

`SESSION_SECRET` must exactly match `DASHBOARD_SESSION_SECRET` on the bot API.

See `cloudflare-worker/README.md`.

## 3. Start the bot API

Add to `/root/napoleon/.env`:

```env
ECON_WEB_HOST=127.0.0.1
ECON_WEB_PORT=8787
ECON_WEB_ORIGIN=https://your-dashboard.pages.dev
DASHBOARD_SESSION_SECRET=the-same-secret-as-the-worker

# Optional local admin fallback:
ECON_API_TOKEN=the-generated-token-in-your-local-env
```

Start it:

```bash
cd /root/napoleon
npm run web
```

Or with PM2:

```bash
pm2 start src/web/server.js --name economy-dashboard-api
pm2 save
```

Expose the API through HTTPS with Cloudflare Tunnel, Nginx or Caddy.

## 4. Deploy the static site

Upload `web/` to Cloudflare Pages.

Settings:

- Framework preset: **None**
- Build command: empty
- Output directory: `web`
- Root directory: repository root

Edit `web/config.js` before deploying, or use the dashboard settings modal:

```js
window.ECON_CONFIG = {
    apiBase: 'https://economy-api.example.com',
    authUrl: 'https://economy-login.example.workers.dev/login',
};
```

The Discord login button sends the user through the Worker. The Worker redirects back with a signed session in the URL fragment. The app stores the session in browser storage and sends it to the API as a bearer token.

## 5. Protect it

- Use Cloudflare Access on the Pages site if it is private.
- Keep the API behind HTTPS.
- Keep `DASHBOARD_SESSION_SECRET`, the Discord client secret and the bot token private.
- The local `ECON_API_TOKEN` bypasses Discord login for local administration; remove it from production if you do not need it.
- The API is CORS-restricted by `ECON_WEB_ORIGIN`.
- All write operations are audited.

## API routes

### Session

```text
GET    /api/session
GET    /api/guilds
GET    /api/health
```

### Read

```text
GET    /api/guild/:id/summary
GET    /api/guild/:id/market
GET    /api/guild/:id/stocks
GET    /api/guild/:id/crypto
GET    /api/guild/:id/companies
GET    /api/guild/:id/social
GET    /api/guild/:id/report
GET    /api/guild/:id/permissions
GET    /api/guild/:id/config
GET    /api/guild/:id/channels
GET    /api/guild/:id/news
GET    /api/guild/:id/audit
GET    /api/guild/:id/bugreports
GET    /api/guild/:id/member/:userId
```

### Write

```text
PATCH  /api/guild/:id/config
POST   /api/guild/:id/cycle
POST   /api/guild/:id/reset
POST   /api/guild/:id/channels
DELETE /api/guild/:id/channels/:feed
POST   /api/guild/:id/signals
DELETE /api/guild/:id/signals/:key
POST   /api/guild/:id/news/analyze
POST   /api/guild/:id/companies
POST   /api/guild/:id/companies/:companyId/dividend
POST   /api/guild/:id/lottery/draw
POST   /api/guild/:id/jarvis/reset
POST   /api/guild/:id/permissions/role
DELETE /api/guild/:id/permissions/role/:roleId
POST   /api/guild/:id/permissions/appoint
DELETE /api/guild/:id/permissions/appoint/:userId
POST   /api/guild/:id/member/:userId/reputation
```

Authentication:

```http
Authorization: Bearer <Discord session JWT or ECON_API_TOKEN>
```

## Local development

```bash
# API
ECON_API_TOKEN=dev-token npm run web

# static site
cd web
python -m http.server 8080
```

Open `http://localhost:8080`.

The API connection modal also accepts a local API token, which is useful before the Discord Worker is deployed.

## Architecture

```text
Browser
  ├─ Discord OAuth → Cloudflare Worker
  ├─ signed session JWT
  └─ HTTPS → bot dashboard API → SQLite economy database
```

The Discord bot and the dashboard API can run at the same time. SQLite is in WAL mode with a busy timeout.
