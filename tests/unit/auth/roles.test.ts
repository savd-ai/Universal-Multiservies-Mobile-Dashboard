import { describe, expect, it } from "vitest";
import { accountsVisibleTo, AGENCY_WORKSPACE, assignableRoles, can, canOpenAccount, PERMISSIONS, permissionsFor, workspaceFor } from "@/lib/domain/auth/roles";
import { safeNext } from "@/lib/domain/contracts/auth";
import { fxFactor, ratioKpis, sumKpis } from "@/lib/domain/contracts/portfolio";
const clients = [
    { id: "c-acme01", name: "Acme", accountIds: ["111", "222"] },
    { id: "c-trail1", name: "Trail", accountIds: ["333"] },
];
const accounts = [{ id: "111" }, { id: "222" }, { id: "333" }, { id: "444" }];
describe("permissions", () => {
    it("agency admins can do everything; members can't manage users or clients", () => {
        expect(permissionsFor("agency_admin")).toEqual([...PERMISSIONS]);
        expect(can("agency_member", "users.manage")).toBe(false);
        expect(can("agency_member", "clients.manage")).toBe(false);
        expect(can("agency_member", "budget.plan")).toBe(true);
    });
    it("client roles never manage clients or the system", () => {
        for (const role of ["client_admin", "client_viewer"] as const) {
            expect(can(role, "clients.manage")).toBe(false);
            expect(can(role, "system.manage")).toBe(false);
        }
        expect(can("client_admin", "users.manage")).toBe(true);
        expect(can("client_admin", "alerts.manage")).toBe(true);
    });
    it("client viewers only read", () => {
        expect(permissionsFor("client_viewer")).toEqual(["accounts.read", "portfolio.read"]);
    });
    it("only agency admins hand out agency roles", () => {
        expect(assignableRoles("agency_admin")).toContain("agency_member");
        expect(assignableRoles("client_admin")).toEqual(["client_admin", "client_viewer"]);
        expect(assignableRoles("client_viewer")).toEqual([]);
        expect(assignableRoles("agency_member")).toEqual([]);
    });
});
describe("account visibility and workspaces", () => {
    it("agency roles see every account; client roles only their client's", () => {
        expect(accountsVisibleTo({ role: "agency_member", clientId: null }, clients, accounts).map((a) => a.id)).toEqual(["111", "222", "333", "444"]);
        expect(accountsVisibleTo({ role: "client_viewer", clientId: "c-acme01" }, clients, accounts).map((a) => a.id)).toEqual(["111", "222"]);
        expect(accountsVisibleTo({ role: "client_admin", clientId: "c-gone00" }, clients, accounts)).toEqual([]);
    });
    it("canOpenAccount refuses other clients' and unassigned accounts for client roles", () => {
        const viewer = { role: "client_viewer" as const, clientId: "c-acme01" };
        expect(canOpenAccount(viewer, clients, "222")).toBe(true);
        expect(canOpenAccount(viewer, clients, "333")).toBe(false);
        expect(canOpenAccount(viewer, clients, "444")).toBe(false);
        expect(canOpenAccount({ role: "agency_admin", clientId: null }, clients, "444")).toBe(true);
    });
    it("the workspace follows the account for agency users and the client for client users", () => {
        const agency = { role: "agency_admin" as const, clientId: null };
        expect(workspaceFor(agency, clients, "333")).toBe("c-trail1");
        expect(workspaceFor(agency, clients, "444")).toBe(AGENCY_WORKSPACE);
        expect(workspaceFor(agency, clients, null)).toBe(AGENCY_WORKSPACE);
        expect(workspaceFor({ role: "client_admin", clientId: "c-acme01" }, clients, "333")).toBe("c-acme01");
    });
});
describe("safeNext", () => {
    it("only follows same-site paths", () => {
        expect(safeNext("/campaigns?x=1")).toBe("/campaigns?x=1");
        expect(safeNext("https://evil.example")).toBe("/overview");
        expect(safeNext("//evil.example")).toBe("/overview");
        expect(safeNext("/\\evil")).toBe("/overview");
        expect(safeNext("/login?next=/x")).toBe("/overview");
        expect(safeNext(undefined)).toBe("/overview");
    });
});
describe("portfolio money", () => {
    it("converts through USD rates and refuses unknown currencies", () => {
        expect(fxFactor("USD", "USD", {})).toBe(1);
        expect(fxFactor("USD", "VND", { VND: 25400 })).toBe(25400);
        expect(fxFactor("VND", "USD", { VND: 25400 })).toBeCloseTo(1 / 25400);
        expect(fxFactor("EUR", "USD", {})).toBeNull();
    });
    it("sums as ratio of sums, skipping parts without a rate", () => {
        const a = ratioKpis({ cost: 100, conversions: 10, convValue: 400, clicks: 50, impressions: 1000 });
        const b = ratioKpis({ cost: 300, conversions: 10, convValue: 300, clicks: 50, impressions: 1000 });
        const total = sumKpis([
            { kpis: a, factor: 1 },
            { kpis: b, factor: 1 },
            { kpis: a, factor: null },
        ]);
        expect(total?.cost).toBe(400);
        expect(total?.cpa).toBe(20);
        expect(total?.roas).toBeCloseTo(700 / 400);
        expect(sumKpis([{ kpis: null, factor: 1 }])).toBeNull();
    });
});
