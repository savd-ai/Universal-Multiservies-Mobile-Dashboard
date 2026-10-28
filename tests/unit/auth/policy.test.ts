import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { policyFor } from "@/lib/server/auth/policy";
const API = path.resolve(__dirname, "../../../src/app/api");
function routes(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        return statSync(p).isDirectory() ? routes(p) : name === "route.ts" ? [p] : [];
    });
}
const samplePath = (file: string) => "/api/" +
    path
        .relative(API, path.dirname(file))
        .split(path.sep)
        .map((seg) => (seg.startsWith("[...") ? "a/b" : seg.startsWith("[") ? "x1" : seg))
        .join("/");
describe("API access policy", () => {
    const files = routes(API);
    it("covers every exported method of every route", () => {
        const missing: string[] = [];
        for (const f of files) {
            const methods = [...readFileSync(f, "utf8").matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]!);
            for (const m of methods)
                if (!policyFor(m, samplePath(f)))
                    missing.push(`${m} ${samplePath(f)}`);
        }
        expect(missing).toEqual([]);
        expect(files.length).toBeGreaterThan(80);
    });
    it("keeps sign-in, health and cron outside the session check", () => {
        expect(policyFor("POST", "/api/auth/login")).toEqual({ kind: "public" });
        expect(policyFor("GET", "/api/health")).toEqual({ kind: "public" });
        expect(policyFor("POST", "/api/cron/alerts")).toEqual({ kind: "cron" });
        expect(policyFor("GET", "/api/status")).toEqual({ kind: "permission", permission: "accounts.read" });
        expect(policyFor("POST", "/api/me/password")).toEqual({ kind: "session" });
    });
    it("maps writes to the permission that guards them", () => {
        const perm = (m: string, p: string) => {
            const r = policyFor(m, p);
            return r?.kind === "permission" ? r.permission : r?.kind;
        };
        expect(perm("POST", "/api/dashboards")).toBe("dashboards.edit");
        expect(perm("PUT", "/api/anomalies/settings")).toBe("rules.manage");
        expect(perm("PATCH", "/api/anomalies/x1")).toBe("anomalies.manage");
        expect(perm("POST", "/api/alerts/channels")).toBe("alerts.manage");
        expect(perm("GET", "/api/alerts/channels")).toBe("accounts.read");
        expect(perm("POST", "/api/actions/simulate")).toBe("actions.simulate");
        expect(perm("PUT", "/api/settings")).toBe("settings.manage");
        expect(perm("POST", "/api/admin/users")).toBe("users.manage");
        expect(perm("POST", "/api/admin/clients")).toBe("clients.manage");
        expect(perm("POST", "/api/query")).toBe("accounts.read");
    });
    it("refuses unknown writes", () => {
        expect(policyFor("POST", "/api/something-new")).toBeNull();
        expect(policyFor("DELETE", "/api/status")).toBeNull();
    });
});
