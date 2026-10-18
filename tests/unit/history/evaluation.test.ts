import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateAndPersist } from "@/lib/server/anomaly/service";
import { requestContext } from "@/lib/server/context";
import { getHistory } from "@/lib/server/history";
import { notificationCopy } from "@/lib/server/history/record";
import { historySummary } from "@/lib/server/history/summary";
import { notificationFeed } from "@/lib/server/mobile/notifications";
import { LOCAL_PRINCIPAL } from "@/lib/server/scope";
import { resetServerState, restoreServerState } from "../analytics/helpers";

describe("anomaly evaluations are kept in the history database", () => {
  beforeEach(() => resetServerState());
  afterEach(() => restoreServerState());

  it("stores each run and turns only new signals into notifications", async () => {
    const ctx = await requestContext();
    const first = await evaluateAndPersist(ctx);
    const repo = getHistory()!;
    expect(repo).not.toBeNull();
    expect(repo.counts()).toMatchObject({ evaluation_run: 1, signal: first.signals.length, notification: first.newOrEscalated.length });
    await evaluateAndPersist(ctx);
    expect(repo.counts()).toMatchObject({ evaluation_run: 2, signal: first.signals.length, notification: first.newOrEscalated.length, signal_observation: first.signals.length * 2 });

    const feed = notificationFeed(ctx, LOCAL_PRINCIPAL, { since: 0, limit: 100 });
    expect(feed.mode).toBe("live");
    expect(feed.items.length).toBe(first.newOrEscalated.length);
    expect(feed.items.every((item) => item.event === "new" && item.accountId === ctx.accountId)).toBe(true);
    expect(feed.latestId).toBe(feed.items[0]!.id);
    expect(notificationFeed(ctx, LOCAL_PRINCIPAL, { since: feed.latestId }).items).toEqual([]);

    const summary = historySummary(ctx, { months: 3 });
    expect(summary.available).toBe(true);
    expect(summary.totals.signals).toBe(first.signals.length);
    expect(summary.runs.count).toBe(2);
    expect(summary.notifications.created).toBe(first.newOrEscalated.length);
  });

  it("writes phone-sized copy that names the campaign", () => {
    const base = { title: "CPA up 84%", summary: "CPA is $181 against an expected $98.", entity: { id: "c8", name: "Search — Competitor Terms" }, severity: "critical" as const, polarity: "bad" as const };
    expect(notificationCopy(base, "new")).toEqual({ title: "Critical · CPA up 84%", body: "Search — Competitor Terms: CPA is $181 against an expected $98." });
    expect(notificationCopy(base, "escalated").title).toBe("Critical (escalated) · CPA up 84%");
    expect(notificationCopy(base, "resolved").title).toBe("Back to normal · CPA up 84%");
    expect(notificationCopy({ ...base, polarity: "good", severity: "info" }, "new").title).toBe("Opportunity · CPA up 84%");
    expect(notificationCopy({ ...base, summary: "x".repeat(400) }, "new").body.length).toBe(180);
  });
});
