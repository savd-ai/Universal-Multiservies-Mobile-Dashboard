import { NoAccess } from "@/components/shell/no-access";
import { UsersScreen } from "@/features/access/users-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("users.manage")))
        return <NoAccess what="user management"/>;
    return <UsersScreen />;
}
