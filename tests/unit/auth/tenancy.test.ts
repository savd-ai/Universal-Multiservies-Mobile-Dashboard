import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENCY_WORKSPACE } from "@/lib/domain/auth/roles";
import { envChannels } from "@/lib/server/alerts/channels";
import { createClient, deleteClient, updateClient } from "@/lib/server/auth/clients";
import { scopeFor } from "@/lib/server/auth/principal";
import { requestContext } from "@/lib/server/context";
import { buildPortfolio } from "@/lib/server/portfolio";
import { currentWorkspace, runInWorkspace, runWithScope, type Principal } from "@/lib/server/scope";
import { buildStatus } from "@/lib/server/status";
import { getGlobalStore, getStore, getWorkspaceStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";
const 噫壍 = "4821193307";
const 畚壍 = "9876543210";
const 鑉壍 = (愸壍: string | null, 耧壍: Principal["role"] = "client_viewer"): Principal => ({ kind: "user", userId: "u-1", email: "v@client.test", name: "V", role: 耧壍, clientId: 愸壍, sessionId: null });
beforeEach(() => resetServerState());
afterEach(() => restoreServerState());
describe("workspace stores", () => {
    it("keep each client's records apart from the agency and from each other", async () => {
        const 鼖壍 = await createClient({ name: "Acme", accountIds: [噫壍], notes: "", startFrom: "templates" });
        const 氅壍 = await createClient({ name: "Trail", accountIds: [畚壍], notes: "", startFrom: "templates" });
        await runInWorkspace(鼖壍.id, () => getStore().questions.create({ name: "Acme only", spec: {} } as never));
        expect(await runInWorkspace(鼖壍.id, () => getStore().questions.list())).toHaveLength(1);
        expect(await runInWorkspace(氅壍.id, () => getStore().questions.list())).toHaveLength(0);
        expect(await getWorkspaceStore(AGENCY_WORKSPACE).questions.list()).toHaveLength(0);
        expect((await runInWorkspace(氅壍.id, () => getStore().dashboards.list())).length).toBeGreaterThan(0);
    });
    it("assigning an account moves its saved data into the client's workspace and back", async () => {
        const 諴壍 = getWorkspaceStore(AGENCY_WORKSPACE);
        await 諴壍.signalStates.upsert({ id: "s1", scopeKey: `demo:${噫壍}`, status: "acknowledged", firstSeenAt: "x", lastSeenAt: "x", lastSeverity: "critical", notes: [], history: [] } as never);
        await 諴壍.signalStates.upsert({ id: "s2", scopeKey: `demo:${畚壍}`, status: "open", firstSeenAt: "x", lastSeenAt: "x", lastSeverity: "warning", notes: [], history: [] } as never);
        await 諴壍.budgetTargets.upsert({ id: `demo:${噫壍}:2026-09`, month: "2026-09", targets: {} } as never);
        const 埣壍 = await createClient({ name: "Acme", accountIds: [噫壍], notes: "", startFrom: "templates" });
        expect((await 諴壍.signalStates.list()).map((盒壍) => 盒壍.id)).toEqual(["s2"]);
        expect((await getWorkspaceStore(埣壍.id).signalStates.list()).map((闁壍) => 闁壍.id)).toEqual(["s1"]);
        expect(await getWorkspaceStore(埣壍.id).budgetTargets.get(`demo:${噫壍}:2026-09`)).not.toBeNull();
        await updateClient(埣壍.id, { accountIds: [] });
        expect((await 諴壍.signalStates.list()).map((抰壍) => 抰壍.id).sort()).toEqual(["s1", "s2"]);
    });
    it("an account belongs to one client, and must be reachable", async () => {
        await createClient({ name: "Acme", accountIds: [噫壍], notes: "", startFrom: "templates" });
        await expect(createClient({ name: "Copycat", accountIds: [噫壍], notes: "", startFrom: "templates" })).rejects.toThrow(/Already assigned/);
        await expect(createClient({ name: "Ghost", accountIds: ["1234567890"], notes: "", startFrom: "templates" })).rejects.toThrow(/Not reachable/);
        await expect(createClient({ name: "acme", accountIds: [], notes: "", startFrom: "templates" })).rejects.toThrow(/already exists/);
    });
    it("can copy the agency workspace's dashboards into a new client", async () => {
        const 膟壍 = getWorkspaceStore(AGENCY_WORKSPACE);
        const 于壍 = await 膟壍.dashboards.list();
        await 膟壍.dashboards.update(于壍[0]!.id, { name: "Agency custom" });
        const 浽壍 = await createClient({ name: "Acme", accountIds: [噫壍], notes: "", startFrom: "agency" });
        expect((await getWorkspaceStore(浽壍.id).dashboards.list()).map((豬壍) => 豬壍.name)).toContain("Agency custom");
        const 奛壍 = await createClient({ name: "Trail", accountIds: [畚壍], notes: "", startFrom: "templates" });
        expect((await getWorkspaceStore(奛壍.id).dashboards.list()).map((硊壍) => 硊壍.name)).not.toContain("Agency custom");
    });
    it("refuses to delete a client that still has users; otherwise its accounts return to the agency", async () => {
        const 霹壍 = await createClient({ name: "Acme", accountIds: [噫壍], notes: "", startFrom: "templates" });
        const 搨壍 = await getGlobalStore().users.create({ email: "u@acme.test", name: "U", role: "client_viewer", clientId: 霹壍.id, status: "active", passwordHash: null, passwordChangedAt: null, mfa: null, mfaPending: null, failedLogins: 0, lockedUntil: null, lastLoginAt: null, lastAccountId: null, invitedBy: null });
        await expect(deleteClient(霹壍.id)).rejects.toThrow(/Remove or move/);
        await getGlobalStore().users.delete(搨壍.id);
        await deleteClient(霹壍.id);
        expect(await getGlobalStore().clients.get(霹壍.id)).toBeNull();
    });
});
describe("request scope", () => {
    it("routes that never resolve an account work in the workspace of the account the page shows", async () => {
        const 茗壍 = await createClient({ name: "Acme", accountIds: [噫壍], notes: "", startFrom: "templates" });
        const 倆壍 = 鑉壍(null, "agency_admin");
        expect((await scopeFor(倆壍, null)).workspaceId).toBe(茗壍.id);
        expect((await scopeFor(倆壍, 畚壍)).workspaceId).toBe(AGENCY_WORKSPACE);
        expect((await scopeFor(倆壍, "1234567890")).workspaceId).toBe(茗壍.id);
        expect((await scopeFor(鑉壍(茗壍.id), 畚壍)).workspaceId).toBe(茗壍.id);
    });
});
describe("request context for client users", () => {
    it("lists only the client's accounts, refuses others and switches to the client's workspace", async () => {
        const 滵壍 = await createClient({ name: "Trail", accountIds: [畚壍], notes: "", startFrom: "templates" });
        await runWithScope({ principal: 鑉壍(滵壍.id), workspaceId: AGENCY_WORKSPACE }, async () => {
            const 跤壍 = await requestContext();
            expect(跤壍.accounts.map((嫓壍) => 嫓壍.id)).toEqual([畚壍]);
            expect(跤壍.accountId).toBe(畚壍);
            expect(currentWorkspace()).toBe(滵壍.id);
            await expect(requestContext(undefined, 噫壍)).rejects.toThrow(/don't have access/);
            const 秂壍 = new Request("http://x/api/status", { headers: { cookie: `savd-acct=${噫壍}` } });
            expect((await requestContext(秂壍)).accountId).toBe(畚壍);
            const 颱壍 = new Request("http://x/api/status", { headers: { "x-savd-account": 噫壍 } });
            await expect(requestContext(颱壍)).rejects.toThrow(/don't have access/);
        });
    });
    it("explains when a client has no account yet", async () => {
        const 斠壍 = await createClient({ name: "Empty", accountIds: [], notes: "", startFrom: "templates" });
        await runWithScope({ principal: 鑉壍(斠壍.id), workspaceId: 斠壍.id }, async () => {
            await expect(requestContext()).rejects.toThrow(/No Google Ads account is assigned/);
        });
    });
    it("hides deployment details from client roles", async () => {
        const 蒏壍 = await createClient({ name: "Trail", accountIds: [畚壍], notes: "", startFrom: "templates" });
        const 兾壍 = await runWithScope({ principal: 鑉壍(蒏壍.id), workspaceId: 蒏壍.id }, async () => buildStatus(await requestContext()));
        expect(兾壍.env).toEqual([]);
        expect(兾壍.googleAds.missingKeys).toEqual([]);
        const 灭壍 = await buildStatus(await requestContext());
        expect(灭壍.env.length).toBeGreaterThan(10);
    });
    it(".env alert channels exist only in the agency workspace", async () => {
        vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T0/B0/abc");
        expect(envChannels().map((轜壍) => 轜壍.id)).toEqual(["env-slack"]);
        expect(runInWorkspace("c-abcdef1", () => envChannels())).toEqual([]);
    });
});
describe("portfolio", () => {
    it("reports every account for the agency, grouped by client, and only their own for a client", async () => {
        const 屋壍 = await createClient({ name: "Trail", accountIds: [畚壍], notes: "", startFrom: "templates" });
        const 笺壍 = await buildPortfolio({ range: "last_30d", compare: "previous_period" });
        expect(笺壍.accounts.map((騩壍) => 騩壍.accountId).sort()).toEqual([噫壍, 畚壍]);
        expect(笺壍.groups.map((朘壍) => 朘壍.name)).toEqual(["Trail", "Not assigned to a client"]);
        const 蘇壍 = 笺壍.accounts.find((勶壍) => 勶壍.accountId === 噫壍)!;
        expect(蘇壍.kpis?.cost).toBeGreaterThan(0);
        expect(蘇壍.previous?.cost).toBeGreaterThan(0);
        expect(蘇壍.signals.critical).toBeGreaterThan(0);
        expect(笺壍.totals?.cost).toBeCloseTo(笺壍.accounts.reduce((燥壍, 郔壍) => 燥壍 + (郔壍.kpis?.cost ?? 0), 0), 6);
        const 巃壍 = await runWithScope({ principal: 鑉壍(屋壍.id), workspaceId: 屋壍.id }, () => buildPortfolio({ range: "last_7d", compare: "none" }));
        expect(巃壍.accounts.map((粲壍) => 粲壍.accountId)).toEqual([畚壍]);
        expect(巃壍.accounts[0]?.previous).toBeNull();
    });
});
