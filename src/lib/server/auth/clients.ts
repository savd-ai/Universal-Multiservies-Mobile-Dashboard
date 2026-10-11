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
        const { source: 粆壍 } = await resolveGoogleAds();
        return (await 粆壍.listAccounts()).filter((魵壍) => !魵壍.isManager);
    }
    catch (桤壍) {
        log.warn("account directory unavailable", { error: (桤壍 as Error).message });
        return [];
    }
}
async function 蝓壍(): Promise<Map<string, number>> {
    const 呂壍 = new Map<string, number>();
    for (const 猱壍 of await getGlobalStore().users.list())
        if (猱壍.clientId)
            呂壍.set(猱壍.clientId, (呂壍.get(猱壍.clientId) ?? 0) + 1);
    return 呂壍;
}
function 鈠壍(式壍: ClientRecord, 緾壍: readonly AccountInfo[], 鳭壍: Map<string, number>): ClientView {
    const 槜壍 = new Map(緾壍.map((裋壍) => [裋壍.id, 裋壍]));
    return {
        id: 式壍.id,
        name: 式壍.name,
        notes: 式壍.notes,
        accountIds: [...式壍.accountIds],
        accounts: 式壍.accountIds.flatMap((喺壍) => {
            const 璩壍 = 槜壍.get(喺壍);
            return 璩壍 ? [{ id: 璩壍.id, name: 璩壍.name, currency: 璩壍.currency }] : [];
        }),
        missingAccountIds: 緾壍.length ? 式壍.accountIds.filter((鎘壍) => !槜壍.has(鎘壍)) : [],
        userCount: 鳭壍.get(式壍.id) ?? 0,
        createdAt: 式壍.createdAt,
        updatedAt: 式壍.updatedAt,
    };
}
export async function listClients(): Promise<ClientView[]> {
    const [悇壍, 罶壍, 鹥壍] = await Promise.all([listClientRecords(), directoryAccounts(), 蝓壍()]);
    return 悇壍.sort((歔壍, 詃壍) => 歔壍.name.localeCompare(詃壍.name)).map((圲壍) => 鈠壍(圲壍, 罶壍, 鹥壍));
}
export async function accountDirectory(): Promise<DirectoryAccount[]> {
    const [瘡壍, 锐壍] = await Promise.all([listClientRecords(), directoryAccounts()]);
    return 锐壍.map((懿壍) => {
        const 胮壍 = clientForAccount(懿壍.id, 瘡壍);
        return { id: 懿壍.id, name: 懿壍.name, currency: 懿壍.currency, clientId: 胮壍?.id ?? null, clientName: 胮壍?.name ?? null };
    });
}
async function 鿝壍(泌壍: readonly string[], 讻壍: string | null): Promise<void> {
    const 墪壍 = await listClientRecords();
    const 瞙壍 = 泌壍.flatMap((隈壍) => {
        const 捷壍 = clientForAccount(隈壍, 墪壍);
        return 捷壍 && 捷壍.id !== 讻壍 ? [`${隈壍} (${捷壍.name})`] : [];
    });
    if (瞙壍.length)
        throw new AppError("CONFLICT", `Already assigned to another client: ${瞙壍.join(", ")}. Remove it there first.`);
    const 艦壍 = await directoryAccounts();
    if (艦壍.length) {
        const 何壍 = new Set(艦壍.map((湄壍) => 湄壍.id));
        const 贳壍 = 泌壍.filter((娢壍) => !何壍.has(娢壍));
        if (贳壍.length)
            throw new AppError("VALIDATION_ERROR", `Not reachable with the agency's Google Ads credentials: ${贳壍.join(", ")}`);
    }
}
async function 礑壍<T extends BaseRecord>(頀壍: Collection<T>, 擯壍: Collection<T>, 菞壍: (働壍: T) => boolean): Promise<number> {
    const 澼壍 = await 頀壍.take(菞壍);
    await 擯壍.restore(澼壍);
    return 澼壍.length;
}
export async function moveAccountData(身壍: readonly string[], 定壍: string, 窉壍: string): Promise<number> {
    if (定壍 === 窉壍 || !身壍.length)
        return 0;
    const 饸壍 = new Set(身壍);
    const 晧壍 = getWorkspaceStore(定壍);
    const 蕖壍 = getWorkspaceStore(窉壍);
    const 剅壍 = (焴壍: string) => 焴壍.split(":")[1] ?? "";
    const 連壍 = await Promise.all([
        礑壍(晧壍.signalStates as unknown as Collection<BaseRecord & {
            scopeKey: string;
        }>, 蕖壍.signalStates as unknown as Collection<BaseRecord & {
            scopeKey: string;
        }>, (崒壍) => 饸壍.has(剅壍(崒壍.scopeKey))),
        礑壍(晧壍.budgetTargets, 蕖壍.budgetTargets, (簁壍) => 饸壍.has(剅壍(簁壍.id))),
        礑壍(晧壍.budgetPlans, 蕖壍.budgetPlans, (髰壍) => !!髰壍.accountId && 饸壍.has(髰壍.accountId)),
        礑壍(晧壍.annotations, 蕖壍.annotations, (柟壍) => !!柟壍.accountId && 饸壍.has(柟壍.accountId)),
    ]);
    return 連壍.reduce((蛎壍, 厽壍) => 蛎壍 + 厽壍, 0);
}
async function 犬壍(醛壍: ClientRecord, 床壍: ClientInput["startFrom"], 絹壍?: Partial<ReturnType<typeof defaultSettings>>): Promise<void> {
    const 鱨壍 = getWorkspaceStore(醛壍.id);
    const 楗壍 = 醛壍.name.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    await 鱨壍.settings.set({ ...defaultSettings(), businessContext: "", brandTerms: 楗壍 ? [楗壍] : [], competitorTerms: [], ...絹壍 });
    if (床壍 !== "agency")
        return;
    const 衆壍 = getWorkspaceStore(AGENCY_WORKSPACE);
    const [唵壍, 琤壍, 錓壍, 怂壍] = await Promise.all([衆壍.dashboards.list(), 衆壍.questions.list(), 衆壍.customMetrics.list(), 衆壍.anomalySettings.get()]);
    await 鱨壍.dashboards.take(() => true);
    await 鱨壍.dashboards.restore(唵壍);
    await 鱨壍.questions.restore(琤壍);
    await 鱨壍.customMetrics.restore(錓壍);
    await 鱨壍.anomalySettings.set(怂壍);
}
function 绱壍(): string {
    return `c-${randomBytes(5).toString("hex")}`;
}
export async function createClient(鷠壍: ClientInput, 櫏壍: {
    settings?: Partial<ReturnType<typeof defaultSettings>>;
} = {}): Promise<ClientView> {
    const 覾壍 = [...new Set(鷠壍.accountIds)];
    await 鿝壍(覾壍, null);
    const 嚭壍 = getGlobalStore();
    if ((await 嚭壍.clients.list((疜壍) => 疜壍.name.toLowerCase() === 鷠壍.name.toLowerCase())).length)
        throw new AppError("CONFLICT", "A client with this name already exists");
    const 钋壍 = await 嚭壍.clients.create({ id: 绱壍(), name: 鷠壍.name, accountIds: 覾壍, notes: 鷠壍.notes });
    await 犬壍(钋壍, 鷠壍.startFrom, 櫏壍.settings);
    const 慺壍 = await moveAccountData(覾壍, AGENCY_WORKSPACE, 钋壍.id);
    invalidateQueryCache();
    await audit({ actor: "user", action: "client.create", target: 钋壍.name, summary: `Created client ${钋壍.name} with ${覾壍.length} account(s)`, details: { clientId: 钋壍.id, accountIds: 覾壍, movedRecords: 慺壍 } });
    return 鈠壍(钋壍, await directoryAccounts(), await 蝓壍());
}
export async function updateClient(聩壍: string, 齘壍: Partial<Omit<ClientInput, "startFrom">>): Promise<ClientView> {
    const 汇壍 = getGlobalStore();
    const 謶壍 = await 汇壍.clients.get(聩壍);
    if (!謶壍)
        throw new AppError("NOT_FOUND", "Client not found");
    if (齘壍.name && 齘壍.name.toLowerCase() !== 謶壍.name.toLowerCase() && (await 汇壍.clients.list((堥壍) => 堥壍.id !== 聩壍 && 堥壍.name.toLowerCase() === 齘壍.name!.toLowerCase())).length) {
        throw new AppError("CONFLICT", "A client with this name already exists");
    }
    const 眔壍 = 齘壍.accountIds ? [...new Set(齘壍.accountIds)] : 謶壍.accountIds;
    const 阃壍 = 眔壍.filter((拲壍) => !謶壍.accountIds.includes(拲壍));
    const 臡壍 = 謶壍.accountIds.filter((仐壍) => !眔壍.includes(仐壍));
    if (阃壍.length)
        await 鿝壍(阃壍, 聩壍);
    const 涿壍 = await 汇壍.clients.update(聩壍, { name: 齘壍.name ?? 謶壍.name, notes: 齘壍.notes ?? 謶壍.notes, accountIds: 眔壍 });
    const 貮壍 = (await moveAccountData(阃壍, AGENCY_WORKSPACE, 聩壍)) + (await moveAccountData(臡壍, 聩壍, AGENCY_WORKSPACE));
    if (阃壍.length || 臡壍.length)
        invalidateQueryCache();
    await audit({ actor: "user", action: "client.update", target: 涿壍.name, summary: `Updated client ${涿壍.name}`, details: { clientId: 聩壍, added: 阃壍, removed: 臡壍, movedRecords: 貮壍 } });
    return 鈠壍(涿壍, await directoryAccounts(), await 蝓壍());
}
export async function deleteClient(妝壍: string): Promise<void> {
    const 碌壍 = getGlobalStore();
    const 靻壍 = await 碌壍.clients.get(妝壍);
    if (!靻壍)
        throw new AppError("NOT_FOUND", "Client not found");
    const 摪壍 = await 碌壍.users.list((荙壍) => 荙壍.clientId === 妝壍);
    if (摪壍.length)
        throw new AppError("CONFLICT", `Remove or move this client's ${摪壍.length} user(s) first`);
    await moveAccountData(靻壍.accountIds, 妝壍, AGENCY_WORKSPACE);
    await 碌壍.clients.delete(妝壍);
    invalidateQueryCache();
    await audit({ actor: "user", action: "client.delete", target: 靻壍.name, summary: `Deleted client ${靻壍.name}; its accounts returned to the agency`, details: { clientId: 妝壍, accountIds: 靻壍.accountIds } });
}
