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
    account(accountId: string): Promise<AccountInfo>;
    today(accountId: string): Promise<CivilDate>;
    dataThrough(accountId: string): Promise<CivilDate>;
    getDims(accountId: string): Promise<EntityDims>;
    getTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<FactSlice>;
    getChangeEvents(accountId: string, range: DateRange): Promise<ChangeEvent[]>;
    getGoogleEstimates(accountId: string): Promise<GoogleEstimates>;
    coverage(accountId: string, table: GoogleTableId): Promise<DateRange | null>;
    invalidate(accountId?: string): Promise<void>;
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
