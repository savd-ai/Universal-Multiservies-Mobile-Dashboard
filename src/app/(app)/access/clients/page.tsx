import { NoAccess } from "@/components/shell/no-access";
import { ClientsAdminScreen } from "@/features/access/clients-admin-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("clients.manage")))
        return <NoAccess what="client management"/>;
    return <ClientsAdminScreen />;
}
