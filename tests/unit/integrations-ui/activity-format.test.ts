import { describe, expect, it } from "vitest";
import { activityType, countByType, filterAudit, sortActions } from "@/features/data-source/activity-model";
import { formatAccountId, formatDateTime, formatInterval, parseTerms, timeAgo } from "@/features/data-source/format";
import type { AuditRow } from "@/lib/api/actions";
import type { SimulatedAction } from "@/lib/domain/contracts/actions";

const audit = (action: string, ts = "2026-09-29T12:00:00Z"): AuditRow => ({ ts, actor: "user", action, summary: action, mode: "demo" });

describe("activity log", () => {
  const rows = [audit("plugin.connect"), audit("plugin.custom.create"), audit("simulate.campaign.pause"), audit("simulate.revert"), audit("settings.update"), audit("alerts.route.create"), audit("budget.plan.create"), audit("mystery")];

  it("buckets actions by family", () => {
    expect(activityType("plugin.custom.delete")).toBe("plugin");
    expect(activityType("simulate.revert")).toBe("simulate");
    expect(activityType("alerts.run")).toBe("alerts");
    expect(activityType("mystery")).toBe("other");
    expect(activityType("")).toBe("other");
  });

  it("filters and counts", () => {
    expect(filterAudit(rows, "all")).toHaveLength(8);
    expect(filterAudit(rows, "simulate").map((r) => r.action)).toEqual(["simulate.campaign.pause", "simulate.revert"]);
    expect(countByType(rows)).toEqual({ all: 8, simulate: 2, plugin: 2, alerts: 1, budget: 1, settings: 1, other: 1 });
  });

  it("lists active simulations first, newest first", () => {
    const a = (id: string, createdAt: string, revertedAt?: string) => ({ id, createdAt, revertedAt }) as SimulatedAction;
    const sorted = sortActions([a("old", "2026-09-01T00:00:00Z"), a("reverted", "2026-09-29T00:00:00Z", "2026-09-29T01:00:00Z"), a("new", "2026-09-28T00:00:00Z")]);
    expect(sorted.map((x) => x.id)).toEqual(["new", "old", "reverted"]);
  });
});

describe("formatters", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");

  it("formats account ids like Google Ads", () => {
    expect(formatAccountId("4821193307")).toBe("482-119-3307");
    expect(formatAccountId("123")).toBe("123");
  });

  it("formats relative times", () => {
    expect(timeAgo("2026-09-29T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-09-29T11:55:00Z", now)).toBe("5m ago");
    expect(timeAgo("2026-09-29T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2026-09-27T12:00:00Z", now)).toBe("2d ago");
    expect(timeAgo("2026-08-01T12:00:00Z", now)).toBe("Aug 1, 2026");
    expect(timeAgo("nope", now)).toBe("—");
  });

  it("formats absolute times in an explicit zone", () => {
    expect(formatDateTime("2026-09-29T12:32:22Z", "UTC")).toBe("Sep 29, 12:32");
    expect(formatDateTime("2026-09-29T12:32:22Z", "America/New_York")).toBe("Sep 29, 08:32");
    expect(formatDateTime("bad", "UTC")).toBe("—");
  });

  it("formats refresh intervals", () => {
    expect([0, 30, 300, 3600].map(formatInterval)).toEqual(["Off", "30 s", "5 min", "1 h"]);
  });

  it("parses term lists", () => {
    expect(parseTerms(" acme, Acme ,acme shoes\n\n stridemax ,")).toEqual(["acme", "acme shoes", "stridemax"]);
    expect(parseTerms(Array.from({ length: 60 }, (_, i) => `t${i}`).join(","))).toHaveLength(50);
    expect(parseTerms("x".repeat(80))[0]).toHaveLength(60);
  });
});
