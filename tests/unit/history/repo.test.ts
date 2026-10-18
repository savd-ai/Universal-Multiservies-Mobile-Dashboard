import { describe, expect, it } from "vitest";
import type { Signal } from "@/lib/domain/contracts/anomaly";
import type { Severity } from "@/lib/domain/types";
import { HistoryRepo, type NotificationDraft, type RunRecord } from "@/lib/server/history/repo";
import { HISTORY_SCHEMA_VERSION, migrateHistory } from "@/lib/server/history/schema";
import { openDatabase } from "@/lib/server/warehouse/sqlite";

const AT = "2026-10-18T08:00:00.000Z";

function freshRepo(): HistoryRepo {
  const db = openDatabase(":memory:");
  expect(migrateHistory(db, AT)).toEqual([HISTORY_SCHEMA_VERSION]);
  expect(migrateHistory(db, AT)).toEqual([]);
  return new HistoryRepo(db);
}

function signal(id: string, severity: Severity, polarity: "bad" | "good" = "bad", observed = 10): Omit<Signal, "series"> {
  return {
    id, accountId: "111", mode: "live", scope: "campaign", entity: { id: `c-${id}`, name: `Campaign ${id}`, type: "Search" }, kind: "metric_deviation",
    detectors: ["zscore"], metric: "cpa", direction: "up", polarity, severity, score: 3, observed, expected: 5, changePct: 1, z: 4,
    window: { recentStart: "2026-10-15", recentEnd: "2026-10-17" }, title: `CPA up (${id})`, summary: "CPA doubled", recommendation: "Check bids",
    evidence: [], relatedChanges: [], format: "money", dataAsOf: "2026-10-17", detectedAt: AT,
  } as Omit<Signal, "series">;
}

function run(id: string, at = AT, mode: "live" | "demo" = "live"): RunRecord {
  return { id, mode, accountId: "111", accountName: "Acme", dataThrough: "2026-10-17", startedAt: at, finishedAt: at, signals: 0, newOrEscalated: 0, resolved: 0 };
}

const draft = (signalId: string, severity: Severity, polarity: "bad" | "good" = "bad", event: NotificationDraft["event"] = "new", accountId = "111"): NotificationDraft => ({
  accountId, accountName: "Acme", signalId, event, severity, polarity, title: `t ${signalId}`, body: "b", path: "/anomalies?acct=111",
});

