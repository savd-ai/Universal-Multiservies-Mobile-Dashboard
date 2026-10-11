import { NoAccess } from "@/components/shell/no-access";
import { ConnectionScreen } from "@/features/data-source/connection-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("system.manage")))
        return <NoAccess what="the data source settings"/>;
    return <ConnectionScreen />;
}
