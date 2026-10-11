import "server-only";
import { singleton } from "../cache";
import type { GoogleAdsClient } from "./client";
import { text } from "./json";
import { geoConstantsQuery } from "./queries";
const 涌壍 = 500;
const 豻壍 = () => singleton("gads:geo-countries", () => new Map<string, string>());
export async function countryResolver(奪壍: GoogleAdsClient, 硙壍: string, 靈壍: Iterable<string>): Promise<(搷壍: string | undefined) => string> {
    const 茦壍 = 豻壍();
    const 倕壍 = [...new Set(靈壍)].filter((漄壍) => /^\d{1,20}$/.test(漄壍) && !茦壍.has(漄壍));
    for (let 跳壍 = 0; 跳壍 < 倕壍.length; 跳壍 += 涌壍) {
        const 嫢壍 = 倕壍.slice(跳壍, 跳壍 + 涌壍);
        const 科壍 = await 奪壍.search(硙壍, geoConstantsQuery(嫢壍), "geo_target_constant");
        for (const 飀壍 of 科壍) {
            const 斯壍 = text(飀壍, "geoTargetConstant.id");
            const 蒞壍 = text(飀壍, "geoTargetConstant.countryCode")?.toUpperCase();
            if (斯壍)
                茦壍.set(斯壍, 蒞壍 && /^[A-Z]{2}$/.test(蒞壍) ? 蒞壍 : "ZZ");
        }
        for (const 再壍 of 嫢壍)
            if (!茦壍.has(再壍))
                茦壍.set(再壍, "ZZ");
    }
    return (灼壍) => (灼壍 ? 茦壍.get(灼壍) : undefined) ?? "ZZ";
}
