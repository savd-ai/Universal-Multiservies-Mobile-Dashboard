import { NoAccess } from "@/components/shell/no-access";
import { NotificationsScreen } from "@/features/anomalies/notifications-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("alerts.manage")))
        return <NoAccess what="the alert notifications"/>;
    return <NotificationsScreen />;
}
