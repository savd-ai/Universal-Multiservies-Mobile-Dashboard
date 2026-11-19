# SAVD Ads Intelligence: project overview

This document explains what the project does. For step-by-step instructions with screenshots, see the [User guide](USER-GUIDE.md).

![The Overview page of SAVD Ads Intelligence](../images/02-tong-quan.png)

*Figure 1. The Overview page (default dashboard) running on demo data for the sample account “Acme Running Co.”.*

## What is it?

**SAVD Ads Intelligence** is a web application for monitoring and managing Google Ads accounts, built for an agency (SAVD) and its clients. Everyone builds their own dashboards from widgets (metric tiles, charts, tables), asks questions of the data without writing queries, and clicks a chart to cross-filter the other widgets. On top of that, the application covers the work that is specific to Google Ads:

- **Monitoring and alerts:** detects unusual metrics automatically (CPA spikes, conversion drops, overspend, broken tracking…), explains them with the account's change history, and sends alerts to Slack, Microsoft Teams, Discord or a webhook.
- **Budget planning and management:** tracks month-to-date pacing, forecasts spend, suggests how to reallocate budgets, supports multi-month plans, and shows Google's own budget and target simulators next to our models.
- **AI suggestions:** proposes campaign ideas from account data, drafts campaign blueprints, writes ad copy, suggests negative keywords and answers questions in natural language.
- **Cross-channel reporting through plugins:** puts Google Ads next to Meta, Microsoft, TikTok and other data sources, and lets you build a plugin for any service that has a REST API.
- **Several clients, one sign-in:** SAVD staff see every client's accounts and a cross-client report; each client's people sign in and only see their own accounts.
- **Long-term data:** keeps the Google Ads data it reads in a local SQLite warehouse, so history outlives Google's own limits and days that can no longer change are read without asking Google again.

