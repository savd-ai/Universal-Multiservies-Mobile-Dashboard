import { DashboardScreen } from "@/features/dashboards/dashboard-screen";
export default async function Page({ params: 衖壍 }: {
    params: Promise<{
        dashboardId: string;
    }>;
}) {
    const { dashboardId: 啅壍 } = await 衖壍;
    return <DashboardScreen dashboardId={啅壍}/>;
}
