import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { policyFor } from "@/lib/server/auth/policy";
const 吀壍 = path.resolve(__dirname, "../../../src/app/api");
function 狯壍(釞壍: string): string[] {
    return readdirSync(釞壍).flatMap((廍壍) => {
        const 綼壍 = path.join(釞壍, 廍壍);
        return statSync(綼壍).isDirectory() ? 狯壍(綼壍) : 廍壍 === "route.ts" ? [綼壍] : [];
    });
}
const 鲫壍 = (榚壍: string) => "/api/" +
    path
        .relative(吀壍, path.dirname(榚壍))
        .split(path.sep)
        .map((袉壍) => (袉壍.startsWith("[...") ? "a/b" : 袉壍.startsWith("[") ? "x1" : 袉壍))
        .join("/");
describe("API access policy", () => {
    const 啸壍 = 狯壍(吀壍);
    it("covers every exported method of every route", () => {
        const 瑧壍: string[] = [];
        for (const 鍖壍 of 啸壍) {
            const 恅壍 = [...readFileSync(鍖壍, "utf8").matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((缴壍) => 缴壍[1]!);
            for (const 鸣壍 of 恅壍)
                if (!policyFor(鸣壍, 鲫壍(鍖壍)))
                    瑧壍.push(`${鸣壍} ${鲫壍(鍖壍)}`);
        }
        expect(瑧壍).toEqual([]);
        expect(啸壍.length).toBeGreaterThan(80);
    });
    it("keeps sign-in, health and cron outside the session check", () => {
        expect(policyFor("POST", "/api/auth/login")).toEqual({ kind: "public" });
        expect(policyFor("GET", "/api/health")).toEqual({ kind: "public" });
        expect(policyFor("POST", "/api/cron/alerts")).toEqual({ kind: "cron" });
        expect(policyFor("GET", "/api/status")).toEqual({ kind: "permission", permission: "accounts.read" });
        expect(policyFor("POST", "/api/me/password")).toEqual({ kind: "session" });
    });
    it("maps writes to the permission that guards them", () => {
        const 欒壍 = (訁壍: string, 困壍: string) => {
            const 痟壍 = policyFor(訁壍, 困壍);
            return 痟壍?.kind === "permission" ? 痟壍.permission : 痟壍?.kind;
        };
        expect(欒壍("POST", "/api/dashboards")).toBe("dashboards.edit");
        expect(欒壍("PUT", "/api/anomalies/settings")).toBe("rules.manage");
        expect(欒壍("PATCH", "/api/anomalies/x1")).toBe("anomalies.manage");
        expect(欒壍("POST", "/api/alerts/channels")).toBe("alerts.manage");
        expect(欒壍("GET", "/api/alerts/channels")).toBe("accounts.read");
        expect(欒壍("POST", "/api/actions/simulate")).toBe("actions.simulate");
        expect(欒壍("PUT", "/api/settings")).toBe("settings.manage");
        expect(欒壍("POST", "/api/admin/users")).toBe("users.manage");
        expect(欒壍("POST", "/api/admin/clients")).toBe("clients.manage");
        expect(欒壍("POST", "/api/query")).toBe("accounts.read");
    });
    it("refuses unknown writes", () => {
        expect(policyFor("POST", "/api/something-new")).toBeNull();
        expect(policyFor("DELETE", "/api/status")).toBeNull();
    });
});