The application only **reads** Google Ads data and never changes your account (see [Security](#security)).

## What's new in this version

This version answers the four points of SAVD's review (September 2026):

| Feedback | What the application does now |
|------------------------------|----------------------------------------------------------------|
| 1. Use Google's forecasting tools (Performance Planner, bid and budget simulators) if they are available, and decide when to show them instead of our models | Performance Planner isn't available in the Google Ads API (or in the official Google Ads MCP server, which only runs GAQL searches). Google's **campaign budget and target simulators** and its **budget recommendations** are, and the application reads them. A new **Simulators** tab shows them next to our model, with a published rule for which estimate leads for each planning question; the optimizer uses Google's curves where they exist. |
| 2. Take the change history into account in anomaly detection | Every signal is compared with the Google Ads change log: shifts caused by the account's own changes are marked *Expected* and softened, bid-strategy changes get a learning period, likely causes are named in the recommendation (with before → after and the delay), and signals with no recent change are flagged as likely external. |
| 3. Multi-tenancy: SAVD sees all clients, clients see their own accounts | Clients own Google Ads accounts; each client has its own workspace (dashboards, rules, alerts, plans, settings). Agency roles see every client and a new **Clients** page with every account side by side; client roles only ever list, open or store data for their own accounts. |
| 4. Login and access control | Sign-in with email and password (optional two-factor authentication and Sign in with Google), invitations, four roles (agency admin, agency member, client admin, client viewer), permission checks on every API call and page, sessions that expire, and an audit log of sign-ins and changes. |

Also new: an **analytics warehouse** (SQLite) that keeps Google Ads history beyond Google's own limits; see [Long-term data](#long-term-data-the-analytics-warehouse).

## Demo data and live data

The application works before any connection is configured. When `.env` doesn't have enough information, every page shows **demo data** and a *DEMO DATA* banner states the reason. Reasons are checked in this order:

| Reason | When it happens |
|------------------------|---------------------------------------------------------------|
| Demo mode is forced | `DASHBOARD_FORCE_DEMO=true` is set |
| No Google Ads credentials | There is no `.env` file, or it has no Google Ads keys |
| Missing keys | `.env` has only some of the 4 required keys (the app lists the missing ones) |
| Authentication failed | Google rejected the credentials, for example an expired refresh token |
| API error | The Google Ads API returned another error (the app shows the error code) |

The demo data has two sample accounts: a running-shoe retailer (“Acme Running Co.”, 8 campaigns with planted problems) and an outdoor store (“Trail Gear Outlet”, no problems), each with months of history, plus demo versions of Google's simulations, recommendations and change history. Numbers are generated deterministically per day, so the same day always gives the same results. The planted problems let you try the detection features: a CPC spike with no account change behind it, a PMax conversion drop after a landing-page change, a Display spend surge after a bid-strategy switch, a YouTube CTR collapse after a new ad, a tracking break, a budget-limited brand campaign, and a spend jump that simply follows a 40% budget raise. On first run the setup creates one demo client per demo account.

Once `.env` has all 4 valid Google Ads keys, the application switches to live data. Pages and widgets stay the same; only the data source changes.

## Features by page

| # | Page | What you can do |
|----|---------------|--------------------------------------------------------------------|
| 01 | **Overview** | Tabbed dashboards; drag, resize, add and remove widgets from a gallery of about 35; filter by date range, campaign type, campaign, status and device, plus cross-filtering; saved views; JSON export and import, print to PDF, TV mode. |
| 02 | **Campaigns** | Campaign table with trend sparklines, totals, column chooser and CSV export; quick-look drawer; detail pages with ad groups, keywords (Quality Score), search terms, devices and hours, change history with who made each change and impact analysis, signals and notes. |
| 03 | **Budget planner** | Month pacing and projected month-end spend, per-campaign targets, recommended daily budgets, budget optimizer, 30-day forecast, **Google's simulators and budget recommendations**, multi-month plans, Google Ads Editor exports. |
| 04 | **Anomalies** | Several detection methods; change-history verdicts on every signal; signal handling (acknowledge, snooze, resolve); root-cause explanations; threshold rules; alert channels and routes; delivery log. |
| 05 | **AI studio** | Campaign ideas, campaign blueprints, RSA ad copy, negative-keyword assistant; the **Ask AI** chat. |
| 06 | **Explore** | Query builder: pick metrics, group by up to 3 dimensions, filter, sort, choose a chart, save questions, add them to dashboards; custom metrics defined with formulas. |
| 07 | **Channels** | Google Ads next to other platforms: total spend, blended ROAS, MER, share of spend, trends by platform. |
| 08 | **Plugins** | Connector gallery, alert webhooks, a no-code REST plugin builder, code plugins (agency roles). |
| 09 | **Data source** | Connection status, which keys are set (values masked), Google Ads health check, AI, storage, scheduler, display preferences; the **analytics warehouse** (what is stored, syncs); activity log (agency roles). |
| 10 | **Clients** | Every account you can open, grouped by client: spend, conversions, CPA and ROAS against the comparison period, month pacing and open signals, totals in one currency. |
| 11 | **Access** | Invite people, choose their role and client, reset passwords and two-factor authentication; create clients and assign their Google Ads accounts. |
| — | **Account** | Your profile, two-factor authentication, password and signed-in devices (from the user menu). |

## Feature details

### Customizable dashboards

![Dashboard edit mode](../images/06-tuy-bien.png)

*Figure 2. Edit mode: move, resize, configure or remove each widget.*

- **Several dashboards:** *Overview*, *Executive* and *Monitoring* come built in; create more from templates (*Budget & pacing*, *Cross-channel* or blank), rename, duplicate, set as default, delete. Each client workspace has its own dashboards.
- **Edit mode:** drag and resize on a 12-column grid, move widgets with buttons or the keyboard, undo and redo, autosave; removed template widgets can be added back quickly; one button restores the template layout.
- **Widget gallery:** key metrics (KPIs), trend small multiples, budget pacing, anomaly feed, campaign table, AI ideas, cross-channel, hour × weekday heatmap, conversion funnel, CPA vs spend bubble chart, treemap, forecast, goal tracker, top movers, wasted search terms, Markdown notes… plus questions saved from Explore.
- **Filters and cross-filtering:** filters live in the page URL, so sharing a link shares the exact view; click a bar or a row to filter the other widgets; a widget that ignores a filter shows an ⓘ hint.
- **Sharing and presenting:** export and import dashboards as JSON, print or save as PDF, TV mode (full screen, auto-refresh, rotation through dashboards), download charts as PNG, view the data as a table, export CSV.

### Monitoring and anomaly alerts

![A signal explained by the change history](../images/19-boi-canh-thay-doi.png)

*Figure 3. A spend jump that follows the account's own +40% budget raise is marked Expected, with the change named in the recommendation.*

- **Detection methods:** z-score against a 7, 14 or 28-day baseline; robust z-score (median and MAD); day-of-week seasonality; your own thresholds; overspend and underspend against budget; broken tracking; campaigns that stop delivering; budget-limited opportunities.
- **Signals with context:** each signal has a severity (*Critical*, *Warning* or *Opportunity*), the observed value against the expected one, the normal range, evidence, a recommendation and the account changes that happened just before.
- **Change history:** the application reads Google's change log (30 days) and classifies each change (budget, bid strategy, bids and targets, landing page, ads, status, keywords, negatives, targeting), what it did (for example *Budget +40% ($780 → $1,092)*) and who made it (web interface, Editor, API, scripts, automated rules, auto-applied recommendations). Every signal then gets a verdict:
  - **Expected:** the shift is what the change was meant to do (budget raised → spend up, pause → no delivery, negatives added → CTR up…); the signal is softened and the recommendation says what to check instead;
  - **Learning period:** a bid-strategy or target change is still being learned; efficiency signals are capped at *Warning*, spend and pacing signals never are;
  - **Likely / possible cause:** a change that typically moves this metric happened on or shortly before the start of the shift; the recommendation names it, with its date, before → after values and the delay;
  - **No account changes:** nothing changed in the 14 days before (in the campaign, or in the account for an account-level signal), so the cause is likely external (competition, seasonality), with metric-specific checks; for a tracking break or a stop in delivery the note points at the conversion tag, the site, billing or policy instead.
- **Root-cause explanation:** CPA is split into CPC and conversion rate (CPA = CPC ÷ conversion rate) to show which part moved, then broken down by country and device, next to the changes in the window.
- **Signal lifecycle:** acknowledge, snooze for 1 hour, 1 day or 7 days, resolve, reopen, add notes; signals close themselves when the metric returns to normal and reopen if they get worse.
- **Alert delivery:** Slack, Microsoft Teams (Workflows), Discord or an HMAC-signed webhook; routes by severity, signal type, metric and campaign; quiet hours; deduplication; retries; delivery log; daily digest; browser notifications. Alerts carry the change-aware recommendation.

### Budget planning and management

![Budget pacing](../images/13-ngan-sach.png)

*Figure 4. Budget planner: monthly budget, spend to date, projected month-end spend and the cumulative spend chart.*

- **Pacing:** month-to-date spend, projected month-end spend, remaining headroom, overpacing campaigns; cumulative chart of actual, projected and ideal pace. Paused campaigns count only what they already spent (status *Paused*, not underpacing). Until targets are saved, last month's spend, scaled to this month's days, can seed them as a draft.
- **Monthly targets:** set a monthly budget per campaign (slider, typed value or lock) and see the daily budget needed to land on target.
- **Optimizer:** reallocates the same total budget to maximize conversions or conversion value, based on each campaign's marginal-return curve, within minimum and maximum limits. It uses Google's simulator curve for campaigns that have one and puts our model on the same scale for the others.
- **Forecast:** the next 30 days of spend, conversions, value and clicks, with an 80% range and a backtest error.
- **Plans:** multi-month plans, flighting patterns (even, front-loaded, back-loaded…), seasonal suggestions, AI ideas added to the plan.
- **Google Ads budget rules:** Google Ads budgets are daily; Google may spend up to 2× the daily budget on a single day but no more than 30.4× the daily budget in a month. The application calculates and warns according to these rules; shared budgets are paced per budget.

### Google's estimates next to our models

![Google's simulators next to our model](../images/16-mo-phong-google.png)

*Figure 5. The Simulators tab: which estimate answers which question, then Google's per-campaign simulations and recommendations.*

What Google makes available, and what the application does with it:

| Google tool | Available through the API? | In the application |
|----------------------------|----------------------------|------------------------------------------|
| Performance Planner | No (Google Ads interface only; not in the official Google Ads MCP server either) | Not shown; for Performance Max the Simulators tab suggests using it in Google Ads |
| Campaign budget simulator | Yes (`campaign_simulation`, read with GAQL; Performance Max too when Google has one) | Simulators tab, budget what-ifs, optimizer curves |
| Target CPA / target ROAS simulators | Yes | Simulators tab (target what-ifs) |
| Budget recommendations | Yes (`recommendation`, with Google's impact estimate) | Simulators tab, with a link to apply it in Google Ads |
| Keyword Planner forecasts | Only through a separate service, not a report | Not used (the application stays read-only and report-only) |

**When Google's estimate leads and when ours does:**

| Question | Leads | Why |
|---------------------------|------------------------|------------------------------------------|
| Will we land on budget this month? | Our pacing projection | It needs this month's actual spend and Google's 2× / 30.4× limits; Google's simulators replay a past week and don't project calendar months. |
| What will the next 30 days look like? | Our forecast | Performance Planner isn't in the API, so there is no Google forecast to read. |
| What if one campaign's daily budget changes? | Google's budget simulator, when it exists, ended at most 14 days before the latest data and covers that budget (±5%) | It replays the campaign's recent auctions at other budgets (Performance Max too, when Google returns a simulation); our model only sees the spend the campaign actually had. |
| What if a target CPA or ROAS changes? | Google's target simulator | We don't model bid targets. |
| How should budget move between campaigns? | Our optimizer, using Google's curves where available | Google simulates one campaign at a time; the optimizer compares marginal returns across campaigns, so our curves for the rest are matched to Google's curvature first. |
| What if a shared budget changes? | Our model, for the shared budget as a whole | Google simulates each campaign on a shared budget as if the budget were its own; those campaigns compete for one budget, so their simulations don't add up to it. |

Both estimates stay visible, with a line saying whether they agree (within 10%) or which one is more optimistic.

### AI suggestions

![AI studio](../images/23-y-tuong-ai.png)

*Figure 6. AI studio: an account narrative and campaign ideas based on 30 days of data.*

- **Campaign ideas:** 6 ideas based on the last 30 days of account data, for a goal (scale conversions, lower CPA, launch a product, Q4 season) and a test budget; ideas can be added to the budget plan.
- **Blueprint:** turns an idea into a full campaign structure (ad groups, keywords and match types, negatives, headlines and descriptions, assets, bidding, targeting) and exports it as a Google Ads Editor CSV with everything paused.
- **Ad copy (RSA):** up to 15 headlines (30 characters max) and 4 descriptions (90 characters max), checked against Google Ads limits, with pin and lock per line.
- **Negative keywords:** finds search terms that spend without converting, estimates the savings and always protects brand terms.
- **Ask AI (⌘J):** ask in natural language, for example “Top 5 campaigns by ROAS last 7 days”, and get an answer with a chart built from a real query; open it in Explore or add it to a dashboard.
- **AI providers:** Claude (Anthropic), OpenAI or Gemini; one API key is enough. Without a key, or when a call fails, a rule-based demo engine answers and the interface labels the result as demo suggestions. Gemini also works on Google's free tier: when `gemini-3.8-flash` runs out of its small daily quota, a Flash-Lite fallback model answers. With a paid Gemini key (Tier 1, verified on 2026-10-09) every AI feature runs on `gemini-3.8-flash`, and Google doesn't use the prompts to improve its products.

### Explore: ask questions of the data

A notebook-style query builder: choose a source (Google Ads, blended data from every platform, or a plugin), metrics, up to 3 group-by dimensions, filters, sorting, a row limit and a chart type; view the result as a chart, a table or the query spec; save questions, share links, add them to dashboards, export CSV. You can define your own metrics with formulas such as `conv_value / cost`.

### Plugins and cross-channel reporting

- **Built-in connectors:** Meta, Microsoft Advertising, TikTok, LinkedIn, Amazon, Pinterest, Snapchat, Reddit, GA4, Shopify, WooCommerce, Google Sheets, BigQuery. In this version they run on demo data and carry a *DEMO* label.
- **Custom REST plugins (live data):** enter the API address, the authentication type (API key, bearer, basic), pagination and field mapping, preview the data and save, with no code.
- **Code plugins:** `npm run plugin:new` scaffolds a TypeScript plugin with demo data and a test.
- **Channels page:** adds up spend across platforms in one currency, computes blended ROAS and MER (store revenue divided by ad spend), and warns about double counting when every platform claims its own conversions.

### Clients, users and access

![The Clients page](../images/32-khach-hang.png)

*Figure 7. The Clients page: every client's accounts side by side, with totals in one currency.*

- **Clients and workspaces:** an agency admin creates a *client* for each organization and assigns the Google Ads accounts that SAVD's credentials reach (through the manager account). Each client gets its own workspace: dashboards, saved questions, custom metrics, detection rules, alert channels and routes, budget targets and plans, AI idea sets, simulated actions and display preferences. A new workspace starts from the default templates or from a copy of the agency's setup; moving an account between clients moves its saved data with it.
- **Cross-client report:** the **Clients** page lists every account the signed-in person may open, grouped by client, with KPIs against the comparison period, month pacing and open signals, and totals converted to one currency.
- **Roles:**

  | Role | Sees | Can |
  |------------------|---------------------------|----------------------------------------------------------------|
  | Agency admin | Every client and account | Everything: users, clients, data source, plugins, settings |
  | Agency member | Every client and account | Edit dashboards, rules, alerts, plans and plugins; simulated actions; AI |
  | Client admin | Their client's accounts | Edit their dashboards, rules, alerts and plans; simulated actions; AI; their display preferences; invite their own team |
  | Client viewer | Their client's accounts | Read everything, Ask AI and AI studio; no changes |

- **Sign-in:** email and password; optional two-factor authentication with an authenticator app (TOTP) and recovery codes, which can be required for agency roles or for everyone; optional **Sign in with Google** for invited people and for the agency's own Google domain. People join through one-time invite links that an admin copies to them; password resets work the same way (the application sends no email).
- **Isolation:** the server checks the role and the account on every request. A client's user can't list, open or save anything for another client's accounts (a direct request for one is refused), and the menus only offer what the role allows.

![Inviting someone](../images/33-nguoi-dung.png)

*Figure 8. The Access page: inviting a client viewer for one client.*

### Long-term data: the analytics warehouse

![The Warehouse tab](../images/37-kho-du-lieu.png)

*Figure 9. Data source → Warehouse: the SQLite warehouse, what it holds for the active account, monthly totals and recent syncs.*

The Google Ads API only serves recent history for some reports (30 days of change history, 92 days of hourly data, 12 months of search terms, 37 months of daily data), and every request counts against a daily quota. The application therefore keeps the data it reads in a local **SQLite** database:

- **Transparent:** every page reads through the warehouse. Days whose numbers can no longer change (older than 14 days) come from the warehouse; recent days still come from Google. Stored history beyond Google's windows becomes available to Explore, widgets and budget plans.
- **More history:** change events, campaign settings over time (status, bidding, budget), and snapshots of Google's simulations and budget recommendations are kept as well.
- **Syncs:** **Sync this account** / **Sync all accounts** on the Data source → Warehouse tab, a built-in timer, an external scheduler or the command line (`npm run warehouse`). Newest data comes first, within a budget of API requests.
- **Simple to run:** built into Node.js (no database server); one file per data mode (`live.sqlite`, `demo.sqlite`) in the data folder; SQL views with monthly totals for SQL and BI tools; a schema that is ready to move to PostgreSQL.

![How the data flows](../images/DATA-FLOW-DIAGRAM.png)

*Figure 10. How Google Ads data reaches the warehouse and the dashboard.*

The tables, rules and diagrams are in [Analytics warehouse: database design](DATABASE-DESIGN.md). The full diagram is `DATABASE-DIAGRAM.png` at the repository root.

### Shared features

Works on phones and tablets as well as desktops (a ☰ menu, tables that scroll inside their card with the campaign column kept in place, full-screen panels); command palette (⌘K) for pages, campaigns, signals and actions; keyboard shortcuts; light and dark themes; switching between the accounts you may open (through a manager account); showing money in another currency with an exchange rate; automatic refresh; a *Data source* page that shows which keys are set (last characters only) and an activity log that includes sign-ins and user changes.

## Security

- **Read-only Google Ads:** the application only calls read APIs (`search`, `searchStream`, `listAccessibleCustomers`); a test fails if a mutate call (`:mutate`) appears. Google's simulations and recommendations are read the same way. Buttons such as *Pause*, *Set budget*, *Apply plan* and *Add negatives* behave as follows:
  - in demo mode they run as **simulations**, labelled *SIMULATED*, can be undone and are recorded in the activity log;
  - in live mode they change nothing in the account and offer **Open in Google Ads ↗**, a change list to copy, or a Google Ads Editor CSV instead.
- **Sign-in and sessions:** passwords are hashed with scrypt; sessions use a random HttpOnly cookie that is stored only as a hash, expire after 7 days (24 hours without activity) and are revoked when a password, role or status changes; accounts lock for 15 minutes after 5 failed attempts; two-factor secrets are encrypted and recovery codes are hashed; sign-in attempts are rate-limited.
- **Access control:** every API route has a declared permission (a test fails if a new route has none); pages check the role on the server; client users are confined to their own workspace and accounts.
- **Secrets stay on the server:** `.env` is read only on the server; the interface only knows which keys are set and their last few characters (and only agency roles see even that); logs mask secrets; keys entered in the interface are encrypted with AES-256-GCM (requires `APP_ENCRYPTION_KEY`). Plugins, which can use the deployment's `PLUGIN_*` keys, are managed by the agency only.
- **Attack protection:** every write request must be a same-origin JSON request (CSRF protection); outbound requests to addresses people enter (webhooks, plugins) pass an SSRF guard (HTTPS only, internal and metadata addresses blocked); CSV exports are protected against formula injection; Basic authentication can still be added in front of the whole application (`DASHBOARD_BASIC_AUTH`).
- **Safe AI:** the AI only receives aggregated data of the account being viewed, treats account data as untrusted, and has no tools or write access; numbers in answers are computed and checked by the server (a number that is part of a name, or that comes from the facts the AI was given, counts as matched), and AI text names campaigns rather than internal IDs.

## Technology

| Area | Choice |
|--------------|----------------------------------------------------------------------|
| Platform | Next.js 16 (App Router), React 19, TypeScript in strict mode |
| Interface | Tailwind CSS v4, the SAVD design system (teal and ink), ECharts 6 charts, react-grid-layout drag-and-drop grid |
| Data | TanStack Query; filter state in the URL (nuqs); validation with zod |
| Queries | One query engine shared by widgets, Explore, AI and exports; derived metrics are ratios of sums (never averages of daily ratios) |
| Storage | JSON files in `./data`: users, sessions, clients and the audit log at the top level, one folder per client workspace (dashboards, rules, alerts, plans, settings). Google Ads history in a SQLite warehouse (`./data/warehouse/live.sqlite`, Node's built-in `node:sqlite`) |
| AI | Anthropic Claude, OpenAI or Google Gemini (optional) |
| Testing | Vitest (about 1,080 unit tests), Playwright (70 end-to-end tests, including sign-in, client isolation, the warehouse sync, phone layouts and accessibility checks), axe (accessibility) |
| Deployment | `npm run build && npm start`, or Docker (a `Dockerfile` is included); health check at `/api/health` |

## Current limitations

- Live connectors for Meta, Microsoft, TikTok and the other built-ins are not in version 1 (they use demo data). To get live data from another platform, build a custom REST plugin.
- Writing to Google Ads is not supported. This is deliberate.
- Performance Planner forecasts can't be read (Google doesn't expose them); Keyword Planner forecasts aren't used. Of Google's simulators, the budget, target CPA and target ROAS ones are read; bid (CPC) and impression-share simulations are not yet.
- Application data is stored as JSON files and Google Ads history in a SQLite file, so only a single Node process is supported (sessions, locks and caches live in that process). Running several replicas needs a shared database first; the warehouse schema is ready to move to PostgreSQL.
- The application doesn't send email: admins copy invite and password-reset links to people themselves. Single sign-on is limited to Google.
- The live Google Ads connection (including the simulator and recommendation reads), real AI providers, Google sign-in and real webhook delivery have been tested with recorded sample responses only, not with real credentials.

## Related documents

- [User guide](USER-GUIDE.md), step by step with screenshots.
- [Analytics warehouse: database design](DATABASE-DESIGN.md): tables, diagrams, read and sync rules, operations. The full diagram is `DATABASE-DIAGRAM.png` (source `DATABASE-DIAGRAM.mmd`) at the repository root.
- Word versions of the English documents: the `docs/en/docx/` folder.
- Vietnamese versions: `docs/GIOI-THIEU-DU-AN.md`, `docs/HUONG-DAN-SU-DUNG.md` and `docs/THIET-KE-CO-SO-DU-LIEU.md`.
- `README.md` in the project root: technical documentation (installation, environment variables, deployment).
- `.agents/AGENTS.md` and `.agents/KNOWLEDGE BASE.md`: architecture notes, conventions and domain knowledge for developers and AI agents.
