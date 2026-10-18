import { describe, expect, it } from "vitest";
import { monthsBetween, quantile, summarizeHistory, type SummarySignalRow } from "@/lib/domain/history/summary";

const row = (over: Partial<SummarySignalRow>): SummarySignalRow => ({
  entityId: "c1", entityName: "Brand", accountName: "Acme", metric: "cpa", peakSeverity: "warning", status: "open", firstSeenAt: "2026-09-10T00:00:00.000Z", resolvedAt: null, ...over,
});

describe("history summary", () => {
  it("lists every month in the range, across a year boundary", () => {
    expect(monthsBetween("2025-11-01", "2026-02-15T00:00:00Z")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2026-03-01", "2026-03-31")).toEqual(["2026-03"]);
  });

  it("interpolates quantiles", () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.9)).toBe(10);
    expect(quantile([0, 10], 0.9)).toBe(9);
  });

  it("counts by month, severity, metric and campaign, with time to resolve and open rate", () => {
    const summary = summarizeHistory({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-10-18T00:00:00.000Z",
      signals: [
        row({ peakSeverity: "critical", firstSeenAt: "2026-08-03T00:00:00.000Z", resolvedAt: "2026-08-04T00:00:00.000Z", status: "resolved" }),
        row({ peakSeverity: "warning", firstSeenAt: "2026-09-01T00:00:00.000Z", resolvedAt: "2026-09-01T12:00:00.000Z", status: "resolved" }),
        row({ peakSeverity: "info", metric: "roas", entityId: "c2", entityName: "PMax", firstSeenAt: "2026-10-02T00:00:00.000Z" }),
        row({ peakSeverity: "critical", firstSeenAt: "2026-10-05T00:00:00.000Z", status: "acknowledged" }),
      ],
      notifications: [
        { createdAt: "2026-10-05T00:00:00.000Z", deliveredAt: "2026-10-05T00:01:00.000Z", openedAt: "2026-10-05T00:10:00.000Z" },
        { createdAt: "2026-10-06T00:00:00.000Z", deliveredAt: "2026-10-06T00:01:00.000Z", openedAt: null },
        { createdAt: "2026-10-07T00:00:00.000Z", deliveredAt: null, openedAt: null },
      ],
      runs: { count: 12, lastRunAt: "2026-10-17T00:00:00.000Z" },
    });
    expect(summary.totals).toEqual({ signals: 4, critical: 2, warning: 1, opportunity: 1, resolved: 2, open: 1 });
    expect(summary.byMonth).toEqual([
      { month: "2026-08", critical: 1, warning: 0, opportunity: 0 },
      { month: "2026-09", critical: 0, warning: 1, opportunity: 0 },
      { month: "2026-10", critical: 1, warning: 0, opportunity: 1 },
    ]);
    expect(summary.byMetric[0]).toEqual({ metric: "cpa", signals: 3, critical: 2 });
    expect(summary.topEntities[0]).toMatchObject({ entityName: "Brand", signals: 3, critical: 2 });
    expect(summary.timeToResolveHours).toEqual({ median: 18, p90: 22.8, resolved: 2 });
    expect(summary.notifications).toEqual({ created: 3, delivered: 2, opened: 1, openRate: 0.5, medianMinutesToOpen: 10 });
  });
});
