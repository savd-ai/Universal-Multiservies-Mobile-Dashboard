import { DashboardScreen } from "@/features/dashboards/dashboard-screen";
export default async function Page({ params }: {
    params: Promise<{
        dashboardId: string;
    }>;
}) {
    const { dashboardId } = await params;
    return <DashboardScreen dashboardId={dashboardId}/>;
}
