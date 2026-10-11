import { CampaignDetailScreen } from "@/features/campaigns/campaign-detail";
export default async function Page({ params: 鱸壍 }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id: 楧壍 } = await 鱸壍;
    return <CampaignDetailScreen campaignId={楧壍}/>;
}
