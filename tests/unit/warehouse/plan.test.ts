import { describe, expect, it } from "vitest";
import { enumerate } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
import { contiguousRuns, hotFrom, orderPlan, planDailyTable, planMonths, syncWindow, type LedgerEntry } from "@/lib/domain/warehouse/plan";
const NOW = Date.parse("2026-10-09T12:00:00Z");
const fresh = (settled: boolean): LedgerEntry => ({ settled, fetchedAt: "2026-10-09T11:30:00Z" });
const old = (settled: boolean): LedgerEntry => ({ settled, fetchedAt: "2026-10-08T06:00:00Z" });
const ledgerOf = (days: readonly CivilDate[], entry: LedgerEntry) => new Map(days.map((d) => [d, entry] as const));
describe("sync window", () => {
    it("is Google's coverage cut to the backfill and to the last complete day", () => {
        expect(syncWindow({ start: "2023-10-09", end: "2026-10-09" }, "2026-10-09", "2026-10-08", 400)).toEqual({ start: "2025-09-04", end: "2026-10-08" });
        expect(syncWindow({ start: "2026-07-10", end: "2026-10-09" }, "2026-10-09", "2026-10-08", 400)).toEqual({ start: "2026-07-10", end: "2026-10-08" });
        expect(syncWindow(null, "2026-10-09", "2026-10-08", 400)).toBeNull();
        expect(syncWindow({ start: "2026-10-09", end: "2026-10-09" }, "2026-10-09", "2026-10-08", 400)).toBeNull();
        expect(hotFrom("2026-10-09", 14)).toBe("2026-09-25");
    });
});
describe("daily table plan", () => {
    const window = { start: "2026-09-01", end: "2026-10-08" };
    const base = { window, hotFrom: "2026-09-25", nowMs: NOW, hotRefreshMs: 3600000, spanDays: 366 };
    it("first sync: one request for the whole window, tagged hot (the newest days still move)", () => {
        expect(planDailyTable({ ...base, ledger: new Map() })).toEqual([{ range: window, reason: "hot", periods: 38 }]);
    });
    it("splits at the table's longest request span", () => {
        const plan = planDailyTable({ ...base, ledger: new Map(), spanDays: 31 });
        expect(plan.map((p) => [p.range.start, p.range.end])).toEqual([
            ["2026-09-01", "2026-10-01"],
            ["2026-10-02", "2026-10-08"],
        ]);
    });
    it("leaves settled days alone, re-fetches hot days only after the refresh interval", () => {
        const settled = enumerate("2026-09-01", "2026-09-24");
        const hot = enumerate("2026-09-25", "2026-10-08");
        expect(planDailyTable({ ...base, ledger: new Map([...ledgerOf(settled, old(true)), ...ledgerOf(hot, fresh(false))]) })).toEqual([]);
        expect(planDailyTable({ ...base, ledger: new Map([...ledgerOf(settled, old(true)), ...ledgerOf(hot, old(false))]) })).toEqual([{ range: { start: "2026-09-25", end: "2026-10-08" }, reason: "hot", periods: 14 }]);
    });
    it("fetches a day stored while hot once more after it settles, in the same request as the hot tail", () => {
        const ledger = new Map([...ledgerOf(enumerate("2026-09-01", "2026-09-23"), old(true)), ...ledgerOf(enumerate("2026-09-24", "2026-10-08"), old(false))]);
        expect(planDailyTable({ ...base, ledger })).toEqual([{ range: { start: "2026-09-24", end: "2026-10-08" }, reason: "hot", periods: 15 }]);
        const settleOnly = new Map([...ledgerOf(enumerate("2026-09-01", "2026-09-23"), old(true)), ...ledgerOf(["2026-09-24"], old(false)), ...ledgerOf(enumerate("2026-09-25", "2026-10-08"), fresh(false))]);
        expect(planDailyTable({ ...base, ledger: settleOnly })).toEqual([{ range: { start: "2026-09-24", end: "2026-09-24" }, reason: "settle", periods: 1 }]);
    });
    it("tells gaps between stored days from older history (backfill)", () => {
        const ledger = new Map([...ledgerOf(enumerate("2026-09-10", "2026-09-14"), old(true)), ...ledgerOf(enumerate("2026-09-18", "2026-10-08"), fresh(true))]);
        const plan = planDailyTable({ ...base, ledger });
        expect(plan).toEqual([
            { range: { start: "2026-09-01", end: "2026-09-09" }, reason: "backfill", periods: 9 },
            { range: { start: "2026-09-15", end: "2026-09-17" }, reason: "gap", periods: 3 },
        ]);
        expect(orderPlan(plan).map((p) => p.reason)).toEqual(["gap", "backfill"]);
    });
    it("orders hot → settle → gap → backfill, newest first within a reason", () => {
        const fetches = [
            { range: { start: "2025-01-01", end: "2025-06-30" }, reason: "backfill" as const, periods: 181 },
            { range: { start: "2025-07-01", end: "2025-12-31" }, reason: "backfill" as const, periods: 184 },
            { range: { start: "2026-09-24", end: "2026-09-24" }, reason: "settle" as const, periods: 1 },
            { range: { start: "2026-09-25", end: "2026-10-08" }, reason: "hot" as const, periods: 14 },
        ];
        expect(orderPlan(fetches).map((p) => p.range.start)).toEqual(["2026-09-25", "2026-09-24", "2025-07-01", "2025-01-01"]);
    });
    it("merges adjacent days with different reasons into one request, keeping the most urgent reason", () => {
        expect(contiguousRuns([
            { day: "2026-09-23", reason: "backfill" },
            { day: "2026-09-24", reason: "settle" },
            { day: "2026-09-26", reason: "hot" },
        ], 366)).toEqual([
            { range: { start: "2026-09-23", end: "2026-09-24" }, reason: "settle", periods: 2 },
            { range: { start: "2026-09-26", end: "2026-09-26" }, reason: "hot", periods: 1 },
        ]);
    });
});
describe("monthly plan (search terms)", () => {
    it("keeps complete months inside the window and refetches a month that ended in the hot window once it settles", () => {
        const window = { start: "2025-10-10", end: "2026-10-08" };
        const plan = planMonths({ window, ledger: new Map(), hotFrom: "2026-09-25" });
        expect(plan.map((p) => p.range.start)).toEqual(["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"]);
        expect(plan.at(-1)).toEqual({ range: { start: "2026-09-01", end: "2026-09-30" }, reason: "backfill", periods: 1 });
        const stored = new Map([
            ["2026-08-01", old(true)],
            ["2026-09-01", old(false)],
        ]);
        expect(planMonths({ window, ledger: stored, hotFrom: "2026-09-25" }).filter((p) => p.range.start >= "2026-08-01")).toEqual([]);
        expect(planMonths({ window, ledger: stored, hotFrom: "2026-10-15" }).filter((p) => p.range.start >= "2026-08-01")).toEqual([{ range: { start: "2026-09-01", end: "2026-09-30" }, reason: "settle", periods: 1 }]);
        expect(planMonths({ window: { start: "2026-10-01", end: "2026-10-08" }, ledger: new Map(), hotFrom: "2026-09-25" })).toEqual([]);
    });
});
