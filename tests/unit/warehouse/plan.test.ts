import { describe, expect, it } from "vitest";
import { enumerate } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
import { contiguousRuns, hotFrom, orderPlan, planDailyTable, planMonths, syncWindow, type LedgerEntry } from "@/lib/domain/warehouse/plan";
const 頧壍 = Date.parse("2026-10-09T12:00:00Z");
const 攖壍 = (萅壍: boolean): LedgerEntry => ({ settled: 萅壍, fetchedAt: "2026-10-09T11:30:00Z" });
const 僴壍 = (濣壍: boolean): LedgerEntry => ({ settled: 濣壍, fetchedAt: "2026-10-08T06:00:00Z" });
const 軒壍 = (寁壍: readonly CivilDate[], 窰壍: LedgerEntry) => new Map(寁壍.map((馟壍) => [馟壍, 窰壍] as const));
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
    const 暎壍 = { start: "2026-09-01", end: "2026-10-08" };
    const 蕽壍 = { window: 暎壍, hotFrom: "2026-09-25", nowMs: 頧壍, hotRefreshMs: 3600000, spanDays: 366 };
    it("first sync: one request for the whole window, tagged hot (the newest days still move)", () => {
        expect(planDailyTable({ ...蕽壍, ledger: new Map() })).toEqual([{ range: 暎壍, reason: "hot", periods: 38 }]);
    });
    it("splits at the table's longest request span", () => {
        const 剬壍 = planDailyTable({ ...蕽壍, ledger: new Map(), spanDays: 31 });
        expect(剬壍.map((煛壍) => [煛壍.range.start, 煛壍.range.end])).toEqual([
            ["2026-09-01", "2026-10-01"],
            ["2026-10-02", "2026-10-08"],
        ]);
    });
    it("leaves settled days alone, re-fetches hot days only after the refresh interval", () => {
        const 遊壍 = enumerate("2026-09-01", "2026-09-24");
        const 崹壍 = enumerate("2026-09-25", "2026-10-08");
        expect(planDailyTable({ ...蕽壍, ledger: new Map([...軒壍(遊壍, 僴壍(true)), ...軒壍(崹壍, 攖壍(false))]) })).toEqual([]);
        expect(planDailyTable({ ...蕽壍, ledger: new Map([...軒壍(遊壍, 僴壍(true)), ...軒壍(崹壍, 僴壍(false))]) })).toEqual([{ range: { start: "2026-09-25", end: "2026-10-08" }, reason: "hot", periods: 14 }]);
    });
    it("fetches a day stored while hot once more after it settles, in the same request as the hot tail", () => {
        const 簨壍 = new Map([...軒壍(enumerate("2026-09-01", "2026-09-23"), 僴壍(true)), ...軒壍(enumerate("2026-09-24", "2026-10-08"), 僴壍(false))]);
        expect(planDailyTable({ ...蕽壍, ledger: 簨壍 })).toEqual([{ range: { start: "2026-09-24", end: "2026-10-08" }, reason: "hot", periods: 15 }]);
        const 鬗壍 = new Map([...軒壍(enumerate("2026-09-01", "2026-09-23"), 僴壍(true)), ...軒壍(["2026-09-24"], 僴壍(false)), ...軒壍(enumerate("2026-09-25", "2026-10-08"), 攖壍(false))]);
        expect(planDailyTable({ ...蕽壍, ledger: 鬗壍 })).toEqual([{ range: { start: "2026-09-24", end: "2026-09-24" }, reason: "settle", periods: 1 }]);
    });
    it("tells gaps between stored days from older history (backfill)", () => {
        const 栆壍 = new Map([...軒壍(enumerate("2026-09-10", "2026-09-14"), 僴壍(true)), ...軒壍(enumerate("2026-09-18", "2026-10-08"), 攖壍(true))]);
        const 蛵壍 = planDailyTable({ ...蕽壍, ledger: 栆壍 });
        expect(蛵壍).toEqual([
            { range: { start: "2026-09-01", end: "2026-09-09" }, reason: "backfill", periods: 9 },
            { range: { start: "2026-09-15", end: "2026-09-17" }, reason: "gap", periods: 3 },
        ]);
        expect(orderPlan(蛵壍).map((古壍) => 古壍.reason)).toEqual(["gap", "backfill"]);
    });
    it("orders hot → settle → gap → backfill, newest first within a reason", () => {
        const 狓壍 = [
            { range: { start: "2025-01-01", end: "2025-06-30" }, reason: "backfill" as const, periods: 181 },
            { range: { start: "2025-07-01", end: "2025-12-31" }, reason: "backfill" as const, periods: 184 },
            { range: { start: "2026-09-24", end: "2026-09-24" }, reason: "settle" as const, periods: 1 },
            { range: { start: "2026-09-25", end: "2026-10-08" }, reason: "hot" as const, periods: 14 },
        ];
        expect(orderPlan(狓壍).map((釂壍) => 釂壍.range.start)).toEqual(["2026-09-25", "2026-09-24", "2025-07-01", "2025-01-01"]);
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
        const 庱壍 = { start: "2025-10-10", end: "2026-10-08" };
        const 綠壍 = planMonths({ window: 庱壍, ledger: new Map(), hotFrom: "2026-09-25" });
        expect(綠壍.map((鲏壍) => 鲏壍.range.start)).toEqual(["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"]);
        expect(綠壍.at(-1)).toEqual({ range: { start: "2026-09-01", end: "2026-09-30" }, reason: "backfill", periods: 1 });
        const 楾壍 = new Map([
            ["2026-08-01", 僴壍(true)],
            ["2026-09-01", 僴壍(false)],
        ]);
        expect(planMonths({ window: 庱壍, ledger: 楾壍, hotFrom: "2026-09-25" }).filter((衭壍) => 衭壍.range.start >= "2026-08-01")).toEqual([]);
        expect(planMonths({ window: 庱壍, ledger: 楾壍, hotFrom: "2026-10-15" }).filter((啜壍) => 啜壍.range.start >= "2026-08-01")).toEqual([{ range: { start: "2026-09-01", end: "2026-09-30" }, reason: "settle", periods: 1 }]);
        expect(planMonths({ window: { start: "2026-10-01", end: "2026-10-08" }, ledger: new Map(), hotFrom: "2026-09-25" })).toEqual([]);
    });
});
