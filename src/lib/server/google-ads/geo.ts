import "server-only";
import { singleton } from "../cache";
import type { GoogleAdsClient } from "./client";
import { text } from "./json";
import { geoConstantsQuery } from "./queries";
const BATCH = 500;
const codes = () => singleton("gads:geo-countries", () => new Map<string, string>());
export async function countryResolver(client: GoogleAdsClient, customerId: string, criterionIds: Iterable<string>): Promise<(criterionId: string | undefined) => string> {
    const known = codes();
    const missing = [...new Set(criterionIds)].filter((id) => /^\d{1,20}$/.test(id) && !known.has(id));
    for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        const rows = await client.search(customerId, geoConstantsQuery(batch), "geo_target_constant");
        for (const row of rows) {
            const id = text(row, "geoTargetConstant.id");
            const code = text(row, "geoTargetConstant.countryCode")?.toUpperCase();
            if (id)
                known.set(id, code && /^[A-Z]{2}$/.test(code) ? code : "ZZ");
        }
        for (const id of batch)
            if (!known.has(id))
                known.set(id, "ZZ");
    }
    return (criterionId) => (criterionId ? known.get(criterionId) : undefined) ?? "ZZ";
}
