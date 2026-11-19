# SAVD Ads Intelligence — Google Ads dashboard

A customizable, **read-only** Google Ads dashboard for an agency and its clients: dashboards you can build and
rearrange, monitoring with change-aware anomaly detection and alerts, budget pacing and planning next to Google's own
simulators, cross-channel reporting through plugins, and AI campaign suggestions. People sign in with a role; SAVD
staff see every client (and a cross-client report), each client only its own accounts. It runs on **demo data**
until `.env` has working Google Ads credentials, and it always says why (the banner shows the exact reason).

The UI follows the reference prototype `Google Ads Dashboard - Standalone.html` (SAVD teal/ink design, light theme by
default, dark theme toggle) and works on phones from 360 px wide (☰ menu, tables that scroll inside their card).

## Quick start

Requires Node.js ≥ 20.18; 22.13 or later (24 recommended) for the analytics warehouse, which uses the built-in SQLite.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first visit opens **/setup**: enter the one-time setup code printed in the server
log (or the value of `AUTH_SETUP_TOKEN`) to create the first agency admin — see [Sign-in & access](#sign-in--access).

Without a `.env` you get two realistic demo accounts ("Acme Running Co." and "Trail Gear Outlet", one demo client
each) with planted problems to find: a CPC spike with no account change behind it, a PMax conversion drop after a
landing-page change, a Display spend surge after a bid-strategy switch, a YouTube CTR collapse after a new ad, a
tracking break, a budget-limited brand campaign and a spend jump that simply follows a 40% budget raise.

To go live, copy `.env.example` to `.env` and fill in the four required Google Ads keys (see [Live data](#live-data)).

## What's inside

| # | Page | What you can do |
|---|------|-----------------|
| 01 | **Overview** | Tabs of dashboards (Overview, Executive, Monitoring + your own). *Customize dashboard* to drag, resize, remove and add widgets from the gallery (~35 widgets: KPI strips, trend small multiples, pacing, anomaly feed, campaign table, AI ideas, cross-channel, heatmaps, funnels, treemaps, forecasts, goal trackers, notes…). Filters (date range, comparison, campaign type, cross-filters by clicking charts) live in the URL. Undo, autosave, import/export JSON, print/PDF and TV mode. |
| 02 | **Campaigns** | Sortable table with sparklines, totals, column chooser and bulk actions; campaign drawer; detail pages with ad groups, keywords (Quality Score), search terms, devices & hours, change history with before/after impact analysis, signals and notes. |
| 03 | **Budget planner** | Month pacing with projected month-end, targets per campaign, recommended daily budgets, optimizer (response curves, Google's simulator curves where available), scenarios, 30-day forecast with an 80% band, **Simulators** (Google's budget / target simulations and budget recommendations next to our model, with the rule for which one leads), multi-month plans, Google Ads Editor exports. |
| 04 | **Anomalies** | z-score / robust / seasonal detectors, pacing and tracking-break checks, threshold rules, **change-history verdicts** (expected / learning / likely cause / no recent changes), acknowledge / snooze / resolve, AI or rule-based explanations, alert routes to Slack, Microsoft Teams, Discord or a signed webhook, delivery log. |
| 05 | **AI studio** | Campaign ideas grounded in account data, campaign blueprints (Editor CSV, everything paused), RSA ad copy with character limits, negative-keyword assistant, and "Ask AI" chat (⌘J) that answers with real query results. |
| 06 | **Explore** | Notebook-style query builder: pick metrics, group by up to three dimensions, filter, sort, visualize, save questions, add them to dashboards; custom metrics with a formula language. |
| 07 | **Channels** | Google Ads next to plugin platforms (Meta, Microsoft, TikTok, …): spend, ROAS, share of spend, MER. |
| 08 | **Plugins** | Built-in connectors, alert webhooks, and a **custom REST plugin builder** (endpoint, auth, pagination, field mapping, live preview). Code plugins via `npm run plugin:new`. |
| 09 | **Data source** | Which credentials are present (masked), Google Ads health, AI provider, storage, scheduler, preferences (currency, business context, brand/competitor terms, goals), the **analytics warehouse** (SQLite: what is stored per table, monthly totals, syncs) and the activity log. |
| 10 | **Clients** | Every account you may open, grouped by client: KPIs vs the comparison period, month pacing, open signals, totals in one currency. |
| 11 | **Access** | Users (invite links, roles, resets, 2FA reset) and clients (which Google Ads accounts each owns). |

Plus **Account** (profile, two-factor authentication, password, signed-in devices) from the user menu. Pages and
controls a role can't use are hidden; the server refuses them anyway.

Keyboard: ⌘K command palette · ⌘J Ask AI · `g` + 1–9 / 0 go to page 01–10 · `e` customize · `r` refresh · `t` theme · `?` help.

## Read-only by design

The dashboard never changes your Google Ads account. The Google Ads client only calls `search`/`searchStream` and
`listAccessibleCustomers` (a test fails the build if `:mutate` appears anywhere in it). Buttons such as *Pause*,
*Set budget*, *Apply plan* or *Add negatives*:

- in **demo mode** run as clearly labelled simulations (you can undo them; they're in the activity log);
- in **live mode** are disabled and offer "Open in Google Ads ↗", a copyable change list and a Google Ads Editor CSV.

Google's own planning data is read the same way: `campaign_simulation` (budget, target CPA and target ROAS
simulators) and `recommendation` (budget recommendations with Google's impact estimate) are GAQL reports. Performance
Planner has no API (the official Google Ads MCP server only runs GAQL searches too), and Keyword Planner forecasts are
a separate RPC, so neither is used. The Simulators tab states which estimate leads for each planning question.

## Sign-in & access

Sign-in is on by default (`AUTH_MODE=required`).

- **First run:** while no user exists, every page redirects to `/setup`, which needs the one-time code from the server
  log (or `AUTH_SETUP_TOKEN`). The first user is an agency admin; demo installs also get one client per demo account.
- **Accounts:** email + password (scrypt), sessions in an HttpOnly cookie (7 days, 24 h idle; `AUTH_SESSION_DAYS`,
  `AUTH_IDLE_HOURS`), lockout after 5 failures, optional TOTP two-factor authentication with recovery codes
  (`AUTH_REQUIRE_2FA=agency|all` makes it mandatory), optional Sign in with Google (`AUTH_GOOGLE_CLIENT_ID`,
  `AUTH_GOOGLE_CLIENT_SECRET`, redirect URI `{APP_BASE_URL}/api/auth/google/callback`; invited emails or verified
  accounts of `AUTH_GOOGLE_ALLOWED_DOMAINS`, who join as agency members).
- **Invites and resets** are one-time links (`AUTH_INVITE_HOURS`, 72 h) that admins copy — no email is sent.
- **Roles:** agency admin (everything), agency member (all clients, no user/client admin), client admin (own
  client: dashboards, rules, alerts, plans, simulated actions, AI, own users), client viewer (read + AI).
- **Clients & workspaces:** agency admins create clients on **Access → Clients** and assign Google Ads account ids
  reached through the MCC. Each client has its own workspace store under `DATA_DIR/workspaces/<clientId>/`; the
  agency workspace is `DATA_DIR` itself, so existing single-tenant data keeps working.
- `AUTH_MODE=off` restores the old single-user behaviour (no login, everyone is a local agency admin) — local use only.

## Live data

Put these in `.env` (all four are required; with fewer the app shows demo data and names what's missing):

| Key | Where it comes from |
|-----|---------------------|
| `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` | Google Cloud console → OAuth client (Desktop or Web) in the project where the Google Ads API is enabled |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth consent for the `https://www.googleapis.com/auth/adwords` scope. If the OAuth app is in *Testing*, refresh tokens expire after 7 days — publish it. |
| `GOOGLE_ADS_CUSTOMER_ID` | The client account to open by default, e.g. `482-119-3307` |

Google sunset developer tokens on 2026-09-09: `GOOGLE_ADS_DEVELOPER_TOKEN` is optional (sent when set, ignored by
Google). The API access level (Test / Explorer / Basic / Standard) belongs to the Google Cloud project that owns the
OAuth client — Test reaches test accounts only; upgrade to Explorer or higher on the Google Ads API Overview page
(https://console.cloud.google.com/google/ads-apis/overview).

If you reach the account through a manager (MCC), also set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` — the account switcher then
lists every client account, and agency admins can assign them to clients. To fill in the three OAuth keys, create a
**Desktop app** OAuth client (Google Auth Platform → Clients), download its JSON and run `npm run google-ads:auth`: it
opens Google's consent page and writes the client id, secret and refresh token into `.env` (only the last 4 characters
are printed). Check your setup from the terminal:

```bash
npm run google-ads:auth
npm run check:google-ads
npm run reconcile:live   # optional: every fact table vs campaign_daily, change history, Google's estimates (read-only)
```

Everything else in `.env.example` is optional: AI keys, alert webhooks, plugin credentials, sign-in and security
settings. After going live, delete the demo clients and create the real ones.

## AI

Set one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` (`AI_PROVIDER=auto` picks the first one
present). Defaults: Claude `claude-opus-5-5`, OpenAI `gpt-6-sol`, Gemini `gemini-3.8-flash` (override with
`*_MODEL`). Without a key — or if a call fails — a deterministic demo engine answers and the UI says so. The AI only
receives aggregated account data, treats it as untrusted input, and never gets tools or write access. Numbers in
narratives are computed by the server and checked against the model's text.

Gemini also runs on the free tier (a key from an AI Studio project without billing). When `gemini-3.8-flash` runs
out of its small free quota or is overloaded, `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`) answers
instead. On the free tier Google may use prompts to improve its products, so keep client accounts on a paid project.
A billed project whose prepaid credit is used up answers HTTP 402 and the app says so.

```bash
npm run ai:smoke   # one small structured call + one streamed call per configured provider
```

## Alerts

Add a channel on **Anomalies → Notifications** or define `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL` (Teams Workflows),
`DISCORD_WEBHOOK_URL` or `ALERT_WEBHOOK_URL` (+ `ALERT_WEBHOOK_SECRET` for the `X-SAVD-Signature: sha256=…` HMAC).
Evaluation runs:

- inside the server when `ALERTS_SCHEDULER_ENABLED=true` (every `ALERTS_INTERVAL_MINUTES`, minimum 5), or
- from any cron: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/alerts`.

Demo mode never sends real alerts unless `ALERTS_DEMO_DISPATCH=true`; test sends always work. With several clients set
`ALERTS_ALL_ACCOUNTS=true` so every account is evaluated in its own client's workspace. Channels defined in `.env`
belong to the agency workspace; clients add their own channels in theirs. Alerts carry the change-aware
recommendation (for example, that a spend jump follows the account's own 40% budget raise).

## Plugins

- **Built-in connectors** (Meta, Microsoft Advertising, TikTok, LinkedIn, Amazon, Pinterest, Snapchat, Reddit, GA4,
  Shopify, WooCommerce, Google Sheets, BigQuery) run on demo data in this version and are badged as such.
- **Custom REST plugins** are live: point the builder at any JSON reporting API, choose auth (API key, bearer, basic),
  pagination and field mapping (dot paths with `[*]` / `[key=value]` filters), preview the rows, save. Outbound
  requests go through an SSRF guard (https only, no private or metadata addresses, DNS checked at connect time).
  Credentials are stored encrypted when `APP_ENCRYPTION_KEY` is set (`npm run gen:key`), or referenced from `.env`
  as `PLUGIN_*` variables.
- **Code plugins**: `npm run plugin:new -- my-platform --category ad_platform` scaffolds a `definePlugin()` module
  with demo data and a test.

## Security

- Every API route declares the permission it needs (a test walks every route file); pages check the role on the
  server; client users only ever list, open or store data for their own accounts (a foreign account id → 403).
- `.env` is only read on the server; the API returns presence and a masked hint, never values, and only to roles that
  manage the system. `/.env` is not served.
- Sessions are random tokens stored as SHA-256 hashes; TOTP secrets are AES-GCM encrypted, recovery codes hashed;
  sign-in endpoints are rate-limited.
- `DASHBOARD_BASIC_AUTH=user:password` optionally adds an outer gate in front of every page and API route (a
  malformed value fails closed; `/api/health` and `/api/cron/*` stay reachable).
- Write requests require a same-origin JSON request (CSRF protection); secrets entered in the UI are encrypted with
  AES-256-GCM; CSV exports are safe against formula injection. Plugins (which can use `PLUGIN_*` env keys) are
  agency-only.

## Data & deployment

Users, sessions, clients, dashboards, rules, alert routes, plans and the audit log are JSON files in `./data`
(`DATA_DIR`), with one folder per client workspace in `data/workspaces/`. Back it up — it holds user accounts. One Node
process is supported (file locks, sessions and rate limits are in-process). If the directory isn't writable the app
keeps working in memory and says so on the Data source page. Health checks: `GET /api/health` (public, no data).

**Analytics warehouse.** Google Ads data the app reads is kept in SQLite (`node:sqlite`, built into Node.js 22.13+;
no database server): `data/warehouse/live.sqlite` (and `demo.sqlite` for demo data). Settled days (older than the
14-day restatement window) are read from it instead of asking Google again, and history outlives Google's windows
(change history 30 days, hourly 92 days, search terms 12 months, daily 37 months). Syncs run from **Data source →
Warehouse**, an in-process timer (`WAREHOUSE_SYNC_ENABLED=true`), `POST /api/cron/warehouse` with
`Authorization: Bearer $CRON_SECRET`, or the command line:

```bash
npm run warehouse -- sync                 # every accessible account, within WAREHOUSE_SYNC_MAX_REQUESTS
npm run warehouse -- status               # what is stored per account and table, last syncs
npm run warehouse -- backup <file>        # consistent copy while the app runs
npm run warehouse -- purge --account <id> --yes
```

Design, tables and diagrams: [docs/en/DATABASE-DESIGN.md](docs/en/DATABASE-DESIGN.md) and
[DATABASE-DIAGRAM.png](DATABASE-DIAGRAM.png) (source [DATABASE-DIAGRAM.mmd](DATABASE-DIAGRAM.mmd)).

```bash
npm run build && npm start               # production server on :3000
docker build -t savd-ads .               # or Docker (standalone output)
docker run -p 3000:3000 --env-file .env -v savd-data:/app/data savd-ads
```

On serverless hosts use an external cron for alerts; the JSON store falls back to memory there.

## Development

```bash
npm run dev            # dev server
npm run verify         # lint + typecheck + unit tests
npm run test:e2e       # Playwright (builds, runs in pinned demo mode); PLAYWRIGHT_CHANNEL=chrome uses installed Chrome
npm run env:example    # regenerate .env.example from the env registry
npm run docs:diagrams  # render the Mermaid diagrams (DATABASE-DIAGRAM.mmd, docs/images/*DIAGRAM*.mmd) to PNG
npm run demo:snapshot  # print the demo dataset summary
npm run decode-reference  # unpack the prototype HTML into reference/decoded/
npm run parity:prepare    # copy the prototype to parity/ for side-by-side checks (port 4100)
```

Developer pages: `/dev/kit` (UI kit) and `/dev/charts` (every chart type) — not available in production builds.
Architecture notes, conventions and recipes for contributors live in `.agents/AGENTS.md` and
`.agents/KNOWLEDGE BASE.md`.

## Documentation

- English: [docs/en/OVERVIEW.md](docs/en/OVERVIEW.md) (what the project does),
  [docs/en/USER-GUIDE.md](docs/en/USER-GUIDE.md) (step-by-step guide with screenshots) and
  [docs/en/DATABASE-DESIGN.md](docs/en/DATABASE-DESIGN.md) (the analytics warehouse); Word versions in
  [docs/en/docx/](docs/en/docx/).
- Vietnamese: [docs/GIOI-THIEU-DU-AN.md](docs/GIOI-THIEU-DU-AN.md),
  [docs/HUONG-DAN-SU-DUNG.md](docs/HUONG-DAN-SU-DUNG.md) and
  [docs/THIET-KE-CO-SO-DU-LIEU.md](docs/THIET-KE-CO-SO-DU-LIEU.md); Word versions in [docs/docx/](docs/docx/).

Regenerate the screenshots with `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run docs:screenshots`, the diagrams
with `PLAYWRIGHT_CHANNEL=chrome npm run docs:diagrams`, and the Word files with `npm run docs:docx` (needs
[pandoc](https://pandoc.org) 3 or later; Mermaid blocks are drawn as images, and the build fails if an image is
missing).

## Troubleshooting

| Banner says | Fix |
|-------------|-----|
| No Google Ads credentials found in .env | Create `.env` from `.env.example`. |
| .env is missing N of 4 required keys | Add the listed keys. |
| Credentials were rejected (`AUTH_REFRESH_TOKEN_INVALID`) | Generate a new refresh token; publish the OAuth app so tokens stop expiring after 7 days. |
| `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` (older: `DEVELOPER_TOKEN_NOT_APPROVED`) | The OAuth client's Google Cloud project only has Test access — upgrade it to Explorer or higher on the Google Ads API Overview page in Cloud Console. |
| `USER_PERMISSION_DENIED` | Set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the manager account that links to the client. |
| `REQUESTED_METRICS_FOR_MANAGER` | `GOOGLE_ADS_CUSTOMER_ID` is a manager — use a client account id. |
| Every page opens /setup | No user yet: use the setup code from the server log or `AUTH_SETUP_TOKEN`. |
| Warehouse tab: "SQLite is built into Node.js 22.13 and later" | Upgrade Node.js; the app works without the warehouse meanwhile. |
| "No Google Ads account is assigned to your organization yet" | An agency admin has to assign an account to the client on **Access → Clients**. |
