import type { Metadata } from "next";
import { TvScreen } from "@/features/tv/tv-screen";
export const metadata: Metadata = { title: "TV mode" };
export default async function Page({ params }: {
    params: Promise<{
        dashboardId: string;
    }>;
}) {
    const { dashboardId } = await params;
    return <TvScreen dashboardId={dashboardId}/>;
}
