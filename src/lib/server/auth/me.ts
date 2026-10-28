import "server-only";
import { AGENCY_WORKSPACE, permissionsFor, UNASSIGNED_WORKSPACE } from "@/lib/domain/auth/roles";
import type { MeResponse, WorkspaceInfo } from "@/lib/domain/contracts/auth";
import { authConfig } from "../env/config";
import { currentWorkspace, type Principal } from "../scope";
import { getGlobalStore } from "../store";
import { listClientRecords } from "./clients";
import { googleSignInEnabled } from "./google";
import { toUserView } from "./users";
export async function workspaceInfo(workspaceId = currentWorkspace()): Promise<WorkspaceInfo> {
    if (workspaceId === AGENCY_WORKSPACE)
        return { id: AGENCY_WORKSPACE, kind: "agency", name: "SAVD agency" };
    if (workspaceId === UNASSIGNED_WORKSPACE)
        return { id: UNASSIGNED_WORKSPACE, kind: "client", name: "No client yet" };
    const client = await getGlobalStore().clients.get(workspaceId);
    return { id: workspaceId, kind: "client", name: client?.name ?? "Client" };
}
export async function buildMe(principal: Principal): Promise<MeResponse> {
    const [user, clients] = await Promise.all([principal.userId ? getGlobalStore().users.get(principal.userId) : null, listClientRecords()]);
    const clientName = user?.clientId ? (clients.find((c) => c.id === user.clientId)?.name ?? null) : null;
    return {
        authMode: authConfig().mode,
        user: user ? toUserView(user, clientName) : null,
        permissions: permissionsFor(principal.role),
        workspace: await workspaceInfo(),
        googleSignIn: googleSignInEnabled(),
        mfaSetupRequired: !!principal.mfaSetupRequired,
    };
}
