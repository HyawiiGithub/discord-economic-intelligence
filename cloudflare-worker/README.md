# Discord Login Worker

Cloudflare Worker for Discord OAuth in front of the economy dashboard.

## Discord application

Create an application at https://discord.com/developers/applications.

OAuth2 redirect URL:

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/callback
```

Scopes used:

```text
identify guilds
```

The Worker returns the user's guild list and permissions to the dashboard. The bot API independently checks:

- guild membership
- owner status
- `Manage Guild` or `Administrator`
- the bot developer bypass

## Configure `wrangler.toml`

Replace:

- `DISCORD_CLIENT_ID`
- `DISCORD_REDIRECT_URI`
- `DASHBOARD_URL`

Set secrets:

```bash
cd cloudflare-worker
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` must be the **same value** as `DASHBOARD_SESSION_SECRET` on the bot API.

Deploy:

```bash
wrangler deploy
```

## Login flow

```text
Dashboard → Worker /login
Worker → Discord OAuth
Discord → Worker /callback
Worker → Dashboard/#session=<JWT>
Dashboard → Bot API with Authorization: Bearer <JWT>
```

The JWT is HMAC-SHA256 signed by the Worker and verified by `src/web/server.js`.

Session lifetime is 7 days. Login state is protected by a short-lived HttpOnly OAuth state cookie.

## API contract

`GET /health`

`GET /login`

`GET /callback`

`GET /me` with:

```http
Authorization: Bearer <session JWT>
```

## Security

- Keep `SESSION_SECRET` private and identical on the Worker and API.
- Protect the static Pages site with Cloudflare Access if it is not meant to be public.
- The dashboard API should be HTTPS only.
- The Worker does not store Discord access tokens.
