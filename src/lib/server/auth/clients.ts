import "server-only";
import { randomBytes } from "node:crypto";
import { AGENCY_WORKSPACE, clientForAccount } from "@/lib/domain/auth/roles";
import type { ClientInput, ClientView, DirectoryAccount } from "@/lib/domain/contracts/auth";
import { defaultSettings } from "@/lib/domain/contracts/settings";
import type { AccountInfo } from "@/lib/domain/types";
import { resolveGoogleAds } from "../datasource/resolver";
import { AppError } from "../http/errors";
import { log } from "../log";
import { invalidateQueryCache } from "../query/service";
import { audit, getGlobalStore, getWorkspaceStore } from "../store";
import type { Collection, BaseRecord } from "../store/store";
import type { ClientRecord } from "./records";
export async function listClientRecords(): Promise<ClientRecord[]> {
    return getGlobalStore().clients.list();
}
export async function directoryAccounts(): Promise<AccountInfo[]> {
    try {
        const { source } = await resolveGoogleAds();
        return (await source.listAccounts()).filter((a) => !a.isManager);
    }
    catch (err) {
        log.warn("account directory unavailable", { error: (err as Error).message });
        return [];
    }
}
async function userCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const u of await getGlobalStore().users.list())
        if (u.clientId)
            counts.set(u.clientId, (counts.get(u.clientId) ?? 0) + 1);
    return counts;
}
function toView(c: ClientRecord, directory: readonly AccountInfo[], users: Map<string, number>): ClientView {
    const known = new Map(directory.map((a) => [a.id, a]));
    return {
        id: c.id,
        name: c.name,
        notes: c.notes,
        accountIds: [...c.accountIds],
        accounts: c.accountIds.flatMap((id) => {
            const a = known.get(id);
            return a ? [{ id: a.id, name: a.name, currency: a.currency }] : [];
        }),
        missingAccountIds: directory.length ? c.accountIds.filter((id) => !known.has(id)) : [],
        userCount: users.get(c.id) ?? 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}
export async function listClients(): Promise<ClientView[]> {
    const [clients, directory, users] = await Promise.all([listClientRecords(), directoryAccounts(), userCounts()]);
    return clients.sort((a, b) => a.name.localeCompare(b.name)).map((c) => toView(c, directory, users));
}
export async function accountDirectory(): Promise<DirectoryAccount[]> {
    const [clients, directory] = await Promise.all([listClientRecords(), directoryAccounts()]);
    return directory.map((a) => {
        const owner = clientForAccount(a.id, clients);
        return { id: a.id, name: a.name, currency: a.currency, clientId: owner?.id ?? null, clientName: owner?.name ?? null };
    });
}
async function assertAssignable(accountIds: readonly string[], clientId: string | null): Promise<void> {
    const clients = await listClientRecords();
    const taken = accountIds.flatMap((id) => {
        const owner = clientForAccount(id, clients);
        return owner && owner.id !== clientId ? [`${id} (${owner.name})`] : [];
    });
    if (taken.length)
        throw new AppError("CONFLICT", `Already assigned to another client: ${taken.join(", ")}. Remove it there first.`);
    const directory = await directoryAccounts();
    if (directory.length) {
        const known = new Set(directory.map((a) => a.id));
        const unknown = accountIds.filter((id) => !known.has(id));
        if (unknown.length)
            throw new AppError("VALIDATION_ERROR", `Not reachable with the agency's Google Ads credentials: ${unknown.join(", ")}`);
    }
}
async function move<T extends BaseRecord>(collection: Collection<T>, to: Collection<T>, filter: (t: T) => boolean): Promise<number> {
    const taken = await collection.take(filter);
    await to.restore(taken);
    return taken.length;
}
export async function moveAccountData(accountIds: readonly string[], fromWs: string, toWs: string): Promise<number> {
    if (fromWs === toWs || !accountIds.length)
        return 0;
    const ids = new Set(accountIds);
    const src = getWorkspaceStore(fromWs);
    const dst = getWorkspaceStore(toWs);
    const acct = (key: string) => key.split(":")[1] ?? "";
    const counts = await Promise.all([
        move(src.signalStates as unknown as Collection<BaseRecord & {
            scopeKey: string;
        }>, dst.signalStates as unknown as Collection<BaseRecord & {
            scopeKey: string;
        }>, (r) => ids.has(acct(r.scopeKey))),
        move(src.budgetTargets, dst.budgetTargets, (r) => ids.has(acct(r.id))),
        move(src.budgetPlans, dst.budgetPlans, (r) => !!r.accountId && ids.has(r.accountId)),
        move(src.annotations, dst.annotations, (r) => !!r.accountId && ids.has(r.accountId)),
    ]);
    return counts.reduce((a, b) => a + b, 0);
}
async function initWorkspace(client: ClientRecord, startFrom: ClientInput["startFrom"], settingsOverride?: Partial<ReturnType<typeof defaultSettings>>): Promise<void> {
    const ws = getWorkspaceStore(client.id);
    const brand = client.name.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    await ws.settings.set({ ...defaultSettings(), businessContext: "", brandTerms: brand ? [brand] : [], competitorTerms: [], ...settingsOverride });
    if (startFrom !== "agency")
        return;
    const agency = getWorkspaceStore(AGENCY_WORKSPACE);
    const [dashboards, questions, metrics, anomaly] = await Promise.all([agency.dashboards.list(), agency.questions.list(), agency.customMetrics.list(), agency.anomalySettings.get()]);
    await ws.dashboards.take(() => true);
    await ws.dashboards.restore(dashboards);
    await ws.questions.restore(questions);
    await ws.customMetrics.restore(metrics);
    await ws.anomalySettings.set(anomaly);
}
function newClientId(): string {
    return `c-${randomBytes(5).toString("hex")}`;
}
export async function createClient(input: ClientInput, opts: {
    settings?: Partial<ReturnType<typeof defaultSettings>>;
} = {}): Promise<ClientView> {
    const accountIds = [...new Set(input.accountIds)];
    await assertAssignable(accountIds, null);
    const store = getGlobalStore();
    if ((await store.clients.list((c) => c.name.toLowerCase() === input.name.toLowerCase())).length)
        throw new AppError("CONFLICT", "A client with this name already exists");
    const client = await store.clients.create({ id: newClientId(), name: input.name, accountIds, notes: input.notes });
    await initWorkspace(client, input.startFrom, opts.settings);
    const moved = await moveAccountData(accountIds, AGENCY_WORKSPACE, client.id);
    invalidateQueryCache();
    await audit({ actor: "user", action: "client.create", target: client.name, summary: `Created client ${client.name} with ${accountIds.length} account(s)`, details: { clientId: client.id, accountIds, movedRecords: moved } });
    return toView(client, await directoryAccounts(), await userCounts());
}
export async function updateClient(id: string, patch: Partial<Omit<ClientInput, "startFrom">>): Promise<ClientView> {
    const store = getGlobalStore();
    const prev = await store.clients.get(id);
    if (!prev)
        throw new AppError("NOT_FOUND", "Client not found");
    if (patch.name && patch.name.toLowerCase() !== prev.name.toLowerCase() && (await store.clients.list((c) => c.id !== id && c.name.toLowerCase() === patch.name!.toLowerCase())).length) {
        throw new AppError("CONFLICT", "A client with this name already exists");
    }
    const accountIds = patch.accountIds ? [...new Set(patch.accountIds)] : prev.accountIds;
    const added = accountIds.filter((a) => !prev.accountIds.includes(a));
    const removed = prev.accountIds.filter((a) => !accountIds.includes(a));
    if (added.length)
        await assertAssignable(added, id);
    const next = await store.clients.update(id, { name: patch.name ?? prev.name, notes: patch.notes ?? prev.notes, accountIds });
    const moved = (await moveAccountData(added, AGENCY_WORKSPACE, id)) + (await moveAccountData(removed, id, AGENCY_WORKSPACE));
    if (added.length || removed.length)
        invalidateQueryCache();
    await audit({ actor: "user", action: "client.update", target: next.name, summary: `Updated client ${next.name}`, details: { clientId: id, added, removed, movedRecords: moved } });
    return toView(next, await directoryAccounts(), await userCounts());
}
export async function deleteClient(id: string): Promise<void> {
    const store = getGlobalStore();
    const prev = await store.clients.get(id);
    if (!prev)
        throw new AppError("NOT_FOUND", "Client not found");
    const users = await store.users.list((u) => u.clientId === id);
    if (users.length)
        throw new AppError("CONFLICT", `Remove or move this client's ${users.length} user(s) first`);
    await moveAccountData(prev.accountIds, id, AGENCY_WORKSPACE);
    await store.clients.delete(id);
    invalidateQueryCache();
    await audit({ actor: "user", action: "client.delete", target: prev.name, summary: `Deleted client ${prev.name}; its accounts returned to the agency`, details: { clientId: id, accountIds: prev.accountIds } });
}
