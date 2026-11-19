# SAVD Ads Intelligence user guide

This guide goes step by step: installation, signing in, the interface, each page, working with several clients, and connecting live Google Ads data. Screenshots are taken in demo mode, signed in as an agency admin (sample accounts “Acme Running Co.” and “Trail Gear Outlet”, 1440 × 900 screen, light theme). Button and menu names are shown in **bold**.

For an overview of what the project does, read the [Project overview](OVERVIEW.md).

> What you see depends on your role. Agency roles see every client; client roles only see their own organization's accounts, and some pages or buttons are hidden for them (see [Step 25](#step-25-invite-people-and-choose-their-role)).

## Contents

1. [Install and run](#step-1-install-and-run)
2. [Create the first admin and sign in](#step-2-create-the-first-admin-and-sign-in)
3. [Get to know the interface](#step-3-get-to-know-the-interface)
4. [Read the widgets](#step-4-read-the-widgets)
5. [Choose a date range](#step-5-choose-a-date-range)
6. [Filter the data](#step-6-filter-the-data)
7. [Customize a dashboard](#step-7-customize-a-dashboard)
8. [Add widgets](#step-8-add-widgets)
9. [Configure a widget](#step-9-configure-a-widget)
10. [Manage several dashboards](#step-10-manage-several-dashboards)
11. [Monitor campaigns](#step-11-monitor-campaigns)
12. [Manage budgets](#step-12-manage-budgets)
13. [Compare with Google's simulators](#step-13-compare-with-googles-simulators)
14. [Plan several months](#step-14-plan-several-months)
15. [Handle anomalies](#step-15-handle-anomalies)
16. [See what changed before a signal](#step-16-see-what-changed-before-a-signal)
17. [Explain a signal and tune the rules](#step-17-explain-a-signal-and-tune-the-rules)
18. [Set up alerts](#step-18-set-up-alerts)
19. [Use AI studio](#step-19-use-ai-studio)
20. [Ask questions with Ask AI](#step-20-ask-questions-with-ask-ai)
21. [Build questions in Explore](#step-21-build-questions-in-explore)
22. [View cross-channel reporting](#step-22-view-cross-channel-reporting)
23. [Connect plugins](#step-23-connect-plugins)
24. [See every client on one page](#step-24-see-every-client-on-one-page)
25. [Invite people and choose their role](#step-25-invite-people-and-choose-their-role)
26. [Manage clients and their accounts](#step-26-manage-clients-and-their-accounts)
27. [Your account and two-factor authentication](#step-27-your-account-and-two-factor-authentication)
28. [Connect live Google Ads](#step-28-connect-live-google-ads)
29. [Keep long-term data in the warehouse](#step-29-keep-long-term-data-in-the-warehouse)
30. [Display preferences](#step-30-display-preferences)
31. [Turn on real AI](#step-31-turn-on-real-ai)
32. [Keyboard shortcuts and command palette](#step-32-keyboard-shortcuts-and-command-palette)
33. [Dark theme and TV mode](#step-33-dark-theme-and-tv-mode)
34. [Use it on a phone](#step-34-use-it-on-a-phone)
35. [Troubleshooting](#troubleshooting)
36. [Appendix: updating the documents](#appendix-updating-the-documents)

## Step 1. Install and run

**Requirements:** Node.js 20.18 or later (Node.js 22 recommended) and npm.

1. Open a terminal in the project folder and install the dependencies:

   ```bash
   npm install
   ```

2. Start the application in development mode:

   ```bash
   npm run dev
   ```

3. Open <http://localhost:3000> in your browser. No `.env` file is needed: the application runs on demo data. The first visit takes you to the setup page (Step 2).

Run the production build (faster, for deployment):

```bash
npm run build
npm start
```

Or run it with Docker (drop `--env-file .env` if you don't have a `.env` file yet):

```bash
docker build -t savd-ads .
docker run -p 3000:3000 --env-file .env -v savd-data:/app/data savd-ads
```

> Users, sessions, clients, dashboards, alert rules, budget plans and logs are saved as JSON files in the `./data` folder (change it with `DATA_DIR`); each client's workspace lives in `data/workspaces/<client id>/`. If the folder isn't writable, the application still runs and keeps the data in memory until it restarts. Back the folder up: it contains user accounts.

## Step 2. Create the first admin and sign in

**First run.** While nobody has an account, every page opens **Create the first admin**:

1. Find the one-time setup code in the server log. The terminal running the application prints a line like `No users yet. Open /setup and enter this one-time setup code to create the first admin: ABCD-EFGH-…`. If `AUTH_SETUP_TOKEN` is set in `.env`, its value is the code instead.
2. Enter the **Setup code**, **Your name**, **Email** and a **Password** of at least 10 characters (twice), then click **Create admin and sign in**.
3. You are now the first **agency admin**. In demo mode the application also creates one demo client per demo account (“Acme Running Co.” and “Trail Gear Outlet”), so you can try the multi-client features straight away.

![The sign-in page](../images/01-dang-nhap.png)

*Figure 1. The sign-in page.*

**Signing in afterwards:**

1. Enter your **Email** and **Password** and click **Sign in**. After 5 wrong passwords the account is locked for 15 minutes.
2. If two-factor authentication is on (Step 27), the page asks for **One more step**: enter the 6-digit **Code** from your authenticator app, or one of your recovery codes, and click **Verify**. This step also follows **Sign in with Google**.
3. **Sign in with Google** appears when the administrator has configured Google sign-in (`AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`). It works for people who were invited, and for verified Google accounts of the domains in `AUTH_GOOGLE_ALLOWED_DOMAINS` (they join as agency members).

Nobody can create an account on their own: an admin invites them (Step 25). A session lasts up to 7 days and ends after 24 hours without activity; **Sign out** is in the user menu (Step 3).

> `AUTH_MODE=off` turns sign-in off for a local, single-person setup: everyone who can open the page is treated as an agency admin. Don't use it on a server that others can reach.

## Step 3. Get to know the interface

![Main interface](../images/02-tong-quan.png)

*Figure 2. The Overview page: sidebar, top bar, demo banner and widgets.*

- **Left sidebar:** the pages you can open, numbered 01 to 11 for an agency admin: Overview, Campaigns, Budget planner, Anomalies, AI studio, Explore, Channels, Plugins, Data source, Clients and Access. Pages your role can't use aren't listed. The red number next to **Anomalies** is the count of open *Critical* and *Warning* signals. The **DEMO DATA** card at the bottom says the application is using demo data; **Configure .env →** opens the Data source page.
- **Top bar**, from left to right:
  - the platform, the account (**Acme Running Co. ▾**, click to switch accounts; the list only shows the accounts you may open) and the customer ID;
  - the date range **7D / 30D / 90D**, the **More ▾** button and the dates being shown;
  - **⌘K** opens the command palette, **↻** refreshes the data;
  - the alerts bell (a red dot with the number of open signals), click it for a quick look;
  - **Ask AI** opens the chat; the switch toggles the light and dark themes;
  - your initials open the **user menu**: your name and role, your organization, **Account & security** (Step 27), **Access & users** (admins, Step 25) and **Sign out**.
- **DEMO DATA banner:** says why demo data is shown (in the screenshot, there are no Google Ads credentials in `.env`) and offers **Connect live data →**.
- **Content area:** the page title, the dashboard tabs (**Overview**, **Executive**, **Monitoring**), the **FILTER** bar and the widgets.

On a narrower window the sidebar shrinks to its numbers; on a phone it becomes a **☰** menu and the date range moves to a second row of the top bar (Step 34).

Each client has its own **workspace**: its dashboards, saved questions, detection rules, alert channels, budget targets and plans, and display preferences. When an agency user switches to an account, the application opens the workspace of the client that owns it, so the dashboards you see are that client's.

## Step 4. Read the widgets

![Widgets on the Overview dashboard](../images/03-tong-quan-widget.png)

*Figure 3. The lower part of the Overview dashboard: anomalies, campaign performance, AI ideas and cross-channel.*

The default **Overview** dashboard contains these widgets:

| Widget | What it shows |
|----------------------|------------------------------------------------------------------|
| **Key metrics** | Spend, conversions, CPA, ROAS, CTR and clicks; the percentage change against the comparison period and a small trend line. Green is good, red is bad (for CPA, an increase is bad). |
| **Spend & conversions** | Daily spend (area) and conversions (line) as two stacked charts sharing a time axis; the dashed line is the previous period; ◆ diamonds mark account changes or notes. Hover to see each day. |
| **Budget pacing** | The share of the monthly budget projected to be spent, month-to-date spend (MTD), the projection and the budget; the three campaigns furthest ahead of pace (paused ones are left out). **Plan →** opens the Budget planner. |
| **Anomalies** | The latest anomaly signals (last 3 days against the baseline). A signal explained by your own account change is marked *Expected*. **All signals →** opens the Anomalies page. |
| **Campaign performance** | Campaigns sorted by spend, with conversions, CPA, ROAS and a trend. Click a campaign name to open its drawer. |
| **AI campaign ideas** | A short account narrative and campaign ideas suggested by AI. |
| **Cross-channel** | Spend and ROAS of Google Ads next to the platforms connected through plugins. |

Each widget has a **⋯** button in its top-right corner with options such as **View data** (the numbers as a table), **Download CSV**, **Download PNG**, **Open in Explore**, **Focus** (full screen), **Duplicate**, **Settings…** and **Remove**. The options depend on the widget type and on your role (viewers can't change dashboards).

## Step 5. Choose a date range

![Choosing a date range](../images/04-khoang-thoi-gian.png)

*Figure 4. The More ▾ menu: preset ranges, a custom range and the comparison period.*

1. Click **7D**, **30D** or **90D** to see the last 7, 30 or 90 days.
2. Click **More ▾** for other ranges: **Month to date**, **Quarter to date**, **Year to date**, **Last month**.
3. For any dates, enter a start and an end date under **Custom range** and click **Apply**.
4. Pick the comparison period under **Compare to**: **Previous** (the preceding period of the same length), **Last year** (the same period a year earlier) or **Off**. The ▲▼ changes on the widgets compare against this period.

> Data runs up to the end of yesterday (“data through …”) because Google Ads numbers for the current day are incomplete. The date range and filters are kept in the page address, so a link you send shows your colleague exactly what you see (if their role lets them open the same account).

## Step 6. Filter the data

![Filters](../images/05-bo-loc.png)

*Figure 5. Filtered to PMax, with the Device filter open.*

- **Campaign type chips** (Search, PMax, Shopping, Video, Display, Demand Gen): click a chip to see only that type; hold ⌘ (Mac), Ctrl (Windows) or Shift while clicking to combine types; click **All** to clear.
- **Campaigns ▾**, **Status ▾**, **Device ▾**: pick one or more campaigns, statuses or devices.
- **Cross-filtering:** click a bar in a chart or a row in a table to filter the other widgets by that value. The filter appears as a chip with an **×** to remove it; **Esc** clears all cross-filters.
- **Clear all:** removes every filter.
- **Views ▾:** saves the current set of filters as a “view” to reopen later (stored in your browser).
- When a widget can't apply a filter, it shows an **ⓘ** next to its title; hover over it to see which filter is ignored.

## Step 7. Customize a dashboard

![Edit mode](../images/06-tuy-bien.png)

*Figure 6. Edit mode: the EDITING LAYOUT bar and the controls on each widget.*

1. Click **Customize dashboard** (or press `e`). The **EDITING LAYOUT** bar appears. Viewers don't have this button.
2. **Move a widget:** drag its title bar to a new position, or click **←** / **→**.
3. **Resize:** drag the right edge, the bottom edge or the bottom-right corner; or click the size button (**1/3**, **1/2**, **2/3**, **Full**…) to cycle through sizes.
4. **⚙** opens the widget settings (see Step 9); **×** removes the widget from the dashboard (you can undo it).
5. **Undo and redo:** the two curved arrows at the end of the edit bar, or ⌘Z and ⌘⇧Z.
6. The layout saves itself after every change (the edit bar shows **Saved**). Click **Done** to leave edit mode.
7. **Reset layout** restores the dashboard's template layout.

> Mouse drag-and-drop works when the window is at least 1180 px wide. On narrower screens, use the **←** / **→** and size buttons.

## Step 8. Add widgets

![Widget gallery](../images/07-thu-vien-widget.png)

*Figure 7. The widget gallery: search and filter by category.*

1. In edit mode, click **+ Add widget**.
2. Search by name in **Search widgets…**, or filter by category: **Performance**, **Budget**, **Monitoring**, **AI**, **Cross-channel**, **Content** (for example Markdown notes) and **Saved** (questions saved from Explore).
3. Click a widget to add it to the end of the dashboard, then drag it where you want it.

Template widgets you removed appear as small buttons on the edit bar so you can add them back quickly.

## Step 9. Configure a widget

![Widget settings](../images/08-cau-hinh-widget.png)

*Figure 8. The Widget settings panel of the Spend & conversions widget.*

Open it with **⋯ → Settings…** (or **⚙** in edit mode):

- **Title** and **Subtitle:** change the widget's title and description line.
- **Query** (for question widgets):
  - **Visualization:** the display type (number, KPI strip, trend, line, bar, stacked bar, donut, table, heatmap, funnel, scatter, treemap…);
  - **Metrics:** click to turn each metric on or off (Spend, Conv., CPA, ROAS, CTR, Impr. share, Lost IS budget, Avg. QS, MER…);
  - **Group by 1–3:** group by date, campaign, campaign type, device, country…;
  - **Date range:** **Follow dashboard** (use the shared range) or a fixed range of its own; **Limit:** the maximum number of rows;
  - **Compare with the dashboard's comparison period:** turns the comparison on or off;
  - **Open in Explore →:** opens the question in Explore for more detailed editing.
- **Follow dashboard filters:** untick a filter (Date range, Comparison, Campaign type…) and the widget stops following it.

## Step 10. Manage several dashboards

![Dashboard menu](../images/09-menu-dashboard.png)

*Figure 9. The ⋯ menu next to Customize dashboard.*

Switch dashboards with the tabs under the title (**Overview** is the default dashboard, marked *default*). The **⋯** button next to **Customize dashboard** offers:

- **Rename…:** change the name and the headline (wrap exactly one word in `*` to italicize it as the accent, for example `Every dollar, *accounted* for`);
- **Duplicate** and **Set as default**;
- **New dashboard…:** start from a template (Overview, Executive, Budget & pacing, Monitoring, Cross-channel) or a blank page;
- **Export JSON** / **Import JSON…:** back up a dashboard or move it to another machine;
- **Print / PDF** (⌘P): print or save as PDF;
- **TV mode:** opens the dashboard full screen in a new tab (see Step 33);
- **Delete dashboard.**

Viewers only get **Export JSON**, **Print / PDF** and **TV mode**. Dashboards belong to the client's workspace: everyone in that client sees the same dashboards.

## Step 11. Monitor campaigns

![Campaign table](../images/10-chien-dich.png)

*Figure 10. The Campaigns page.*

1. Open **Campaigns** (or press `g` then `2`).
2. Search by name in **Search campaigns**, filter by type (the chips) or by status (**All / Enabled / Paused**).
3. Click a column header to sort. **Columns ▾** chooses the visible columns, **Comfortable / Compact** changes the row height, **Export CSV** downloads the table.
4. The ▲▼ under each number is the change against the comparison period: green is good, red is bad. The **Total** row at the bottom sums the whole table.
5. Tick several campaigns to act on them together (pause, enable, change budgets). In demo mode these actions are simulated.

![Campaign drawer](../images/11-chien-dich-ngan-keo.png)

*Figure 11. Click a campaign name to open its drawer on the right.*

The drawer shows the main KPIs, daily spend against the daily budget (dashed line), open anomaly signals with explanations, and **Quick actions** (**Budget −10%**, **Budget +10%**, **Pause campaign**) labelled *SIMULATED* in demo mode. **Open full detail →** opens the detail page; press **Esc** to close the drawer.

![Campaign detail page](../images/12-chien-dich-chi-tiet.png)

*Figure 12. The campaign detail page, Changes tab: the change history.*

The detail page has the tabs **Overview**, **Ad groups**, **Keywords** (with Quality Score), **Search terms**, **Devices & hours**, **Changes**, **Signals** and **Notes**. **Changes** lists the account's change history for the campaign (what changed, before → after, and who made it: Google Ads web, Editor, API, a script, an automated rule…). Click **Analyze impact →** to compare the 14 days before and after a change, with a statistical test; for example, to check whether a bid-strategy switch raised CPA. **Open in Google Ads ↗** opens the same campaign in Google Ads.

## Step 12. Manage budgets

![Budget pacing](../images/13-ngan-sach.png)

*Figure 13. Budget planner, Pacing tab.*

The Budget planner has five tabs: **Pacing**, **Optimizer**, **Forecast**, **Simulators** (Step 13) and **Plans** (Step 14).

**Pacing:**

1. Pick the month with the **←** / **→** arrows on the right.
2. The four cards at the top show the monthly budget, **Spent to date**, **Projected month-end** and the number of overpacing campaigns (projected above 105% of budget).
3. The **Cumulative spend** chart compares actual, projected and ideal cumulative spend with the budget.
4. The **Monthly targets** table: drag the slider or type a monthly budget per campaign, lock the campaigns you don't want changed, and see the recommended daily budget. **Apply recommended daily budgets** applies the recommendations (simulated in demo mode); **Export ▾** exports files.

Until targets are saved for a month that isn't over, a **No targets saved** note above the cards says where the month's budget comes from: each campaign's daily budget × the days in the month. Roles that plan budgets also get a **Use &lt;month&gt; spend** button (for example **Use August spend**). It fills the targets with each active campaign's spend in the last complete month, scaled to this month's days. This is only a draft: check the table, then click **Save targets** or **Discard**. Campaigns that didn't spend that month keep daily budget × days. This helps when daily budgets are set far above what the campaigns really spend (common with Smart Bidding), which makes pacing read low.

Paused campaigns don't inflate the budget: a paused campaign (or a shared budget whose campaigns are all paused) counts only what it already spent this month. Its status is **Paused** (never Underpacing), it has no recommended daily budget and it is listed last. If you save a target for a paused campaign (because you plan to turn it back on), the target is kept and the note says how much of it will go unused.

Viewers see the targets as amounts; only roles that plan budgets can change them.

**Export ▾** files: the **Editor CSV** and the **Change list** are meant to be applied in Google Ads. They leave out paused campaigns that have no saved target, and any $0 budget, and a warning names each campaign left out. The **Detailed CSV** lists every row.

![Budget optimizer](../images/14-toi-uu-ngan-sach.png)

*Figure 14. Optimizer tab: reallocating the same total budget.*

**Optimizer:**

1. Choose a **Strategy:** **Marginal returns** (based on each campaign's marginal returns) or **ROAS heuristic**.
2. Choose an **Objective:** maximize **Conversions** or **Conversion value**.
3. Choose the **Curves:**
   - **Auto (Google where available)**, the default: campaigns with a fresh Google budget simulation are priced with Google's own curve (the campaign's sub-label says *Google simulator*); the others use our model, adjusted to Google's diminishing returns so the split doesn't favour either source (*Our model, matched to Google*);
   - **Our model only:** every campaign uses our curve fitted on its last 60 days.

   A line under the result says which curves priced the split.
4. Set the monthly total and the per-campaign limits (**Min per campaign**, **Max per campaign**, for example 0.5× to 1.6× the current budget).
5. Review the result: the expected uplift and a before/after table per campaign. **AT MAX** / **AT MIN** means the campaign has hit a limit.
6. Under the result table, choose **Edit in Pacing** (keep editing in the Pacing tab), **Save as targets** (save as monthly targets) or **Apply daily budgets** (apply the daily budgets; simulated in demo mode).

The **Rebalance for ROAS** button on the Pacing tab opens the Optimizer tab directly.

![Forecast](../images/15-du-bao.png)

*Figure 15. Forecast tab: a 30-day forecast with an 80% range.*

**Forecast:** choose a campaign (or **All campaigns**) and a metric (**Spend**, **Conversions**, **Value**, **Clicks**). The dashed line is the forecast and the shaded area is the 80% range. The cards below show the expected spend for the rest of the month, the next 30 days, the month-end estimate and the **Backtest error** (the error when re-forecasting the last 14 days). **View as table** shows the numbers. For “what if the budget were X?” questions, the tab points to **Simulators**.

> Google Ads budgets are **daily budgets**. Google may spend up to 2× the daily budget on a single day, but a month never exceeds 30.4× the daily budget. The application converts and warns according to these rules.

## Step 13. Compare with Google's simulators

![Google's simulators](../images/16-mo-phong-google.png)

*Figure 16. Simulators tab: which estimate answers which question, then Google's simulation for each campaign next to our model.*

Google Ads has its own planning tools. **Performance Planner** isn't available through the Google Ads API, so it can't appear here. The **budget and target simulators** and Google's **budget recommendations** are read-only reports, and the application reads them (the official Google Ads MCP server offers the same data through GAQL search).

1. Open **Budget planner → Simulators**.
2. The first card, **Google's simulators and our model**, lists each planning question, which estimate **Leads** and why:

   | Question | Leads | Why |
   |---------------------------|------------------------|------------------------------------------|
   | Will we land on budget this month? | Our pacing projection | It needs this month's actual spend and Google's 2× / 30.4× limits; Google's simulators replay a past week. |
   | What will the next 30 days look like? | Our forecast | Performance Planner isn't in the API. |
   | What if one campaign's daily budget changes? | Google's budget simulator, when available, fresh and in range | It replays the campaign's recent auctions at other budgets (Performance Max too, when Google returns a simulation). |
   | What if a target CPA or target ROAS changes? | Google's target simulator | We don't model bid targets. |
   | How should budget move between campaigns? | Our optimizer, with Google's curves where available | Google simulates one campaign at a time. |
   | What if a shared budget changes? | Our model, for the shared budget as a whole | Google simulates each campaign on a shared budget as if the budget were its own; those campaigns compete for one budget, so their simulations don't add up to it. |

3. **Campaign what-if:** pick a campaign on the left. The chart shows Google's simulated points (per day: each point is the simulation window's total ÷ its days, so it describes the recent past, not a forecast) and our model's curve on one axis, with the current setting marked. Below it are the points table, which estimate leads and why, and a line such as *Google and our model agree within 10%*. Type an amount in **Try a daily budget** to compare both estimates at that budget. Campaigns without a simulation say *No simulations from Google for this campaign*; for Performance Max the tab suggests cross-checking in Performance Planner in Google Ads. For a campaign on a shared budget, Google's points are shown for reference only, because Google simulated the campaign as if the budget were its own. Plan the shared budget as a whole.
4. **Google's budget recommendations:** campaigns that Google thinks are limited by budget, with the recommended budget, the options and Google's weekly impact estimate. **Open in Google Ads ↗** opens the recommendation in Google Ads; in demo mode **Set budget** simulates it.

Google's simulator leads only when its simulation ended at most 14 days before the latest data and covers the budget you ask about (±5%); otherwise our model leads and the reason is shown. Both numbers stay visible either way.

## Step 14. Plan several months

![Budget plans](../images/17-ke-hoach.png)

*Figure 17. Plans tab: a three-month budget plan.*

1. Click **Create a plan** (or **+ New plan**), give it a name and a start month, then click **Create plan**.
2. Each row is a campaign: choose how spend is spread over the month (**Flighting**, for example *Even*) and edit the amount for each month.
3. **Suggest seasonal amounts** proposes seasonal amounts; **Export ▾** exports files; **Apply … budgets** applies the first month's budgets (simulated in demo mode).
4. AI ideas added with **Add to plan** (Step 19) appear in the “plan · from AI ideas” card.

## Step 15. Handle anomalies

![Anomaly signals](../images/18-bat-thuong.png)

*Figure 18. The Anomalies page, Signals tab.*

1. Open **Anomalies** (or press `g` then `4`). Signals are grouped by status (**Open / Acknowledged / Snoozed / Resolved**) and can be filtered by severity (**Critical / Warning / Opportunity**).
2. Each signal card shows the metric and the size of the change (for example *CPA up 94%*), the campaign, the **Observed** value against the **Expected** one, a small chart with the normal range, what the change history says (Step 16), a recommendation, the evidence (z-score, CPC, conversion rate, baseline window) and the related account changes.
3. Handle the signal:
   - **Acknowledge:** mark it as seen and being handled;
   - **Snooze ▾:** hide it for 1 hour, 1 day or 7 days;
   - **Resolve:** close it (it reopens by itself if things get worse);
   - **Add note:** leave a note for teammates;
   - **Explain:** see the causes (Step 17);
   - **Open campaign →:** open the campaign concerned.
4. The **Detection rules** panel on the left quickly adjusts the sensitivity (z-score), the baseline window (7, 14 or 28 days) and the monitored metrics; the signals update live as a preview. **Save as default** stores the change; **Evaluate now** runs detection again immediately.

Viewers can read signals and use **Explain**, but can't acknowledge, snooze, resolve, add notes or save rules.

## Step 16. See what changed before a signal

![A signal explained by the change history](../images/19-boi-canh-thay-doi.png)

*Figure 19. A spend jump that follows the account's own budget raise is marked Expected.*

Google Ads keeps a log of every change made to the account for 30 days. The application reads it and uses it on every signal:

- **Expected:** the shift is the intended effect of a recent change, for example spend up 37% after the daily budget was raised 40%. The card is muted, its severity drops to *Opportunity* level, and the recommendation says to check efficiency over the next week instead of treating it as a problem.
- **Learning period · day 3 of 7:** a bid-strategy or target change is still in Google's learning period. CPA, CPC, conversion rate, ROAS, conversions and CTR signals are capped at *Warning*; spend, pacing, delivery and tracking signals are never softened.
- **Likely cause** / **Possible cause:** a change that often moves this metric happened on or shortly before the start of the shift (a landing-page change before a conversion drop, a new ad before a CTR drop…). The recommendation names the change, its date, the before → after values and the delay.
- **No account changes:** nothing changed in the campaign in the 14 days before the shift (or in the account, for an account-level signal). For most metrics this means the cause is likely external (competitors, seasonality, the market). For a tracking break, the note points at the conversion tag, consent settings or a site release. For a stop in delivery, it points at billing, policy status and the ad schedule. The recommendation lists what to check.

Each related change shows its category, who made it (Google Ads web, Editor, API, a script, an automated rule, auto-applied recommendations…) and **Analyze impact →**, which opens the campaign's **Changes** tab. Only changes made on or before the start of the shift are treated as causes; later ones are shown as context. The settings are on the **Rules** tab (Step 17).

## Step 17. Explain a signal and tune the rules

![Signal explanation](../images/20-giai-thich.png)

*Figure 20. Click Explain to see the causes.*

**Explain** opens an explanation panel with: the observed facts; which metrics moved (CPA = CPC ÷ conversion rate, so it shows whether a higher CPC or a lower conversion rate caused a CPA spike); where it happened by country and device; the change history in the window, with the most likely change highlighted; and the AI's assessment. In demo mode the assessment is rule-based and labelled *DEMO EXPLANATION*. The AI refers to campaigns by their names; if a model writes an internal ID anyway (such as *c8* or a 10-digit campaign ID), the application replaces it with the campaign's name.

![Detection rules](../images/21-quy-tac.png)

*Figure 21. Rules tab: turn each detection method on or off and tune it.*

The **Rules** tab turns each detection method on or off and tunes it: **Z-score deviation** (sensitivity, baseline window, recent window, monitored metrics), **Budget pacing & overdelivery** (overspend and underspend thresholds; a campaign whose ad schedule skips days isn't flagged for overdelivery while its 7-day calendar average stays under the limit, because Google may spend up to 2× the daily budget on the days it runs), **Change history** (how many days before a shift a change still counts, the learning period, whether expected signals are softened and whether learning caps efficiency signals) and the other methods (robust, day-of-week, tracking break, zero delivery, budget-limited). A tracking break is checked per campaign and on the whole account, so a conversion tag that stops firing everywhere shows up as one account-level signal with the campaigns' CPA alerts folded into it. Click **+ New rule** to create your own threshold rule (metric, condition, campaigns) and preview it on the last 30 days before saving. The **History** tab holds the alert delivery log (every send, suppression, deferral and retry; failed sends can be retried) and the lifecycle of acknowledged, snoozed and resolved signals, with their notes.

Each client workspace has its own rules. The **Rules** and **Notifications** tabs are hidden for roles that can't change them.

## Step 18. Set up alerts

![Alert channels](../images/22-thong-bao.png)

*Figure 22. Notifications tab: delivery mode, scheduler, browser notifications, alert channels and routes.*

1. Go to **Anomalies → Notifications**.
2. **Alert channels → + Add channel:** choose Slack, Microsoft Teams (Workflows), Discord or Webhook; enter a name and paste the webhook URL. Optionally add a mention (for example `@here`), a signing secret (for webhooks) and dashboard links. After saving, send a test from the channel card: the result shows **✓ Test delivered** or **× Test failed**.
3. **Routes → + New route:** choose which signals (severity, type, metric, campaign) go to which channel; set **Quiet hours** (*Critical* signals can bypass them), the re-notify interval and whether to send a notice when a signal resolves.
4. **Run alerts now** evaluates and sends immediately; **Digest preview** previews the digest.
5. **Browser notifications → Enable:** shows a desktop notification for new critical signals while the dashboard is open.

Alerts carry the change-history verdict, so a Slack message says, for example, that a spend jump followed a budget raise.

> Saving a webhook URL from the interface requires `APP_ENCRYPTION_KEY` (create one with `npm run gen:key`). Without it, put the URL in `.env`: `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` or `ALERT_WEBHOOK_URL` (plus `ALERT_WEBHOOK_SECRET` for signing). Channels from `.env` belong to the agency workspace only; each client adds its own channels in its workspace.
>
> In demo mode, real alerts are not sent (unless `ALERTS_DEMO_DISPATCH=true`); test sends always work.

To run alerts automatically, set `ALERTS_SCHEDULER_ENABLED=true` in `.env` (interval `ALERTS_INTERVAL_MINUTES`, 5 minutes minimum), or call the endpoint from an external cron. With several clients, also set `ALERTS_ALL_ACCOUNTS=true` so every account is checked in its own client's workspace:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/alerts
```

## Step 19. Use AI studio

![Campaign ideas](../images/23-y-tuong-ai.png)

*Figure 23. Ideas tab: account narrative, form and ideas.*

**Ideas:**

1. Choose a **Goal:** **Scale conversions**, **Lower CPA**, **Launch product** or **Q4 season**.
2. Enter a **Test budget / month** and any **Extra context** (for example “New trail collection launches Oct 15”).
3. Click **Generate ideas**. Each idea has a campaign type, a rationale based on the account's numbers, the expected impact, a daily budget and a confidence score.
4. Click **Add to plan** to add an idea to the budget plan (roles that plan budgets), or dismiss ideas that don't fit. Past generations are kept for later.

![Blueprint](../images/24-blueprint.png)

*Figure 24. Blueprint tab: four steps to a campaign structure.*

**Blueprint:** pick an idea (**Build blueprint →**) or **Start from a blank idea**, then go through 4 steps: **Idea** → **Structure** (ad groups, keywords, negatives) → **Ads** (headlines, descriptions, assets) → **Review** (bidding, targeting, checklist). Finally export a CSV to import into Google Ads Editor; everything is *Paused* so you can review it before it runs.

![Ad copy](../images/25-noi-dung-quang-cao.png)

*Figure 25. Ad copy tab: headlines and descriptions checked against character limits.*

**Ad copy:**

1. Fill in **Product or offer**, **Keywords** and **Selling points**. You can add an **Audience**, a landing page, a campaign to base the copy on real data (**Ground in a campaign**) and a tone (**Confident**, **Friendly**, **Premium**, **Urgent**).
2. Click **Generate ad copy** to get up to 15 headlines (30 characters max) and 4 descriptions (90 characters max). Each line has a character counter and an **✓ OK** status.
3. Edit lines directly, pin positions (**No pin ▾**), lock the lines you like (**LOCK**) and click **Regenerate** to rewrite the rest; **Copy all** copies everything.

![Negative keywords](../images/26-tu-khoa-phu-dinh.png)

*Figure 26. Negative keywords tab: search terms that spend without converting.*

**Negative keywords:** the application scans the last 30 days of search terms and flags terms that spend without converting, get many clicks without converting, or contain irrelevant modifiers (for example “jobs”, “free”). Each row shows the estimated monthly savings and the AI's verdict (**Negative**, **Review** or **Keep**). Brand terms are always protected (**BRAND PROTECTED**). Tick rows to add them as negatives: in demo mode this is simulated; in live mode the application exports a Google Ads Editor file.

> Without an AI key, AI studio uses the **demo engine**: suggestions are rule-based on the account's numbers, and the interface says *Demo suggestions* or *AI unavailable*. See Step 31 to turn on real AI.

## Step 20. Ask questions with Ask AI

![Ask AI](../images/27-hoi-ai.png)

*Figure 27. The Ask your data chat answers with a chart.*

1. Click **Ask AI** in the top bar (or press ⌘J).
2. Pick a suggested question or type your own, for example “Top 5 campaigns by ROAS last 7 days”, “Spend by device this month vs last month” or “Search terms with no conversions last 30 days”.
3. The answer comes with a chart built from a real query on the data: **Show table** shows the numbers, **Open in Explore** opens it for further editing, **Add to dashboard ▾** pins it to a dashboard (roles that edit dashboards).
4. Click the suggested follow-ups (daily trend, by device, against the previous period), or **New chat** to start over.

> Without an AI key, the demo engine understands simple questions about metrics, dimensions and time. With Claude, OpenAI or Gemini configured, you can ask more freely. Ask AI only sees the account you have open.

## Step 21. Build questions in Explore

![Explore](../images/28-explore.png)

*Figure 28. Explore: choose a source and metrics and see the result.*

1. Open **Explore** (or press `g` then `6`), pick a starter question or click **New question**.
2. **01 Data:** choose the source: **Google Ads**, **Blended (all platforms)** or a plugin (Meta Ads, Google Analytics 4…).
3. **02 Metrics:** choose metrics (Spend, ROAS, Conversions…). You can create your own metric with a formula.
4. The next steps: group by up to 3 dimensions, filter, sort, limit the rows and choose a chart type.
5. See the result in the **Chart**, **Table** or **Spec** tab. **Save question** saves it (saved questions appear in the *Saved* category of the widget gallery); **Add to dashboard** adds it to a dashboard. The page address always contains the current question, so you can send the link to someone else.

## Step 22. View cross-channel reporting

![Channels](../images/29-kenh.png)

*Figure 29. The Channels page: Google Ads and Meta Ads on one ledger.*

The **Channels** page adds up spend across Google Ads and the connected ad platforms: **Total ad spend**, **Blended ROAS**, **MER** (needs a store revenue source such as Shopify or WooCommerce), total conversions, **Blended CPA**, share of spend and daily spend per platform. The **ATTRIBUTION** banner is a reminder that each platform attributes conversions with its own window, so totals can double count. Analytics and commerce sources (GA4, Shopify…) are shown alongside and are never added to ad spend.

## Step 23. Connect plugins

![Plugins](../images/30-plugins.png)

*Figure 30. The plugin gallery.*

1. Open **Plugins** (agency roles only), filter by category (**Ad platforms**, **Analytics**, **Commerce**, **Export**, **Alerts**, **Connected**) or search by name.
2. Click **Connect →** on a plugin card, fill in the configuration and save. Connected plugins have **Configure**, **Test**, **Sync** and **Disconnect** buttons.
3. Connected ad platforms appear on the Channels page, in the Cross-channel widget and in Explore; alert plugins receive critical signals.

> In this version the built-in connectors (Meta, Microsoft, TikTok…) run on demo data and are labelled *DEMO*. To get live data from another platform, build a REST plugin as described below. Plugins are managed by the agency because they can use the deployment's `PLUGIN_*` keys.

![REST plugin](../images/31-plugin-rest.png)

*Figure 31. The REST plugin builder: previewing the mapped rows.*

**Build a REST plugin (no code):**

1. Click **Build a custom plugin**. You can start from the **Klaviyo-style (mock)** preset, a blank one (**Blank**) or **Import JSON**.
2. **01 Basics:** the plugin's name, category and description.
3. **02 Endpoint:** the API address (HTTPS), the authentication type (API key, bearer, basic), the report path with the `{start}` and `{end}` date variables, and pagination.
4. **03 Mapping:** the path to the data array (for example `data.rows`) and how each field maps (date, campaign, spend, impressions, clicks, conversions, value…).
5. **04 Preview & save:** **Validate** checks the configuration; **Test & preview rows** calls the API for the last 7 days and shows the mapped rows; **Save & connect** saves and connects the plugin. The JSON manifest on the right has **Copy** and **Download** buttons.

> An API key typed in the interface is only stored when `APP_ENCRYPTION_KEY` is set (`npm run gen:key`). Otherwise declare the key in `.env` as a `PLUGIN_*` variable (for example `PLUGIN_KLAVIYO_KEY`) and choose **Use PLUGIN_… and save**.
>
> Developers can write code plugins: `npm run plugin:new -- my-plugin --category ad_platform`.

## Step 24. See every client on one page

![The Clients page](../images/32-khach-hang.png)

*Figure 32. The Clients page: every account side by side, grouped by client.*

1. Open **Clients** (or press `g` then `0`).
2. The cards at the top add up every account you can open: **Spend**, **Conversions**, **Blended CPA** and **Blended ROAS** against the comparison period, **Needs attention** (accounts with a critical signal) and **Overpacing** (accounts projected above 105% of their budget). Amounts in other currencies are converted with the display currency's rates (Step 30).
3. Below, one card per client lists its accounts with spend, conversions, CPA and ROAS (with their changes), **Month pacing** and **Open signals**. Click **Open →** to switch to that account.
4. The page follows the date range and comparison period of the top bar. **Manage clients →** opens the client list (Step 26).

SAVD staff see every client; a client's users see only their own organization here.

## Step 25. Invite people and choose their role

![Inviting someone](../images/33-nguoi-dung.png)

*Figure 33. Access page: inviting a client viewer for Trail Gear Outlet.*

1. Open **Access** (agency admins and client admins).
2. Click **Invite someone**, enter the **Name** and **Email**, choose the **Role** and, for a client role, the **Client**, then click **Create invite link**.
3. Copy the link and send it to the person yourself (the dashboard doesn't send email). The link works once and expires after 72 hours. The person opens it, chooses a password and is signed in.
4. The **People** table shows each person's role, client, status (**Invited**, **Active**, **Disabled**), whether two-factor authentication is on and their last sign-in. The **⋯** menu next to a person offers **Edit role or name**, **Copy a new invite link** or **Create a password reset link**, **Reset two-factor authentication**, **Disable (signs them out)** / **Enable** and **Remove**.

The four roles:

| Role | Sees | Can |
|------------------|---------------------------|----------------------------------------------------------------|
| **Agency admin** | Every client and account | Everything: users, clients, data source, plugins, settings |
| **Agency member** | Every client and account | Edit dashboards, rules, alerts, budget plans and plugins; simulated actions; AI; not users or clients |
| **Client admin** | Their client's accounts | Edit their dashboards, rules, alerts and plans; simulated actions; AI; their workspace's display preferences; invite their own team |
| **Client viewer** | Their client's accounts | Read everything and use Ask AI and AI studio; no changes |

Client admins can only invite people into their own client. The last active agency admin can't be removed, disabled or demoted, and nobody can change their own role. Changing someone's role or client, disabling them, resetting their two-factor authentication or setting a new password from a reset link signs them out everywhere.

## Step 26. Manage clients and their accounts

![Managing clients](../images/34-quan-ly-khach-hang.png)

*Figure 34. Access → Clients: each client with its Google Ads accounts.*

A **client** is an organization SAVD works for. It owns one or more Google Ads accounts that SAVD's credentials can reach (through the manager account). Each account belongs to one client at a time.

1. Open **Access → Clients** (agency admins).
2. Click **New client**, enter the **Client name**, tick its **Google Ads accounts** and choose **Start the workspace from**: **Default templates** (standard dashboards and detection rules) or **Copy of the agency workspace** (the agency's dashboards, saved questions, custom metrics and detection rules). Click **Create client**.
3. **Edit** renames a client, changes its accounts or notes. Moving an account moves its saved data with it: signal history, budget targets, plans, AI idea sets, simulated actions and notes.
4. **Delete** is possible once the client has no users. Its accounts go back to the agency, and the workspace's files stay on disk under `data/workspaces/`.

The **Not assigned to a client** card lists accounts that only agency roles can see.

## Step 27. Your account and two-factor authentication

![Account and security](../images/35-bao-mat.png)

*Figure 35. Account & security: profile, two-factor authentication, password and signed-in devices.*

Open it from the user menu (**Account & security**):

- **Profile:** your name and email, your role and organization.
- **Two-factor authentication:**
  1. Click **Set up two-factor authentication**.
  2. In your authenticator app (Google Authenticator, 1Password, Authy…) choose **Add account → Enter a setup key** and paste the key, or open the link on your phone.
  3. Type the **6-digit code** from the app and click **Turn on**.
  4. Save the recovery codes shown once (**Copy codes**): each code signs you in once if you lose your phone.

  To turn it off, enter your password and click **Turn off**. When the administrator requires two-factor authentication (`AUTH_REQUIRE_2FA`), the dashboard asks you to set it up before anything else.
- **Password:** enter the current password and the new one twice (at least 10 characters), then **Change password**. This signs you out on every other device.
- **Signed-in devices:** each browser where you're signed in, with its last activity; **Sign out** ends that session.

## Step 28. Connect live Google Ads

![Data source](../images/36-nguon-du-lieu.png)

*Figure 36. The Data source page: connection status and missing keys.*

1. Gather the 4 required values:

   | Key | Where to get it |
   |------------------------------|------------------------------------------------------------|
   | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` | Google Cloud Console → in the project where the Google Ads API is enabled, create an **OAuth client** (Desktop or Web) |
   | `GOOGLE_ADS_REFRESH_TOKEN` | OAuth consent for the `https://www.googleapis.com/auth/adwords` scope. If the OAuth app is in *Testing*, refresh tokens expire after 7 days, so switch it to *In production* |
   | `GOOGLE_ADS_CUSTOMER_ID` | The client account to open by default, for example `482-119-3307` |

   If you access the accounts through a manager account (MCC), also set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the manager's ID. The account menu then lists every client account, and you can assign them to clients (Step 26).

   **Access level.** Google sunset developer tokens on 9 September 2026. The API access level (*Test*, *Explorer*, *Basic* or *Standard*) now belongs to the Google Cloud project that owns the OAuth client. Enabling the Google Ads API gives the project *Test* access, which only reaches test accounts. To read real accounts, open the **Google Ads API Overview** page in Google Cloud Console (console.cloud.google.com/google/ads-apis/overview), expand **Upgrade access level** and request at least *Explorer* (2,880 operations a day on real accounts). For many accounts, request *Basic* (15,000 a day), which first needs brand verification of the project. `GOOGLE_ADS_DEVELOPER_TOKEN` is no longer needed: if your `.env` still has one, the app sends it, but Google ignores it.

2. Copy the example file and fill in the values in `.env` (the Data source page also shows the contents of `.env.example` with a **Copy** button):

   ```bash
   cp .env.example .env
   ```

   To fill in the three OAuth keys without copying secrets by hand, create an OAuth client of type **Desktop app** in Google Cloud Console (**Google Auth Platform → Clients → Create client**), click **Download JSON**, then run the command below. It finds the newest `client_secret_*.json` in `~/Downloads` (or pass `-- --client-file <path>`), opens Google's consent page, and after you click **Allow** writes `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` and `GOOGLE_ADS_REFRESH_TOKEN` into `.env`, printing only the last 4 characters. Delete the downloaded JSON afterwards.

   ```bash
   npm run google-ads:auth
   ```

3. Check the connection from the terminal (the output masks the keys):

   ```bash
   npm run check:google-ads
   ```

4. Restart the application (`npm run dev` or `npm start`). The DEMO DATA banner disappears and the sidebar card switches to **Live**. On the Data source page, **Test connection** checks the connection again and **Refresh data** loads the latest data; the **Go-live checklist** shows which steps are done. The **Activity log** tab lists simulated actions (which can be reverted) and the activity log, including sign-ins and user changes. Then open the **Warehouse** tab and click **Sync all accounts** to start keeping history (Step 29).
5. The demo clients created at setup point to the demo accounts: delete them (Step 26) and create your real clients.

> `.env` is only read on the server and is never sent to the browser; the Data source page (agency roles only) only shows which keys are set and their last few characters. Don't commit `.env` to git (it is already in `.gitignore`).

> In live mode the application is still **read-only**: buttons that would change something (pause, change budgets, apply a plan, add negatives, set a recommended budget) don't modify the account; they offer **Open in Google Ads ↗**, a change list to copy, or a Google Ads Editor CSV. Google's simulations and recommendations are read with the same read-only access.

## Step 29. Keep long-term data in the warehouse

![The analytics warehouse](../images/37-kho-du-lieu.png)

*Figure 37. Data source → Warehouse: the SQLite file, what is stored for the active account, monthly totals and recent syncs.*

The application keeps the Google Ads data it reads in a local SQLite database, the *warehouse*. History therefore outlives Google's own limits (30 days of change history, 92 days of hourly data, 12 months of search terms, 37 months of daily data), and days whose numbers can no longer change are read locally instead of asking Google again. Nothing changes in how you use the dashboard: every page reads through the warehouse automatically. The tables and rules are described in [Analytics warehouse: database design](DATABASE-DESIGN.md).

1. Open **Data source → Warehouse** (agency roles).
2. The first card shows whether the warehouse is **On**, whether it holds **Live data** or **Demo data**, the file (`data/warehouse/live.sqlite` by default; demo data goes to a separate `demo.sqlite`), its size, the schema version and how many accounts it holds. The line below lists the settings in effect.
3. Click **Sync this account** or **Sync all accounts** to fill the warehouse now. The sync runs in the background, newest data first, within a budget of Google Ads API requests (250 by default), and the page refreshes while it runs. A *Partial* sync ran out of budget; the next one continues where it stopped.
4. **Stored for &lt;account&gt;** lists each table: rows, first and last stored day, how many days are stored, how many of them are older than what Google still serves (**Beyond Google**), and when they were last fetched. The tiles above count campaigns (with their settings history), change events and snapshots of Google's estimates.
5. **Spend by month** charts the monthly totals read straight from the warehouse; **View as table** shows spend, clicks, conversions and ROAS per month.
6. **Recent syncs** lists each run: when it started, how (Sync now, timer, cron or command line), its status, accounts, API requests, rows written and any notes.

To sync automatically, set `WAREHOUSE_SYNC_ENABLED=true` (every 6 hours by default), or have a scheduler call `POST /api/cron/warehouse` with `Authorization: Bearer <CRON_SECRET>`. From the terminal:

```bash
npm run warehouse -- sync
npm run warehouse -- status
npm run warehouse -- backup ./backups/warehouse-live.sqlite
```

> The warehouse needs Node.js 22.13 or later, where SQLite is built in. On an older Node.js the tab says the warehouse is unavailable, and the dashboard works as before. Like the rest of the application it only reads from Google Ads. `WAREHOUSE_ENABLED=false` turns it off.

## Step 30. Display preferences

![Display preferences](../images/38-tuy-chon.png)

*Figure 38. The Display preferences section on the Data source page.*

The **Display preferences** section is stored on the server for the current workspace and applies to everyone in it. Agency roles find it at the bottom of **Data source**; client admins find it on the **Access** page.

- **Display currency** and **FX rate:** show money in another currency (for example VND), with the rate per 1 USD;
- **Auto-refresh:** how often monitoring views refresh their data;
- **Business context:** a short description of the business (what it sells, where, and when it peaks) so AI suggestions fit better;
- **Brand terms** and **Competitor terms:** used to split brand from non-brand queries and to protect brand terms in negative-keyword suggestions;
- **Goals:** monthly conversion and revenue goals, target CPA and target ROAS; used by the goal-tracker widget and alert rules.

Click **Save preferences** to save.

## Step 31. Turn on real AI

Add **one** of these keys to `.env` and restart the application:

| Provider | Key | Default model (change with `*_MODEL`) |
|------------------|---------------------|------------------------|
| Anthropic Claude | `ANTHROPIC_API_KEY` | `claude-opus-5-5` |
| OpenAI | `OPENAI_API_KEY` | `gpt-6-sol` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-3.8-flash` |

With `AI_PROVIDER=auto` (the default), the application uses the first provider that has a key.

**Gemini as the AI for every feature.** Create an API key in Google AI Studio (**Get API key**) and add these lines to `.env`:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-3.8-flash
```

`gemini-3.8-flash` is Google's stable and most capable Flash model, and it supports the thinking levels the application uses: *medium* for campaign ideas, blueprints and signal explanations, *low* for chat, ad copy, the narrative and negative keywords (`AI_EFFORT` overrides them all). `gemini-flash-latest` always points to the newest Flash model; `gemini-3.1-pro-preview` reasons more deeply but is a preview model with lower rate limits and no free tier.

**Gemini on the free tier.** The Gemini API is free for an AI Studio project that has no billing:

- Create the key in a project **without billing** (AI Studio → **Get API key** → create the key in a new project). Once a project is linked to billing it is on a paid tier: when its prepaid credit runs out, every call fails with HTTP 402, and the project does not go back to the free tier by itself. Unlink the billing account from that project, or use a key from another project.
- Free quotas are counted per project and per model, and the daily quotas reset at midnight Pacific time. At the time of writing, `gemini-3.8-flash` allows about 20 requests a day and the Flash-Lite models several hundred; Pro models have no free tier. Your project's current limits are under **Rate limit** in AI Studio.
- When `gemini-3.8-flash` is out of quota or overloaded, the application asks the fallback model `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`) and labels the answer *Answered by fallback model …*. The main model is skipped until its quota comes back. `GEMINI_FALLBACK_MODEL=none` turns this off. The **AI** card on **Data source** shows the fallback model.
- An Ask AI question takes two requests (the plan and the answer). Campaign ideas, a blueprint or a signal explanation take one each, and results are cached for an hour. Lower `AI_DAILY_REQUEST_LIMIT` if you want the application to stop before Google does.
- On the free tier, Google may use prompts and answers to improve its products, and human reviewers may read them. The AI receives aggregated data of the open account, including campaign names. Use the free tier with demo data or accounts whose owners agree, and a paid project for client accounts.

**Gemini with billing (Tier 1 and up).** A key from a project that has billing has no free-tier daily caps, and Google doesn't use its prompts and answers to improve its products: use it for client accounts. Keep `GEMINI_MODEL=gemini-3.8-flash`; the fallback model still steps in when 3.8 Flash is overloaded.

Check the connection quickly with the command below. It also checks the fallback model, and takes three requests from the day's quota.

```bash
npm run ai:smoke
```

The AI only receives aggregated account data and has no write access; every number in an answer is computed by the server. Every number in the AI's account summary is checked against your data. Numbers that are part of a name (an ad called *Fall drop 15s*) or that come from the facts the AI was given (*no changes in the 14 days before the shift*) count as matched. A number that matches nothing is listed in a warning, and when more than one number in five can't be matched, the rule-based summary is shown instead. If an AI call fails, the application falls back to the demo engine and says why.

## Step 32. Keyboard shortcuts and command palette

![Command palette](../images/39-bang-lenh.png)

*Figure 39. The ⌘K command palette.*

| Key | Action |
|--------------------|------------------------------------------------------------|
| ⌘K (Ctrl+K) | Command palette: find pages, dashboards, campaigns, signals, actions, or ask AI |
| ⌘J (Ctrl+J) | Open Ask AI |
| `g` then `1`…`9`, `0` | Go to page 01 to 09, or 10 (Clients) with `0` |
| `e` | Customize the current dashboard |
| `r` | Refresh data |
| `t` | Toggle light / dark theme |
| `?` | Show the shortcut list |
| Esc | Close the open overlay, clear cross-filters |

Shortcuts don't fire while the cursor is in an input field, and the palette only lists pages your role can open.

## Step 33. Dark theme and TV mode

![Dark theme](../images/40-giao-dien-toi.png)

*Figure 40. The dark theme.*

Click the switch in the top bar (or press `t`) to toggle between the light theme (default) and the dark theme. Your choice is remembered.

![TV mode](../images/41-che-do-tv.png)

*Figure 41. TV mode: the dashboard full screen, without the sidebar.*

- **TV mode** (in the dashboard's **⋯** menu) opens the dashboard full screen for a large display: it has a clock, refreshes the data automatically and keeps the screen awake. Add `?rotate=1&seconds=60` to the address to rotate through the dashboards every 60 seconds. Click **Exit TV ×** to leave. The TV screen needs a signed-in browser.
- **Print / PDF** prints the dashboard or saves it as a PDF with a paper-friendly layout.

## Step 34. Use it on a phone

![Phone screens](../images/42-dien-thoai.png)

*Figure 42. On a phone: the Overview, the navigation menu, and the campaign table with the campaign column kept in place.*

The dashboard works in the phone's browser, with nothing to install: open the same address and sign in as usual.

- **Pages:** tap **☰** at the top left to open the menu with every page. The light / dark switch is at the bottom of the menu.
- **Date range:** **7D / 30D / 90D** and **More ▾** sit on the second row of the top bar.
- **Dashboards** show one widget per row. **Customize dashboard** works with each widget's **← →** buttons; dragging and widget widths are for wide screens.
- **Tables** scroll sideways inside their card. In **Campaigns** the campaign column stays in place while the numbers scroll.
- **The answer comes first:** **Anomalies** lists the signals before the detection rules, and **Explore** shows the result before the steps that build it.
- **Ask AI**, campaign details and other side panels open full screen; close them with **×**.
- Tabs that don't fit on one line scroll sideways.

## Troubleshooting

| Banner or symptom | What to do |
|------------------------------|----------------------------------------------------------------|
| Every page opens **Create the first admin** | Nobody has an account yet: use the setup code from the server log or `AUTH_SETUP_TOKEN` (Step 2). |
| *That setup code is not correct* | The code changes when the server restarts without `AUTH_SETUP_TOKEN`; copy the latest one from the log, or set `AUTH_SETUP_TOKEN`. |
| *Email or password is incorrect* / the account is locked | Check the email; after 5 failures wait 15 minutes, or ask an admin for a password reset link (Step 25). |
| Lost the phone with the authenticator app | Sign in with a recovery code, or ask an admin to **Reset two-factor authentication**. |
| *Not for your role* | Your role can't open that page; ask an admin of your organization or your SAVD contact. |
| *You don't have access to that Google Ads account* | The account belongs to another client, or isn't assigned to yours yet (Step 26). |
| *No Google Ads account is assigned to your organization yet* | An agency admin must assign an account to your client (Step 26). |
| *No Google Ads credentials found in .env* | Create `.env` from `.env.example` and fill in all 4 keys (Step 28). |
| *.env is missing N of 4 required keys* | Add the listed keys. |
| *Credentials were rejected* (`AUTH_REFRESH_TOKEN_INVALID`) | Generate a new refresh token. If the OAuth consent screen is *External* and still in *Testing*, publish it (*In production*) so tokens stop expiring after 7 days (*Internal* apps don't have this limit). |
| `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` (older responses: `DEVELOPER_TOKEN_NOT_APPROVED`) | The Google Cloud project that owns your OAuth client only has *Test* access, which reaches test accounts only. Upgrade it to *Explorer* or higher on the Google Ads API Overview page in Google Cloud Console (Step 28). |
| `USER_PERMISSION_DENIED` | Set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the manager account (MCC) linked to the client account. |
| `REQUESTED_METRICS_FOR_MANAGER` | `GOOGLE_ADS_CUSTOMER_ID` is a manager account; use a client account ID. |
| Pacing reads very low on a live account (for example 35% of budget) | The month's budget defaults to daily budget × days. If daily budgets are set well above what the campaigns spend (common with Smart Bidding targets), pacing reads low. Click **Use &lt;month&gt; spend** on the Pacing tab (or type the targets), check them, then **Save targets** (Step 12). |
| Simulators says *Google's simulators and recommendations are unavailable right now* | The Google read failed (quota, permissions); every estimate falls back to our model. Try again later. |
| Warehouse tab: *SQLite is built into Node.js 22.13 and later* | Upgrade Node.js (22 LTS or 24). Until then the dashboard works without the warehouse (Step 29). |
| A warehouse sync shows *Partial* | The sync used its request budget (`WAREHOUSE_SYNC_MAX_REQUESTS`) or one table failed; the **Note** column says which. The next sync continues where it stopped. |
| AI shows *Demo suggestions* or *AI unavailable* | There is no AI key or the AI call failed: see Step 31 and run `npm run ai:smoke`. |
| AI says *Gemini refused the request: the API project has no credit left (HTTP 402)* | The key belongs to a billed AI Studio project whose prepaid credit is used up. Top it up, or use a key from a project without billing (free tier): see Step 31. |
| AI says *Gemini's daily quota for this model is used up* | The free-tier quota of the day is gone; it resets at midnight Pacific time. Until then the fallback model answers (Step 31), or the demo engine when there is none. |
| Webhook URLs or plugin keys can't be saved | Set `APP_ENCRYPTION_KEY` (`npm run gen:key`), or put the values in `.env`. |
| Dashboards are gone after a restart | Check that `./data` (or `DATA_DIR`) is writable; the Data source page says whether data is stored in files or in memory. |

## Appendix: updating the documents

The screenshots are generated automatically with Playwright, in demo mode with a temporary data folder and a throwaway admin account:

```bash
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run docs:screenshots
```

Diagrams are Mermaid sources (`DATABASE-DIAGRAM.mmd` at the repository root, `docs/images/*DIAGRAM*.mmd`). Render them to PNG after changing them:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run docs:diagrams
```

After editing the Markdown files, rebuild the Word versions (requires [pandoc](https://pandoc.org)). Images and diagrams are embedded and fitted to the page width; a ` ```mermaid ` block in a document is rendered to an image first:

```bash
npm run docs:docx
```