describe("history repo", () => {
  it("upserts signals across runs: keeps first seen, raises the peak, counts observations, resolves", () => {
    const repo = freshRepo();
    repo.recordRun(run("r1"), [{ signal: signal("s1", "warning"), status: "open", firstSeenAt: AT }], [], []);
    repo.recordRun(run("r2", "2026-10-18T09:00:00.000Z"), [{ signal: signal("s1", "critical", "bad", 20), status: "open", firstSeenAt: "2026-10-18T09:00:00.000Z" }], [], []);
    repo.recordRun(run("r3", "2026-10-18T10:00:00.000Z"), [{ signal: signal("s1", "warning", "bad", 12), status: "open", firstSeenAt: AT }], [], []);
    const [stored] = repo.signals("live", ["111"], { limit: 10 });
    expect(stored).toMatchObject({ signalId: "s1", severity: "warning", peakSeverity: "critical", observations: 3, firstSeenAt: AT, resolvedAt: null, status: "open" });
    repo.recordRun(run("r4", "2026-10-19T08:00:00.000Z"), [], ["s1"], []);
    expect(repo.signals("live", ["111"], { limit: 10 })[0]).toMatchObject({ status: "resolved", resolvedAt: "2026-10-19T08:00:00.000Z" });
    expect(repo.counts()).toMatchObject({ evaluation_run: 4, signal: 1, signal_observation: 3 });
    expect(repo.signals("demo", ["111"], { limit: 10 })).toEqual([]);
  });

  it("filters notifications by account, mode, cursor and device severity", () => {
    const repo = freshRepo();
    const ids = repo.recordRun(run("r1"), [], [], [draft("a", "critical"), draft("b", "warning"), draft("c", "info", "good"), draft("d", "critical", "bad", "new", "999")]);
    expect(ids).toHaveLength(4);
    expect(repo.notifications("live", ["111"], { since: 0, limit: 50 }).map((n) => n.signalId)).toEqual(["c", "b", "a"]);
    expect(repo.notifications("live", ["111"], { since: 0, limit: 50, filter: { minSeverity: "warning", includeOpportunities: false } }).map((n) => n.signalId)).toEqual(["b", "a"]);
    expect(repo.notifications("live", ["111"], { since: 0, limit: 50, filter: { minSeverity: "critical", includeOpportunities: true } }).map((n) => n.signalId)).toEqual(["c", "a"]);
    expect(repo.notifications("live", ["111"], { since: ids[1]!, limit: 50 }).map((n) => n.signalId)).toEqual(["c"]);
    expect(repo.notifications("demo", ["111"], { since: 0, limit: 50 })).toEqual([]);
    expect(repo.notifications("live", [], { since: 0, limit: 50 })).toEqual([]);
    expect(repo.latestNotificationId("live", ["111"])).toBe(ids[2]);
  });

  it("records receipts only for visible notifications and keeps the first open time", () => {
    const repo = freshRepo();
    const [mine, theirs] = repo.recordRun(run("r1"), [], [], [draft("a", "critical"), draft("x", "critical", "bad", "new", "999")]);
    const device = repo.registerDevice({ id: "dev-1", userId: "u1", sessionId: "sess-1", info: { platform: "ios", name: "iPhone", appVersion: "1.0.0", osVersion: "18.2" }, at: AT });
    expect(device).toMatchObject({ enabled: true, minSeverity: "warning", includeOpportunities: false, hasPushToken: false });
    expect(repo.markReceipts("dev-1", "live", ["111"], [mine!, theirs!], AT, false)).toBe(1);
    expect(repo.markReceipts("dev-1", "live", ["111"], [mine!], "2026-10-18T08:05:00.000Z", true)).toBe(1);
    repo.markReceipts("dev-1", "live", ["111"], [mine!], "2026-10-18T09:00:00.000Z", true);
    expect(repo.summaryNotifications("live", ["111"], "2026-01-01")).toEqual([{ createdAt: AT, deliveredAt: AT, openedAt: "2026-10-18T08:05:00.000Z" }]);
  });

  it("finds a device by session, updates prefs and forgets it on sign-out", () => {
    const repo = freshRepo();
    repo.registerDevice({ id: "dev-1", userId: "u1", sessionId: "sess-1", info: { platform: "android", name: "Pixel", appVersion: "1.0.0", osVersion: "15" }, at: AT });
    expect(repo.updateDevice("dev-1", { minSeverity: "critical", includeOpportunities: true, pushToken: "token-123456" }, AT)).toMatchObject({ minSeverity: "critical", includeOpportunities: true, hasPushToken: true });
    expect(repo.deviceForSession("sess-1")?.id).toBe("dev-1");
    repo.signOutSession("sess-1", AT);
    expect(repo.deviceForSession("sess-1")).toBeNull();
    expect(repo.device("dev-1")).toMatchObject({ hasPushToken: false });
    expect(repo.devicesOf("u1")).toEqual([]);
  });

  it("prunes old runs and notifications but keeps signals", () => {
    const repo = freshRepo();
    repo.recordRun(run("old", "2026-01-01T00:00:00.000Z"), [{ signal: signal("s1", "warning"), status: "open", firstSeenAt: "2026-01-01T00:00:00.000Z" }], [], [draft("s1", "warning")]);
    repo.recordRun(run("new"), [], [], [draft("s2", "critical")]);
    expect(repo.prune("2026-06-01T00:00:00.000Z")).toEqual({ runs: 1, notifications: 1 });
    expect(repo.counts()).toMatchObject({ evaluation_run: 1, signal: 1, signal_observation: 0, notification: 1 });
  });
});
