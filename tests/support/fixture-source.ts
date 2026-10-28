import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, BlankReason, CivilDate, Mode } from "@/lib/domain/types";
import type { GoogleAdsSource, GoogleTableId } from "@/lib/server/datasource/types";
import { buildDemoEstimates } from "./synthetic/estimates";
import { generateDemoDataset, type DemoDataset } from "./synthetic/generator";
import { DEMO_ACCOUNTS, DEMO_MANAGER } from "./synthetic/scenario";
const text = "2026-09-28";
const text2 = "America/New_York";
const text3 = "USD";
const text4 = "savd-demo-v1";
const map = new Map<string, DemoDataset>();
export function fixtureAnchor(): CivilDate {
    return text;
}
export function fixtureDataset(text5: string): DemoDataset {
    const dEMO_ACCOUNTSItem = DEMO_ACCOUNTS.find((dEMO_ACCOUNTSItem2) => dEMO_ACCOUNTSItem2.id === text5);
    if (!dEMO_ACCOUNTSItem)
        throw new Error(`Fixture account ${text5} not found`);
    let value = map.get(text5);
    if (!value) {
        value = generateDemoDataset({ ...dEMO_ACCOUNTSItem, currency: text3 }, { profile: "realistic", seed: text4, anchor: text, scenarios: "extended", timezone: text2 });
        map.set(text5, value);
    }
    return value;
}
export class FixtureGoogleAdsSource implements GoogleAdsSource {
    readonly mode: Mode = "live";
    readonly reason: BlankReason | null = null;
    readonly apiVersion = "fixture";
    async listAccounts(): Promise<AccountInfo[]> {
        return DEMO_ACCOUNTS.map((dEMO_ACCOUNTSItem) => ({ id: dEMO_ACCOUNTSItem.id, name: dEMO_ACCOUNTSItem.name, currency: text3, timezone: text2, isManager: false, parentId: DEMO_MANAGER.id, mode: "live" as const }));
    }
    async manager() {
        return DEMO_MANAGER;
    }
    defaultAccountId(): string {
        return DEMO_ACCOUNTS[0]?.id ?? "";
    }
    async account(text5: string): Promise<AccountInfo> {
        return fixtureDataset(text5).account;
    }
    async today(text5: string): Promise<CivilDate> {
        return addDays(fixtureDataset(text5).anchor, 1);
    }
    async dataThrough(text5: string): Promise<CivilDate> {
        return fixtureDataset(text5).anchor;
    }
    async getDims(text5: string): Promise<EntityDims> {
        return fixtureDataset(text5).dims;
    }
    async getTable(text5: string, googleTableId: GoogleTableId, dateRange: DateRange): Promise<FactSlice> {
        const fixtureDataset2 = fixtureDataset(text5);
        const coverageItem = fixtureDataset2.coverage[googleTableId];
        const maxDate2 = maxDate(dateRange.start, coverageItem.start);
        const minDate2 = minDate(dateRange.end, coverageItem.end);
        const table = (fixtureDataset2.tables[googleTableId] as unknown as {
            date: string | null;
        }[]).filter((tableItem) => tableItem.date !== null && tableItem.date >= maxDate2 && tableItem.date <= minDate2) as unknown as Record<string, unknown>[];
        return { rows: table, grain: "daily", coverage: coverageItem };
    }
    async getChangeEvents(text5: string, dateRange: DateRange): Promise<ChangeEvent[]> {
        const fixtureDataset2 = fixtureDataset(text5);
        return fixtureDataset2.changeEvents.filter((changeEvent) => changeEvent.date >= dateRange.start && changeEvent.date <= dateRange.end).sort((a, b) => (a.ts < b.ts ? 1 : -1));
    }
    async getGoogleEstimates(text5: string): Promise<GoogleEstimates> {
        return buildDemoEstimates(fixtureDataset(text5), { seed: text4 });
    }
    async coverage(text5: string, googleTableId: GoogleTableId): Promise<DateRange | null> {
        return fixtureDataset(text5).coverage[googleTableId];
    }
    async invalidate(): Promise<void> {
        map.clear();
    }
}
