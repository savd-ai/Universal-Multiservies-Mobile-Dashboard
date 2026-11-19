import { NoAccess } from "@/components/shell/no-access";
import { PluginsScreen } from "@/features/plugins/plugins-screen";
import { pageAllows } from "@/lib/server/auth/gate";

export default async function Page() {
  if (!(await pageAllows("plugins.manage"))) return <NoAccess what="plugin management" />;
  return <PluginsScreen />;
}
