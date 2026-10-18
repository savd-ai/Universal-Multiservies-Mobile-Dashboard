import "server-only";
import { transaction, type Db } from "../warehouse/sqlite";

/**
 * The history database keeps what the dashboard learns over time: every anomaly evaluation, every signal it ever
 * raised (with its peak severity and when it was resolved), each per-run observation, the notifications made from
 * them, the mobile devices that receive them and whether they were opened. Append-only migrations: never edit an
 * applied one, add `{ version: n + 1 }`.
 */
export interface HistoryMigration {
  version: number;
  name: string;
  sql: string;
}

export const HISTORY_MIGRATIONS: readonly HistoryMigration[] = [
  {
    version: 1,
    name: "Evaluation runs, signals, observations, notifications, mobile devices, receipts",
    sql: `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

-- One row per anomaly evaluation of one account (scheduler, cron, "Evaluate now").
CREATE TABLE evaluation_run (
  id                TEXT    PRIMARY KEY,
  mode              TEXT    NOT NULL CHECK (mode IN ('live', 'demo')),
  account_id        TEXT    NOT NULL,
  account_name      TEXT    NOT NULL,
  data_through      TEXT    NOT NULL,
  started_at        TEXT    NOT NULL,
  finished_at       TEXT    NOT NULL,
  signals           INTEGER NOT NULL,
  new_or_escalated  INTEGER NOT NULL,
  resolved          INTEGER NOT NULL
) STRICT;
CREATE INDEX evaluation_run_by_account ON evaluation_run (mode, account_id, started_at);

-- Every signal ever raised, upserted on each evaluation. Kept forever (retention only trims runs and notifications).
CREATE TABLE signal (
  mode            TEXT    NOT NULL CHECK (mode IN ('live', 'demo')),
  signal_id       TEXT    NOT NULL,
  account_id      TEXT    NOT NULL,
  account_name    TEXT    NOT NULL,
  scope           TEXT    NOT NULL,
  entity_id       TEXT    NOT NULL,
  entity_name     TEXT    NOT NULL,
  entity_type     TEXT,
  kind            TEXT    NOT NULL,
  metric          TEXT,
  direction       TEXT,
  polarity        TEXT    NOT NULL,
  severity        TEXT    NOT NULL,
  peak_severity   TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  summary         TEXT    NOT NULL,
  recommendation  TEXT    NOT NULL,
  format          TEXT    NOT NULL,
  observed        REAL    NOT NULL,
  expected        REAL    NOT NULL,
  change_pct      REAL    NOT NULL,
  z               REAL,
  onset_date      TEXT,
  window_end      TEXT    NOT NULL,
  status          TEXT    NOT NULL,
  first_seen_at   TEXT    NOT NULL,
  last_seen_at    TEXT    NOT NULL,
  resolved_at     TEXT,
  observations    INTEGER NOT NULL,
  PRIMARY KEY (mode, signal_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX signal_by_account ON signal (mode, account_id, first_seen_at);

-- How each signal looked in each run (severity and numbers drift while it stays open).
CREATE TABLE signal_observation (
  run_id     TEXT NOT NULL REFERENCES evaluation_run (id) ON DELETE CASCADE,
  signal_id  TEXT NOT NULL,
  severity   TEXT NOT NULL,
  observed   REAL NOT NULL,
  expected   REAL NOT NULL,
  z          REAL,
  PRIMARY KEY (run_id, signal_id)
) STRICT, WITHOUT ROWID;

-- What a phone should show: new, escalated and resolved signals. Visibility is by account, like the web app.
CREATE TABLE notification (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mode          TEXT    NOT NULL CHECK (mode IN ('live', 'demo')),
  account_id    TEXT    NOT NULL,
  account_name  TEXT    NOT NULL,
  signal_id     TEXT    NOT NULL,
  event         TEXT    NOT NULL CHECK (event IN ('new', 'escalated', 'resolved')),
  severity      TEXT    NOT NULL,
  polarity      TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  body          TEXT    NOT NULL,
  path          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
) STRICT;
CREATE INDEX notification_by_account ON notification (mode, account_id, id);

CREATE TABLE mobile_device (
  id                     TEXT    PRIMARY KEY,
  user_id                TEXT    NOT NULL,
  session_id             TEXT,
  platform               TEXT    NOT NULL CHECK (platform IN ('ios', 'android')),
  name                   TEXT    NOT NULL,
  app_version            TEXT    NOT NULL,
  os_version             TEXT    NOT NULL,
  push_token             TEXT,
  enabled                INTEGER NOT NULL DEFAULT 1,
  min_severity           TEXT    NOT NULL DEFAULT 'warning',
  include_opportunities  INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT    NOT NULL,
  last_seen_at           TEXT    NOT NULL,
  signed_out_at          TEXT
) STRICT;
CREATE INDEX mobile_device_by_session ON mobile_device (session_id);
CREATE INDEX mobile_device_by_user ON mobile_device (user_id);

CREATE TABLE notification_receipt (
  notification_id  INTEGER NOT NULL REFERENCES notification (id) ON DELETE CASCADE,
  device_id        TEXT    NOT NULL REFERENCES mobile_device (id) ON DELETE CASCADE,
  delivered_at     TEXT    NOT NULL,
  opened_at        TEXT,
  PRIMARY KEY (notification_id, device_id)
) STRICT, WITHOUT ROWID;
`,
  },
];

export const HISTORY_SCHEMA_VERSION = HISTORY_MIGRATIONS[HISTORY_MIGRATIONS.length - 1]?.version ?? 0;

export function migrateHistory(db: Db, at: string): number[] {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT");
  const applied = new Set((db.prepare("SELECT version FROM schema_migration").all() as { version: number }[]).map((row) => row.version));
  const ran: number[] = [];
  for (const migration of HISTORY_MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migration (version, name, applied_at) VALUES (?, ?, ?)").run(migration.version, migration.name, at);
    });
    ran.push(migration.version);
  }
  return ran;
}
