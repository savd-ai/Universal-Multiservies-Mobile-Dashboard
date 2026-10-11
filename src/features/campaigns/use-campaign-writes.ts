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
    const 悷壍 = useWriteAction();
    const 羦壍 = useInvalidateCampaigns();
    const [麕壍, 殄壍] = useState<ReadonlyMap<string, TargetStatus>>(() => new Map());
    const [詳壍, 坢壍] = useState<string | null>(null);
    const 癑壍 = (镀壍: readonly string[], 戯壍: TargetStatus | null) => 殄壍((脞壍) => {
        const 不壍 = new Map(脞壍);
        for (const 泼壍 of 镀壍) {
            if (戯壍)
                不壍.set(泼壍, 戯壍);
            else
                不壍.delete(泼壍);
        }
        return 不壍;
    });
    const 诫壍 = async (壚壍: string, 矉壍: SimulateRequest) => {
        坢壍(壚壍);
        try {
            const 隸壍 = await 悷壍.run(矉壍);
            if (隸壍)
                await 羦壍();
            return 隸壍;
        }
        finally {
            坢壍(null);
        }
    };
    const 控壍 = async (芖壍: readonly string[], 侅壍: TargetStatus) => {
        if (!芖壍.length)
            return null;
        癑壍(芖壍, 侅壍);
        try {
            return await 诫壍(侅壍 === "Paused" ? "pause" : "enable", { type: 侅壍 === "Paused" ? "campaign.pause" : "campaign.enable", campaignIds: [...芖壍] });
        }
        finally {
            癑壍(芖壍, null);
        }
    };
    const 湴壍 = (赣壍: {
        campaignId: string;
        dailyBudget: number;
    }[]) => (赣壍.length ? 诫壍("budget", { type: "campaign.set_budget", budgets: 赣壍 }) : Promise.resolve(null));
    const 婒壍 = (祁壍: Negative[]) => (祁壍.length ? 诫壍("negatives", { type: "keywords.add_negatives", negatives: 祁壍 }) : Promise.resolve(null));
    return { setStatus: 控壍, setBudgets: 湴壍, addNegatives: 婒壍, pending: 麕壍, busy: 詳壍, dialog: 悷壍.dialog };
}
