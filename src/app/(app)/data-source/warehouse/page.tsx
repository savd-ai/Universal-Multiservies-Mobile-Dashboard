import { NoAccess } from "@/components/shell/no-access";
import { WarehouseScreen } from "@/features/data-source/warehouse-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("system.manage")))
        return <NoAccess what="the analytics warehouse"/>;
    return <WarehouseScreen />;
}
