import "server-only";
import type { ReadOnlyAlternatives, SimulateRequest } from "@/lib/domain/contracts/actions";
import { changeListLine, editorBudgetCsv } from "@/lib/domain/budget/exports";
import { toCsv } from "@/lib/domain/query/csv";
import { formatKeyword } from "@/lib/domain/schema/dimensions";
import type { CampaignDim } from "@/lib/domain/schema/facts";
import { deepLink } from "../campaigns";
export function readOnlyAlternatives(accountId: string, campaigns: ReadonlyMap<string, CampaignDim>, req: SimulateRequest, currency = "USD", adGroups: ReadonlyMap<string, {
    name: string;
}> = new Map()): ReadOnlyAlternatives {
    const name = (id: string) => campaigns.get(id)?.name ?? id;
    const adGroupName = (id?: string) => (id ? (adGroups.get(id)?.name ?? id) : "");
    const ids = req.type === "campaign.pause" || req.type === "campaign.enable" ? req.campaignIds : req.type === "keywords.add_negatives" ? [...new Set(req.negatives.map((n) => n.campaignId))] : req.budgets.map((b) => b.campaignId);
    const deepLinks = [...new Set(ids)].slice(0, 50).map((id) => ({ label: `Open “${name(id)}” in Google Ads ↗`, url: deepLink(accountId, id) }));
    switch (req.type) {
        case "campaign.pause":
        case "campaign.enable": {
            const status = req.type === "campaign.pause" ? "Paused" : "Enabled";
            const verb = req.type === "campaign.pause" ? "Pause" : "Enable";
            const editor = editorBudgetCsv(req.campaignIds.map((id) => ({ campaign: name(id), campaignId: id, dailyBudget: campaigns.get(id)?.budget_daily ?? 0, status })));
            return { deepLinks, changeList: req.campaignIds.map((id) => `${verb} campaign '${name(id)}'`), editorCsv: editor.csv };
        }
        case "campaign.set_budget":
        case "budget.apply_plan": {
            const changeList = req.budgets.map((b) => changeListLine({ name: name(b.campaignId), from: campaigns.get(b.campaignId)?.budget_daily ?? null, to: b.dailyBudget }, currency));
            const editor = editorBudgetCsv(req.budgets.map((b) => ({ campaign: name(b.campaignId), campaignId: b.campaignId, dailyBudget: b.dailyBudget, status: campaigns.get(b.campaignId)?.status ?? "Enabled" })));
            return { deepLinks, changeList, editorCsv: editor.csv };
        }
        case "keywords.add_negatives": {
            const changeList = req.negatives.map((n) => `Add negative keyword ${formatKeyword(n.text, n.matchType)} (${n.matchType}) to campaign '${name(n.campaignId)}'`);
            const editorCsv = toCsv(["Campaign", "Ad group", "Keyword", "Criterion Type"], req.negatives.map((n) => [name(n.campaignId), adGroupName(n.adGroupId), n.text, `${n.adGroupId ? "Negative" : "Campaign negative"} ${n.matchType.toLowerCase()}`]), false);
            return { deepLinks, changeList, editorCsv };
        }
    }
}
