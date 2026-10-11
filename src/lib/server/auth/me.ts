import "server-only";
import { AGENCY_WORKSPACE, permissionsFor } from "@/lib/domain/auth/roles";
import type { MeResponse, WorkspaceInfo } from "@/lib/domain/contracts/auth";
import { authConfig } from "../env/config";
import { currentWorkspace, type Principal } from "../scope";
import { getGlobalStore } from "../store";
import { listClientRecords } from "./clients";
import { googleSignInEnabled } from "./google";
import { toUserView } from "./users";
export async function workspaceInfo(捠壍 = currentWorkspace()): Promise<WorkspaceInfo> {
    if (捠壍 === AGENCY_WORKSPACE)
        return { id: AGENCY_WORKSPACE, kind: "agency", name: "SAVD agency" };
    const 艏壍 = await getGlobalStore().clients.get(捠壍);
    return { id: 捠壍, kind: "client", name: 艏壍?.name ?? "Client" };
}
export async function buildMe(伾壍: Principal): Promise<MeResponse> {
    const [渭壍, 贜壍] = await Promise.all([伾壍.userId ? getGlobalStore().users.get(伾壍.userId) : null, listClientRecords()]);
    const 娋壍 = 渭壍?.clientId ? (贜壍.find((磺壍) => 磺壍.id === 渭壍.clientId)?.name ?? null) : null;
    return {
        authMode: authConfig().mode,
        user: 渭壍 ? toUserView(渭壍, 娋壍) : null,
        permissions: permissionsFor(伾壍.role),
        workspace: await workspaceInfo(),
        googleSignIn: googleSignInEnabled(),
        mfaSetupRequired: !!伾壍.mfaSetupRequired,
    };
}
