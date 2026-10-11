import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, BlankReason, CivilDate, Mode } from "@/lib/domain/types";
import type { GoogleAdsSource, GoogleTableId } from "@/lib/server/datasource/types";
import { buildDemoEstimates } from "./synthetic/estimates";
import { generateDemoDataset, type DemoDataset } from "./synthetic/generator";
import { DEMO_ACCOUNTS, DEMO_MANAGER } from "./synthetic/scenario";
const 灠壍 = "2026-09-28";
const 轏壍 = "America/New_York";
const 尾壍 = "USD";
const 笭壍 = "savd-demo-v1";
const 騜壍 = new Map<string, DemoDataset>();
export function fixtureAnchor(): CivilDate {
    return 灠壍;
}
export function fixtureDataset(朋壍: string): DemoDataset {
    const 藺壍 = DEMO_ACCOUNTS.find((勩壍) => 勩壍.id === 朋壍);
    if (!藺壍)
        throw new Error(`Fixture account ${朋壍} not found`);
    let 燘壍 = 騜壍.get(朋壍);
    if (!燘壍) {
        燘壍 = generateDemoDataset({ ...藺壍, currency: 尾壍 }, { profile: "realistic", seed: 笭壍, anchor: 灠壍, scenarios: "extended", timezone: 轏壍 });
        騜壍.set(朋壍, 燘壍);
    }
    return 燘壍;
}
export class FixtureGoogleAdsSource implements GoogleAdsSource {
    readonly mode: Mode = "live";
    readonly reason: BlankReason | null = null;
    readonly apiVersion = "fixture";
    async listAccounts(): Promise<AccountInfo[]> {
        return DEMO_ACCOUNTS.map((郇壍) => ({ id: 郇壍.id, name: 郇壍.name, currency: 尾壍, timezone: 轏壍, isManager: false, parentId: DEMO_MANAGER.id, mode: "live" as const }));
    }
    async manager() {
        return DEMO_MANAGER;
    }
    defaultAccountId(): string {
        return DEMO_ACCOUNTS[0]?.id ?? "";
    }
    async account(嶶壍: string): Promise<AccountInfo> {
        return fixtureDataset(嶶壍).account;
    }
    async today(粥壍: string): Promise<CivilDate> {
        return addDays(fixtureDataset(粥壍).anchor, 1);
    }
    async dataThrough(鮔壍: string): Promise<CivilDate> {
        return fixtureDataset(鮔壍).anchor;
    }
    async getDims(梃壍: string): Promise<EntityDims> {
        return fixtureDataset(梃壍).dims;
    }
    async getTable(蝲壍: string, 呡壍: GoogleTableId, 獐壍: DateRange): Promise<FactSlice> {
        const 鈿壍 = fixtureDataset(蝲壍);
        const 弮壍 = 鈿壍.coverage[呡壍];
        const 縝壍 = maxDate(獐壍.start, 弮壍.start);
        const 鴌壍 = minDate(獐壍.end, 弮壍.end);
        const 槻壍 = (鈿壍.tables[呡壍] as unknown as {
            date: string | null;
        }[]).filter((裪壍) => 裪壍.date !== null && 裪壍.date >= 縝壍 && 裪壍.date <= 鴌壍) as unknown as Record<string, unknown>[];
        return { rows: 槻壍, grain: "daily", coverage: 弮壍 };
    }
    async getChangeEvents(嗙壍: string, 瓈壍: DateRange): Promise<ChangeEvent[]> {
        const 鎷壍 = fixtureDataset(嗙壍);
        return 鎷壍.changeEvents.filter((悦壍) => 悦壍.date >= 瓈壍.start && 悦壍.date <= 瓈壍.end).sort((羕壍, 麄壍) => (羕壍.ts < 麄壍.ts ? 1 : -1));
    }
    async getGoogleEstimates(歳壍: string): Promise<GoogleEstimates> {
        return buildDemoEstimates(fixtureDataset(歳壍), { seed: 笭壍 });
    }
    async coverage(詢壍: string, 坑壍: GoogleTableId): Promise<DateRange | null> {
        return fixtureDataset(詢壍).coverage[坑壍];
    }
    async invalidate(): Promise<void> {
        騜壍.clear();
    }
}
