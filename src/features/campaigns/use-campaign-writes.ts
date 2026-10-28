"use client";
import { useState } from "react";
import { useWriteAction } from "@/components/ui/live-guard";
import { useInvalidateCampaigns } from "@/lib/api/campaigns";
import type { SimulateRequest } from "@/lib/domain/contracts/actions";
export type TargetStatus = "Enabled" | "Paused";
type Negative = Extract<SimulateRequest, {
    type: "keywords.add_negatives";
}>["negatives"][number];
export function useCampaignWrites() {
    const write = useWriteAction();
    const refresh = useInvalidateCampaigns();
    const [pending, setPending] = useState<ReadonlyMap<string, TargetStatus>>(() => new Map());
    const [busy, setBusy] = useState<string | null>(null);
    const mark = (ids: readonly string[], status: TargetStatus | null) => setPending((prev) => {
        const next = new Map(prev);
        for (const id of ids) {
            if (status)
                next.set(id, status);
            else
                next.delete(id);
        }
        return next;
    });
    const exec = async (label: string, body: SimulateRequest) => {
        setBusy(label);
        try {
            const action = await write.run(body);
            if (action)
                await refresh();
            return action;
        }
        finally {
            setBusy(null);
        }
    };
    const setStatus = async (ids: readonly string[], status: TargetStatus) => {
        if (!ids.length)
            return null;
        mark(ids, status);
        try {
            return await exec(status === "Paused" ? "pause" : "enable", { type: status === "Paused" ? "campaign.pause" : "campaign.enable", campaignIds: [...ids] });
        }
        finally {
            mark(ids, null);
        }
    };
    const setBudgets = (budgets: {
        campaignId: string;
        dailyBudget: number;
    }[]) => (budgets.length ? exec("budget", { type: "campaign.set_budget", budgets }) : Promise.resolve(null));
    const addNegatives = (negatives: Negative[]) => (negatives.length ? exec("negatives", { type: "keywords.add_negatives", negatives }) : Promise.resolve(null));
    return { setStatus, setBudgets, addNegatives, pending, busy, dialog: write.dialog };
}
