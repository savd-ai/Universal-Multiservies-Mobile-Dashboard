import { NoAccess } from "@/components/shell/no-access";
import { RulesScreen } from "@/features/anomalies/rules-screen";
import { pageAllows } from "@/lib/server/auth/gate";
export default async function Page() {
    if (!(await pageAllows("rules.manage")))
        return <NoAccess what="the detection rules"/>;
    return <RulesScreen />;
}
