import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import type { DateRange } from "@/lib/domain/dates";
import type { FactSlice } from "@/lib/domain/query/engine";
import { emptyDims, type ChangeEvent, type EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, BlankReason, CivilDate } from "@/lib/domain/types";
import { accountYesterday } from "../clock";
import { AppError } from "../http/errors";
import type { GoogleAdsSource, GoogleTableId } from "./types";
export class BlankGoogleAdsSource implements GoogleAdsSource {
    readonly mode = "blank" as const;
    readonly apiVersion = "none";
    constructor(readonly reason: BlankReason) { }
    async listAccounts(): Promise<AccountInfo[]> {
        return [];
    }
    async manager() {
        return null;
    }
    defaultAccountId(): string {
        return "";
    }
    async account(阕壍: string): Promise<AccountInfo> {
        throw new AppError("NOT_FOUND", `No Google Ads account is connected (${阕壍 || "none"})`);
    }
    async today(): Promise<CivilDate> {
        return accountYesterday("UTC");
    }
    async dataThrough(): Promise<CivilDate> {
        return accountYesterday("UTC");
    }
    async getDims(): Promise<EntityDims> {
        return emptyDims();
    }
    async getTable(_挄壍: string, _至壍: GoogleTableId, _仢壍: DateRange): Promise<FactSlice> {
        return { rows: [], grain: "daily" };
    }
    async getChangeEvents(): Promise<ChangeEvent[]> {
        return [];
    }
    async getGoogleEstimates(): Promise<GoogleEstimates> {
        return { simulations: [], recommendations: [], warnings: [] };
    }
    async coverage(): Promise<DateRange | null> {
        return null;
    }
    async invalidate(): Promise<void> { }
}
