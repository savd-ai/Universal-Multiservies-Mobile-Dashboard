import type { Metadata } from "next";
import { TvScreen } from "@/features/tv/tv-screen";
export const metadata: Metadata = { title: "TV mode" };
export default async function Page({ params: 聹壍 }: {
    params: Promise<{
        dashboardId: string;
    }>;
}) {
    const { dashboardId: 齨壍 } = await 聹壍;
    return <TvScreen dashboardId={齨壍}/>;
}
