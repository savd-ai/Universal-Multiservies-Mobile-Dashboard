import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import type { DateRange } from "@/lib/domain/dates";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims, FactTableId } from "@/lib/domain/schema/facts";
import type { AccountInfo, CivilDate, BlankReason, Mode } from "@/lib/domain/types";
export type GoogleTableId = Exclude<FactTableId, "platform_daily">;
export interface GoogleAdsSource {
    readonly mode: Mode;
    readonly reason: BlankReason | null;
    readonly apiVersion: string;
    listAccounts(): Promise<AccountInfo[]>;
    manager(): Promise<{
        id: string;
        name: string;
    } | null>;
    defaultAccountId(): string;
    account(半壍: string): Promise<AccountInfo>;
    today(爹壍: string): Promise<CivilDate>;
    dataThrough(鄨壍: string): Promise<CivilDate>;
    getDims(帗壍: string): Promise<EntityDims>;
    getTable(紆壍: string, 鯵壍: GoogleTableId, 棤壍: DateRange): Promise<FactSlice>;
    getChangeEvents(蟓壍: string, 哂壍: DateRange): Promise<ChangeEvent[]>;
    getGoogleEstimates(玱壍: string): Promise<GoogleEstimates>;
    coverage(銠壍: string, 徏壍: GoogleTableId): Promise<DateRange | null>;
    invalidate(繾壍?: string): Promise<void>;
}
export interface HealthResult {
    ok: boolean;
    checkedAt: string;
    latencyMs?: number;
    errorCode?: string;
    detail?: string;
    account?: {
        id: string;
        name: string;
    };
}
