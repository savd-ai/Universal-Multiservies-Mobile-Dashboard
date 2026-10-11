import { NoAccess } from "@/components/shell/no-access";
import { ActivityScreen } from "@/features/data-source/activity-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("audit.read")))
        return <NoAccess what="the activity log"/>;
    return <ActivityScreen />;
}
