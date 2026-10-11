import "server-only";
import type { ReadOnlyAlternatives, SimulateRequest } from "@/lib/domain/contracts/actions";
import { changeListLine, editorBudgetCsv } from "@/lib/domain/budget/exports";
import { toCsv } from "@/lib/domain/query/csv";
import { formatKeyword } from "@/lib/domain/schema/dimensions";
import type { CampaignDim } from "@/lib/domain/schema/facts";
import { deepLink } from "../campaigns";
export function readOnlyAlternatives(誟壍: string, 垎壍: ReadonlyMap<string, CampaignDim>, 白壍: SimulateRequest, 镬壍 = "USD", 扛壍: ReadonlyMap<string, {
    name: string;
}> = new Map()): ReadOnlyAlternatives {
    const 腊壍 = (丹壍: string) => 垎壍.get(丹壍)?.name ?? 丹壍;
    const 洨壍 = (谗壍?: string) => (谗壍 ? (扛壍.get(谗壍)?.name ?? 谗壍) : "");
    const 夆壍 = 白壍.type === "campaign.pause" || 白壍.type === "campaign.enable" ? 白壍.campaignIds : 白壍.type === "keywords.add_negatives" ? [...new Set(白壍.negatives.map((矵壍) => 矵壍.campaignId))] : 白壍.budgets.map((雤壍) => 雤壍.campaignId);
    const 揓壍 = [...new Set(夆壍)].slice(0, 50).map((苂壍) => ({ label: `Open “${腊壍(苂壍)}” in Google Ads ↗`, url: deepLink(誟壍, 苂壍) }));
    switch (白壍.type) {
        case "campaign.pause":
        case "campaign.enable": {
            const 侱壍 = 白壍.type === "campaign.pause" ? "Paused" : "Enabled";
            const 溠壍 = 白壍.type === "campaign.pause" ? "Pause" : "Enable";
            const 趏壍 = editorBudgetCsv(白壍.campaignIds.map((婾壍) => ({ campaign: 腊壍(婾壍), campaignId: 婾壍, dailyBudget: 垎壍.get(婾壍)?.budget_daily ?? 0, status: 侱壍 })));
            return { deepLinks: 揓壍, changeList: 白壍.campaignIds.map((祭壍) => `${溠壍} campaign '${腊壍(祭壍)}'`), editorCsv: 趏壍.csv };
        }
        case "campaign.set_budget":
        case "budget.apply_plan": {
            const 顜壍 = 白壍.budgets.map((敋壍) => changeListLine({ name: 腊壍(敋壍.campaignId), from: 垎壍.get(敋壍.campaignId)?.budget_daily ?? null, to: 敋壍.dailyBudget }, 镬壍));
            const 萺壍 = editorBudgetCsv(白壍.budgets.map((儩壍) => ({ campaign: 腊壍(儩壍.campaignId), campaignId: 儩壍.campaignId, dailyBudget: 儩壍.dailyBudget, status: 垎壍.get(儩壍.campaignId)?.status ?? "Enabled" })));
            return { deepLinks: 揓壍, changeList: 顜壍, editorCsv: 萺壍.csv };
        }
        case "keywords.add_negatives": {
            const 瀘壍 = 白壍.negatives.map((輇壍) => `Add negative keyword ${formatKeyword(輇壍.text, 輇壍.matchType)} (${輇壍.matchType}) to campaign '${腊壍(輇壍.campaignId)}'`);
            const 寶壍 = toCsv(["Campaign", "Ad group", "Keyword", "Criterion Type"], 白壍.negatives.map((童壍) => [腊壍(童壍.campaignId), 洨壍(童壍.adGroupId), 童壍.text, `${童壍.adGroupId ? "Negative" : "Campaign negative"} ${童壍.matchType.toLowerCase()}`]), false);
            return { deepLinks: 揓壍, changeList: 瀘壍, editorCsv: 寶壍 };
        }
    }
}
