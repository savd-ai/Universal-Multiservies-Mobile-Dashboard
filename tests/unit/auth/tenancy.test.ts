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
const ACME = "4821193307";
const TRAIL = "9876543210";
const viewer = (clientId: string | null, role: Principal["role"] = "client_viewer"): Principal => ({ kind: "user", userId: "u-1", email: "v@client.test", name: "V", role, clientId, sessionId: null });
beforeEach(() => resetServerState());
afterEach(() => restoreServerState());
describe("workspace stores", () => {
    it("keep each client's records apart from the agency and from each other", async () => {
        const a = await createClient({ name: "Acme", accountIds: [ACME], notes: "", startFrom: "templates" });
        const b = await createClient({ name: "Trail", accountIds: [TRAIL], notes: "", startFrom: "templates" });
        await runInWorkspace(a.id, () => getStore().questions.create({ name: "Acme only", spec: {} } as never));
        expect(await runInWorkspace(a.id, () => getStore().questions.list())).toHaveLength(1);
        expect(await runInWorkspace(b.id, () => getStore().questions.list())).toHaveLength(0);
        expect(await getWorkspaceStore(AGENCY_WORKSPACE).questions.list()).toHaveLength(0);
        expect((await runInWorkspace(b.id, () => getStore().dashboards.list())).length).toBeGreaterThan(0);
    });
    it("assigning an account moves its saved data into the client's workspace and back", async () => {
        const agency = getWorkspaceStore(AGENCY_WORKSPACE);
        await agency.signalStates.upsert({ id: "s1", scopeKey: `demo:${ACME}`, status: "acknowledged", firstSeenAt: "x", lastSeenAt: "x", lastSeverity: "critical", notes: [], history: [] } as never);
        await agency.signalStates.upsert({ id: "s2", scopeKey: `demo:${TRAIL}`, status: "open", firstSeenAt: "x", lastSeenAt: "x", lastSeverity: "warning", notes: [], history: [] } as never);
        await agency.budgetTargets.upsert({ id: `demo:${ACME}:2026-09`, month: "2026-09", targets: {} } as never);
        const c = await createClient({ name: "Acme", accountIds: [ACME], notes: "", startFrom: "templates" });
        expect((await agency.signalStates.list()).map((s) => s.id)).toEqual(["s2"]);
        expect((await getWorkspaceStore(c.id).signalStates.list()).map((s) => s.id)).toEqual(["s1"]);
        expect(await getWorkspaceStore(c.id).budgetTargets.get(`demo:${ACME}:2026-09`)).not.toBeNull();
        await updateClient(c.id, { accountIds: [] });
        expect((await agency.signalStates.list()).map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    });
    it("an account belongs to one client, and must be reachable", async () => {
        await createClient({ name: "Acme", accountIds: [ACME], notes: "", startFrom: "templates" });
        await expect(createClient({ name: "Copycat", accountIds: [ACME], notes: "", startFrom: "templates" })).rejects.toThrow(/Already assigned/);
        await expect(createClient({ name: "Ghost", accountIds: ["1234567890"], notes: "", startFrom: "templates" })).rejects.toThrow(/Not reachable/);
        await expect(createClient({ name: "acme", accountIds: [], notes: "", startFrom: "templates" })).rejects.toThrow(/already exists/);
    });
    it("can copy the agency workspace's dashboards into a new client", async () => {
        const agency = getWorkspaceStore(AGENCY_WORKSPACE);
        const seeded = await agency.dashboards.list();
        await agency.dashboards.update(seeded[0]!.id, { name: "Agency custom" });
        const c = await createClient({ name: "Acme", accountIds: [ACME], notes: "", startFrom: "agency" });
        expect((await getWorkspaceStore(c.id).dashboards.list()).map((d) => d.name)).toContain("Agency custom");
        const fresh = await createClient({ name: "Trail", accountIds: [TRAIL], notes: "", startFrom: "templates" });
        expect((await getWorkspaceStore(fresh.id).dashboards.list()).map((d) => d.name)).not.toContain("Agency custom");
    });
    it("refuses to delete a client that still has users; otherwise its accounts return to the agency", async () => {
        const c = await createClient({ name: "Acme", accountIds: [ACME], notes: "", startFrom: "templates" });
        const user = await getGlobalStore().users.create({ email: "u@acme.test", name: "U", role: "client_viewer", clientId: c.id, status: "active", passwordHash: null, passwordChangedAt: null, mfa: null, mfaPending: null, failedLogins: 0, lockedUntil: null, lastLoginAt: null, lastAccountId: null, invitedBy: null });
        await expect(deleteClient(c.id)).rejects.toThrow(/Remove or move/);
        await getGlobalStore().users.delete(user.id);
        await deleteClient(c.id);
        expect(await getGlobalStore().clients.get(c.id)).toBeNull();
    });
});
describe("request scope", () => {
    it("routes that never resolve an account work in the workspace of the account the page shows", async () => {
        const c = await createClient({ name: "Acme", accountIds: [ACME], notes: "", startFrom: "templates" });
        const agency = viewer(null, "agency_admin");
        expect((await scopeFor(agency, null)).workspaceId).toBe(c.id);
        expect((await scopeFor(agency, TRAIL)).workspaceId).toBe(AGENCY_WORKSPACE);
        expect((await scopeFor(agency, "1234567890")).workspaceId).toBe(c.id);
        expect((await scopeFor(viewer(c.id), TRAIL)).workspaceId).toBe(c.id);
    });
});
describe("request context for client users", () => {
    it("lists only the client's accounts, refuses others and switches to the client's workspace", async () => {
        const c = await createClient({ name: "Trail", accountIds: [TRAIL], notes: "", startFrom: "templates" });
        await runWithScope({ principal: viewer(c.id), workspaceId: AGENCY_WORKSPACE }, async () => {
            const ctx = await requestContext();
            expect(ctx.accounts.map((a) => a.id)).toEqual([TRAIL]);
            expect(ctx.accountId).toBe(TRAIL);
            expect(currentWorkspace()).toBe(c.id);
            await expect(requestContext(undefined, ACME)).rejects.toThrow(/don't have access/);
            const cookie = new Request("http://x/api/status", { headers: { cookie: `savd-acct=${ACME}` } });
            expect((await requestContext(cookie)).accountId).toBe(TRAIL);
            const header = new Request("http://x/api/status", { headers: { "x-savd-account": ACME } });
            await expect(requestContext(header)).rejects.toThrow(/don't have access/);
        });
    });
    it("explains when a client has no account yet", async () => {
        const c = await createClient({ name: "Empty", accountIds: [], notes: "", startFrom: "templates" });
        await runWithScope({ principal: viewer(c.id), workspaceId: c.id }, async () => {
            await expect(requestContext()).rejects.toThrow(/No Google Ads account is assigned/);
        });
    });
    it("hides deployment details from client roles", async () => {
        const c = await createClient({ name: "Trail", accountIds: [TRAIL], notes: "", startFrom: "templates" });
        const status = await runWithScope({ principal: viewer(c.id), workspaceId: c.id }, async () => buildStatus(await requestContext()));
        expect(status.env).toEqual([]);
        expect(status.googleAds.missingKeys).toEqual([]);
        const agencyStatus = await buildStatus(await requestContext());
        expect(agencyStatus.env.length).toBeGreaterThan(10);
    });
    it(".env alert channels exist only in the agency workspace", async () => {
        vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T0/B0/abc");
        expect(envChannels().map((c) => c.id)).toEqual(["env-slack"]);
        expect(runInWorkspace("c-abcdef1", () => envChannels())).toEqual([]);
    });
});
describe("portfolio", () => {
    it("reports every account for the agency, grouped by client, and only their own for a client", async () => {
        const c = await createClient({ name: "Trail", accountIds: [TRAIL], notes: "", startFrom: "templates" });
        const all = await buildPortfolio({ range: "last_30d", compare: "previous_period" });
        expect(all.accounts.map((a) => a.accountId).sort()).toEqual([ACME, TRAIL]);
        expect(all.groups.map((g) => g.name)).toEqual(["Trail", "Not assigned to a client"]);
        const acme = all.accounts.find((a) => a.accountId === ACME)!;
        expect(acme.kpis?.cost).toBeGreaterThan(0);
        expect(acme.previous?.cost).toBeGreaterThan(0);
        expect(acme.signals.critical).toBeGreaterThan(0);
        expect(all.totals?.cost).toBeCloseTo(all.accounts.reduce((s, a) => s + (a.kpis?.cost ?? 0), 0), 6);
        const mine = await runWithScope({ principal: viewer(c.id), workspaceId: c.id }, () => buildPortfolio({ range: "last_7d", compare: "none" }));
        expect(mine.accounts.map((a) => a.accountId)).toEqual([TRAIL]);
        expect(mine.accounts[0]?.previous).toBeNull();
    });
});
