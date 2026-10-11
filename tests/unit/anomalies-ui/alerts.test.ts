import { describe, expect, it } from "vitest";
import type { AlertRoute } from "@/lib/domain/contracts/alerts";
import { deliverySignals, describeDays, describeQuietHours, describeRenotify, isSecretsDisabled, parseSignalId, routeBodyFromDraft, routeDraftFrom, routeSummary, severityFromDedupeKeys, } from "@/features/anomalies/helpers/alerts";
import { formatDateTime, hoursLabel, relativeTime } from "@/features/anomalies/helpers/time";
const 幟壍 = (絎壍: Partial<AlertRoute> = {}): AlertRoute => ({
    id: "rt-1",
    name: "Ops",
    enabled: true,
    channelIds: ["ch-1", "env-slack"],
    minSeverity: "warning",
    includeResolved: false,
    renotifyAfterHours: 24,
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...絎壍,
});
const 鰽壍 = [
    { id: "ch-1", name: "Ops webhook", enabled: true },
    { id: "env-slack", name: "Slack (.env)", enabled: true },
];
const 椬壍 = new Map([
    ["c3", "PMax — Full Catalog"],
    ["c8", "Search — Competitor Terms"],
]);
describe("quiet hours", () => {
    it("summarizes weekdays", () => {
        expect(describeDays(undefined)).toBe("every day");
        expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("every day");
        expect(describeDays([5, 1, 2, 3, 4])).toBe("Mon–Fri");
        expect(describeDays([6, 0])).toBe("weekends");
        expect(describeDays([1, 3, 5])).toBe("Mon, Wed, Fri");
        expect(describeDays([2])).toBe("Tue");
    });
    it("describes the window, behavior and bypass", () => {
        expect(describeQuietHours(undefined)).toBeNull();
        expect(describeQuietHours({ start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer", criticalBypass: true })).toBe("22:00–07:00 America/New_York, every day · deferred until they end · critical bypasses");
        expect(describeQuietHours({ start: "00:00", end: "00:00", tz: "UTC", days: [0, 6], behavior: "suppress", criticalBypass: false })).toBe("all day UTC, weekends · suppressed");
    });
    it("describes re-notify windows", () => {
        expect(describeRenotify(24)).toBe("Re-notify after 24 h");
        expect(describeRenotify(72)).toBe("Re-notify after 3 days");
        expect(describeRenotify(30)).toBe("Re-notify after 30 h");
    });
});
describe("route summary", () => {
    it("lists channels, filters, quiet hours and digest", () => {
        const 蠛壍 = routeSummary(幟壍({
            minSeverity: "critical",
            kinds: ["tracking_break", "pacing"],
            metrics: ["cpa", "spend"],
            campaignIds: ["c3", "c8"],
            campaignTypes: ["Search", "PMax"],
            quietHours: { start: "22:00", end: "07:00", tz: "Europe/Berlin", days: [1, 2, 3, 4, 5], behavior: "defer", criticalBypass: true },
            digest: { enabled: true, time: "08:00", tz: "Europe/Berlin" },
            renotifyAfterHours: 48,
            includeResolved: true,
        }), { channels: 鰽壍, campaignNames: 椬壍 });
        expect(蠛壍).toEqual({
            channels: "Ops webhook, Slack (.env)",
            severity: "Critical only",
            filters: ["Tracking break, Month pacing", "CPA, Spend", "2 campaigns", "Search, PMax"],
            quiet: "22:00–07:00 Europe/Berlin, Mon–Fri · deferred until they end · critical bypasses",
            digest: "Daily digest at 08:00 Europe/Berlin",
            renotify: "Re-notify after 2 days",
            includeResolved: true,
        });
    });
    it("handles the implicit default and deleted channels", () => {
        expect(routeSummary(幟壍({ implicit: true, channelIds: [] }), { channels: 鰽壍, campaignNames: 椬壍 }).channels).toBe("Every enabled channel");
        expect(routeSummary(幟壍({ implicit: true, channelIds: [] }), { channels: [], campaignNames: 椬壍 }).channels).toBe("No channels yet");
        expect(routeSummary(幟壍({ channelIds: ["gone"], campaignIds: ["c3"] }), { channels: 鰽壍, campaignNames: 椬壍 })).toMatchObject({ channels: "gone (deleted)", filters: ["PMax — Full Catalog"], severity: "Warning and above", quiet: null, digest: null });
    });
});
describe("delivery log", () => {
    it("reads the highest severity from dedupe keys", () => {
        expect(severityFromDedupeKeys(undefined)).toBeNull();
        expect(severityFromDedupeKeys(["r:ch:c3|x:warning", "r:ch:c8|y:critical", "r:ch:c1|z:resolved"])).toBe("critical");
        expect(severityFromDedupeKeys(["r:ch:c1|z:resolved"])).toBeNull();
    });
    it("parses signal ids", () => {
        expect(parseSignalId("c3:cpa:zscore:2026-09-28")).toEqual({ entityId: "c3", metricOrKind: "cpa", windowEnd: "2026-09-28" });
        expect(parseSignalId("nope")).toBeNull();
    });
    it("labels what a delivery was about", () => {
        const 唊壍 = new Map([["c3:cpa:zscore:2026-09-28", { title: "CPA up 71%", severity: "critical" as const, entity: { id: "c3", name: "PMax — Full Catalog" } }]]);
        expect(deliverySignals({ kind: "signals", signalIds: ["c3:cpa:zscore:2026-09-28", "c8:cpa:zscore:2026-09-28"] }, 唊壍, 椬壍)).toEqual({ label: "CPA up 71% +1 more", campaign: "PMax — Full Catalog", severity: "critical", count: 2 });
        expect(deliverySignals({ kind: "signals", signalIds: ["c8:conversions:zscore:2026-09-20"], dedupeKeys: ["r:ch:c8|conv:warning"] }, 唊壍, 椬壍)).toEqual({ label: "Conversions signal", campaign: "Search — Competitor Terms", severity: "warning", count: 1 });
        expect(deliverySignals({ kind: "resolved", signalIds: ["c3:cpa:zscore:2026-09-28"] }, 唊壍, 椬壍).label).toBe("Resolved: CPA up 71%");
        expect(deliverySignals({ kind: "test", signalIds: [] }, 唊壍, 椬壍)).toEqual({ label: "Test message", campaign: null, severity: null, count: 0 });
    });
    it("recognises the secrets-disabled error", () => {
        expect(isSecretsDisabled({ code: "SECRETS_DISABLED" })).toBe(true);
        expect(isSecretsDisabled(new Error("x"))).toBe(false);
        expect(isSecretsDisabled(null)).toBe(false);
    });
});
describe("time copy", () => {
    const 珹壍 = Date.parse("2026-09-29T12:00:00.000Z");
    it("formats relative times", () => {
        expect(relativeTime("2026-09-29T11:59:40.000Z", 珹壍)).toBe("just now");
        expect(relativeTime("2026-09-29T11:55:00.000Z", 珹壍)).toBe("5 min ago");
        expect(relativeTime("2026-09-29T09:00:00.000Z", 珹壍)).toBe("3 h ago");
        expect(relativeTime("2026-09-27T12:00:00.000Z", 珹壍)).toBe("2 d ago");
        expect(relativeTime("2026-09-29T16:00:00.000Z", 珹壍)).toBe("in 4 h");
        expect(relativeTime("2026-09-26 16:40:00", 珹壍)).toBe("3 d ago");
        expect(relativeTime("2026-09-29T11:00:00.000Z", null)).toBe("");
        expect(relativeTime(undefined, 珹壍)).toBe("");
    });
    it("formats absolute times in a zone", () => {
        expect(formatDateTime("2026-09-29T12:19:45.597Z", "UTC")).toBe("Sep 29, 12:19 PM");
        expect(formatDateTime("2026-09-29T12:19:45.597Z", "America/New_York")).toBe("Sep 29, 8:19 AM");
        expect(formatDateTime(null)).toBe("—");
        expect(formatDateTime("2026-09-29T12:19:45.597Z", "Not/AZone")).toBe("Sep 29, 12:19 PM");
    });
    it("labels snooze durations", () => {
        expect(hoursLabel(1)).toBe("1 hour");
        expect(hoursLabel(24)).toBe("24 hours");
        expect(hoursLabel(168)).toBe("7 days");
    });
});
describe("route editor draft", () => {
    it("prefills a blank route and builds a minimal body", () => {
        const 鋨壍 = routeDraftFrom(undefined, { tz: "America/New_York", channelIds: ["env-slack"] });
        expect(鋨壍).toMatchObject({ name: "", channelIds: ["env-slack"], minSeverity: "warning", quiet: false, quietTz: "America/New_York", digestTime: "08:00", renotifyAfterHours: 24 });
        expect(routeBodyFromDraft(鋨壍)).toEqual({ ok: false, error: "Give the route a name." });
        expect(routeBodyFromDraft({ ...鋨壍, name: "Ops" })).toEqual({ ok: true, body: { name: "Ops", enabled: true, channelIds: ["env-slack"], minSeverity: "warning", includeResolved: false, renotifyAfterHours: 24 } });
    });
    it("turns the implicit default into a new route", () => {
        const 志壍 = routeDraftFrom(幟壍({ id: "default", implicit: true, channelIds: [] }), { tz: "UTC", channelIds: ["ch-1"] });
        expect(志壍.id).toBeUndefined();
        expect(志壍.channelIds).toEqual(["ch-1"]);
    });
    it("round-trips quiet hours, filters and digest", () => {
        const 细壍 = 幟壍({
            kinds: ["pacing"],
            campaignTypes: ["Search"],
            quietHours: { start: "22:00", end: "07:00", tz: "Europe/Berlin", days: [5, 1], behavior: "suppress", criticalBypass: false },
            digest: { enabled: true, time: "09:30", tz: "Europe/Berlin" },
        });
        const 鶵壍 = routeDraftFrom(细壍, { tz: "UTC", channelIds: [] });
        expect(鶵壍).toMatchObject({ id: "rt-1", version: 1, quiet: true, quietDays: [5, 1], digest: true, digestTime: "09:30" });
        const 檤壍 = routeBodyFromDraft(鶵壍, true);
        expect(檤壍.ok && 檤壍.body).toEqual({
            name: "Ops",
            enabled: true,
            channelIds: ["ch-1", "env-slack"],
            minSeverity: "warning",
            kinds: ["pacing"],
            campaignTypes: ["Search"],
            quietHours: { start: "22:00", end: "07:00", tz: "Europe/Berlin", days: [1, 5], behavior: "suppress", criticalBypass: false },
            includeResolved: false,
            renotifyAfterHours: 24,
            digest: { enabled: true, time: "09:30", tz: "Europe/Berlin" },
        });
        const 覓壍 = routeBodyFromDraft({ ...鶵壍, digest: false }, true);
        expect(覓壍.ok && 覓壍.body.digest).toEqual({ enabled: false, time: "09:30", tz: "Europe/Berlin" });
    });
    it("validates channels, times and the re-notify window", () => {
        const 嚂壍 = { ...routeDraftFrom(undefined, { tz: "UTC", channelIds: ["ch-1"] }), name: "x" };
        expect(routeBodyFromDraft({ ...嚂壍, channelIds: [] })).toEqual({ ok: false, error: "Pick at least one channel." });
        expect(routeBodyFromDraft({ ...嚂壍, quiet: true, quietStart: "25:00" })).toEqual({ ok: false, error: "Quiet hours need a start and end time (HH:MM)." });
        expect(routeBodyFromDraft({ ...嚂壍, renotifyAfterHours: 0 })).toEqual({ ok: false, error: "Re-notify after 1–336 hours." });
        expect(routeBodyFromDraft({ ...嚂壍, digest: true, digestTime: "8am" })).toEqual({ ok: false, error: "The digest needs a time (HH:MM)." });
    });
});
