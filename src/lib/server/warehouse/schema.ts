import "server-only";
import { transaction, type Db } from "./sqlite";
export interface Migration {
    version: number;
    name: string;
    sql: string;
}
const 懇壍 = `
  impressions     INTEGER NOT NULL,
  clicks          INTEGER NOT NULL,
  cost            REAL    NOT NULL,
  conversions     REAL    NOT NULL,
  conv_value      REAL    NOT NULL`;
const 肶壍 = "REFERENCES dim_account (account_id) ON DELETE CASCADE";
const 龥壍 = (沔壍 = "") => `
  SUM(${沔壍}clicks) * 1.0 / NULLIF(SUM(${沔壍}impressions), 0) AS ctr,
  SUM(${沔壍}cost) / NULLIF(SUM(${沔壍}clicks), 0)               AS cpc,
  SUM(${沔壍}cost) / NULLIF(SUM(${沔壍}conversions), 0)          AS cpa,
  SUM(${沔壍}conv_value) / NULLIF(SUM(${沔壍}cost), 0)           AS roas`;
export const MIGRATIONS: readonly Migration[] = [
    {
        version: 1,
        name: "Initial warehouse: dimensions, facts, change events, Google's estimates, sync ledger",
        sql: `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

-- ── Dimensions ───────────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim_account (
  account_id     TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  currency       TEXT NOT NULL,
  time_zone      TEXT NOT NULL,
  manager_id     TEXT,
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL
) STRICT;

CREATE TABLE dim_campaign (
  account_id        TEXT    NOT NULL ${肶壍},
  campaign_id       TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  type              TEXT    NOT NULL,
  status            TEXT    NOT NULL,
  bidding_strategy  TEXT    NOT NULL,
  target_cpa        REAL,
  target_roas       REAL,
  budget_id         TEXT,
  budget_daily      REAL,
  budget_shared     INTEGER NOT NULL DEFAULT 0,
  budget_period     TEXT    NOT NULL DEFAULT 'daily',
  start_date        TEXT,
  end_date          TEXT,
  first_seen_at     TEXT    NOT NULL,
  last_seen_at      TEXT    NOT NULL,
  PRIMARY KEY (account_id, campaign_id)
) STRICT, WITHOUT ROWID;

-- Type-2 history of the settings that explain spend; valid_to is NULL for the current version.
CREATE TABLE dim_campaign_history (
  account_id        TEXT    NOT NULL,
  campaign_id       TEXT    NOT NULL,
  valid_from        TEXT    NOT NULL,
  valid_to          TEXT,
  status            TEXT    NOT NULL,
  bidding_strategy  TEXT    NOT NULL,
  target_cpa        REAL,
  target_roas       REAL,
  budget_id         TEXT,
  budget_daily      REAL,
  budget_shared     INTEGER NOT NULL,
  budget_period     TEXT    NOT NULL,
  PRIMARY KEY (account_id, campaign_id, valid_from),
  FOREIGN KEY (account_id, campaign_id) REFERENCES dim_campaign (account_id, campaign_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE TABLE dim_ad_group (
  account_id     TEXT NOT NULL ${肶壍},
  ad_group_id    TEXT NOT NULL,
  campaign_id    TEXT NOT NULL,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL,
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  PRIMARY KEY (account_id, ad_group_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE dim_keyword (
  account_id     TEXT    NOT NULL ${肶壍},
  keyword_id     TEXT    NOT NULL,
  ad_group_id    TEXT    NOT NULL,
  campaign_id    TEXT    NOT NULL,
  text           TEXT    NOT NULL,
  match_type     TEXT    NOT NULL,
  status         TEXT    NOT NULL,
  quality_score  REAL,
  qs_ctr         TEXT,
  qs_relevance   TEXT,
  qs_landing     TEXT,
  cpc_bid        REAL,
  first_seen_at  TEXT    NOT NULL,
  last_seen_at   TEXT    NOT NULL,
  PRIMARY KEY (account_id, keyword_id)
) STRICT, WITHOUT ROWID;

-- ── Facts (one row per account × day × key; children sum to fact_campaign_daily) ─────────────────
CREATE TABLE fact_campaign_daily (
  account_id      TEXT NOT NULL ${肶壍},
  date            TEXT NOT NULL,
  campaign_id     TEXT NOT NULL,${懇壍},
  is_search_impr  REAL,
  is_eligible     REAL,
  is_lost_budget  REAL,
  is_lost_rank    REAL,
  PRIMARY KEY (account_id, date, campaign_id)
) WITHOUT ROWID;
CREATE INDEX fact_campaign_daily_by_campaign ON fact_campaign_daily (account_id, campaign_id, date);

CREATE TABLE fact_campaign_device_daily (
  account_id   TEXT NOT NULL ${肶壍},
  date         TEXT NOT NULL,
  campaign_id  TEXT NOT NULL,
  device       TEXT NOT NULL,${懇壍},
  PRIMARY KEY (account_id, date, campaign_id, device)
) WITHOUT ROWID;

CREATE TABLE fact_campaign_geo_daily (
  account_id   TEXT NOT NULL ${肶壍},
  date         TEXT NOT NULL,
  campaign_id  TEXT NOT NULL,
  country      TEXT NOT NULL,${懇壍},
  PRIMARY KEY (account_id, date, campaign_id, country)
) WITHOUT ROWID;

CREATE TABLE fact_campaign_hourly (
  account_id   TEXT    NOT NULL ${肶壍},
  date         TEXT    NOT NULL,
  campaign_id  TEXT    NOT NULL,
  hour         INTEGER NOT NULL,${懇壍},
  PRIMARY KEY (account_id, date, campaign_id, hour)
) WITHOUT ROWID;

CREATE TABLE fact_ad_group_daily (
  account_id   TEXT NOT NULL ${肶壍},
  date         TEXT NOT NULL,
  campaign_id  TEXT NOT NULL,
  ad_group_id  TEXT NOT NULL,${懇壍},
  PRIMARY KEY (account_id, date, campaign_id, ad_group_id)
) WITHOUT ROWID;

CREATE TABLE fact_keyword_daily (
  account_id   TEXT NOT NULL ${肶壍},
  date         TEXT NOT NULL,
  campaign_id  TEXT NOT NULL,
  ad_group_id  TEXT NOT NULL,
  keyword_id   TEXT NOT NULL,${懇壍},
  qs_weight    REAL NOT NULL,
  qs_impr      REAL NOT NULL,
  PRIMARY KEY (account_id, date, campaign_id, ad_group_id, keyword_id)
) WITHOUT ROWID;

-- Search terms are range-grain in Google Ads (totals for a period): the warehouse keeps one row per term and month.
CREATE TABLE fact_search_term_monthly (
  account_id     TEXT NOT NULL ${肶壍},
  month          TEXT NOT NULL,
  campaign_id    TEXT NOT NULL,
  ad_group_id    TEXT NOT NULL,
  search_term    TEXT NOT NULL,
  st_match_type  TEXT NOT NULL,
  st_status      TEXT NOT NULL,
  keyword_id     TEXT,${懇壍},
  PRIMARY KEY (account_id, month, campaign_id, ad_group_id, search_term, st_match_type)
) WITHOUT ROWID;

-- ── Change history (Google keeps 30 days; the warehouse keeps every event it has seen) ───────────
CREATE TABLE change_event (
  account_id      TEXT NOT NULL ${肶壍},
  event_id        TEXT NOT NULL,
  ts              TEXT NOT NULL,
  date            TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  operation       TEXT NOT NULL,
  campaign_id     TEXT,
  ad_group_id     TEXT,
  changed_fields  TEXT NOT NULL,
  diffs           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  client_type     TEXT,
  actor           TEXT,
  stored_at       TEXT NOT NULL,
  PRIMARY KEY (account_id, event_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX change_event_by_date ON change_event (account_id, date);

-- ── Google's estimates, kept as snapshots so they can later be compared with what happened ───────
CREATE TABLE google_simulation (
  account_id     TEXT    NOT NULL ${肶壍},
  campaign_id    TEXT    NOT NULL,
  type           TEXT    NOT NULL,
  modification   TEXT    NOT NULL,
  start_date     TEXT    NOT NULL,
  end_date       TEXT    NOT NULL,
  relative       INTEGER NOT NULL DEFAULT 0,
  points         TEXT    NOT NULL,
  first_seen_at  TEXT    NOT NULL,
  last_seen_at   TEXT    NOT NULL,
  PRIMARY KEY (account_id, campaign_id, type, modification, start_date, end_date)
) STRICT, WITHOUT ROWID;

CREATE TABLE google_recommendation (
  account_id          TEXT    NOT NULL ${肶壍},
  recommendation_id   TEXT    NOT NULL,
  captured_on         TEXT    NOT NULL,
  type                TEXT    NOT NULL,
  campaign_id         TEXT,
  campaign_ids        TEXT    NOT NULL,
  budget_id           TEXT,
  current_budget      REAL,
  recommended_budget  REAL,
  dismissed           INTEGER NOT NULL,
  impact              TEXT,
  options             TEXT    NOT NULL,
  captured_at         TEXT    NOT NULL,
  PRIMARY KEY (account_id, recommendation_id, captured_on)
) STRICT, WITHOUT ROWID;

-- ── Sync bookkeeping ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE sync_run (
  run_id            TEXT    PRIMARY KEY,
  mode              TEXT    NOT NULL,
  trigger           TEXT    NOT NULL,
  scope             TEXT    NOT NULL,
  started_at        TEXT    NOT NULL,
  finished_at       TEXT,
  status            TEXT    NOT NULL,
  accounts          INTEGER NOT NULL DEFAULT 0,
  requests          INTEGER NOT NULL DEFAULT 0,
  rows_written      INTEGER NOT NULL DEFAULT 0,
  budget_exhausted  INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  details           TEXT
) STRICT;
CREATE INDEX sync_run_by_start ON sync_run (started_at);

-- One row per account × table × stored day (search terms: × month). settled = fetched after the restatement window.
CREATE TABLE sync_ledger (
  account_id    TEXT    NOT NULL ${肶壍},
  table_id      TEXT    NOT NULL,
  period_start  TEXT    NOT NULL,
  period_end    TEXT    NOT NULL,
  row_count     INTEGER NOT NULL,
  fetched_at    TEXT    NOT NULL,
  settled       INTEGER NOT NULL,
  run_id        TEXT,
  PRIMARY KEY (account_id, table_id, period_start)
) STRICT, WITHOUT ROWID;

-- ── Analytics views (derived metrics as ratios of sums, NULL on division by zero) ────────────────
CREATE VIEW v_account_monthly AS
SELECT account_id, substr(date, 1, 7) AS month,
  SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(cost) AS cost,
  SUM(conversions) AS conversions, SUM(conv_value) AS conv_value,${龥壍()}
FROM fact_campaign_daily
GROUP BY account_id, substr(date, 1, 7);

CREATE VIEW v_campaign_monthly AS
SELECT f.account_id, substr(f.date, 1, 7) AS month, f.campaign_id, c.name AS campaign_name, c.type AS campaign_type,
  SUM(f.impressions) AS impressions, SUM(f.clicks) AS clicks, SUM(f.cost) AS cost,
  SUM(f.conversions) AS conversions, SUM(f.conv_value) AS conv_value,${龥壍("f.")}
FROM fact_campaign_daily f
LEFT JOIN dim_campaign c ON c.account_id = f.account_id AND c.campaign_id = f.campaign_id
GROUP BY f.account_id, substr(f.date, 1, 7), f.campaign_id;
`,
    },
];
export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
export function migrate(讃壍: Db, 塲壍: string): number[] {
    讃壍.exec("CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT");
    const 睡壍 = new Set((讃壍.prepare("SELECT version FROM schema_migration").all() as {
        version: number;
    }[]).map((限壍) => 限壍.version));
    const 挿壍: number[] = [];
    for (const 舮壍 of MIGRATIONS) {
        if (睡壍.has(舮壍.version))
            continue;
        transaction(讃壍, () => {
            讃壍.exec(舮壍.sql);
            讃壍.prepare("INSERT INTO schema_migration (version, name, applied_at) VALUES (?, ?, ?)").run(舮壍.version, 舮壍.name, 塲壍);
        });
        挿壍.push(舮壍.version);
    }
    return 挿壍;
}
export function schemaVersion(伝壍: Db): number {
    const 渌壍 = 伝壍.prepare("SELECT MAX(version) AS v FROM schema_migration").get() as {
        v: number | null;
    } | undefined;
    return 渌壍?.v ?? 0;
}
