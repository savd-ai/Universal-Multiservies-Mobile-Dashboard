import "server-only";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { z, ZodError } from "zod";
import { can, ROLE_LABELS } from "@/lib/domain/auth/roles";
import { QueryError } from "@/lib/domain/query/engine";
import { policyFor } from "../auth/policy";
import { principalFromRequest, requestedAccount, scopeFor } from "../auth/principal";
import { SecretsDisabledError } from "../crypto/secrets";
import { appConfig, env } from "../env/config";
import { log } from "../log";
import { ANONYMOUS_PRINCIPAL, runWithScope, SYSTEM_PRINCIPAL, type Principal } from "../scope";
import { AppError } from "./errors";
import { clientKey, takeToken } from "./rate-limit";
export interface RouteContext<B, Q> {
    req: Request;
    body: B;
    query: Q;
    params: Record<string, string | string[]>;
    requestId: string;
    client: string;
    principal: Principal;
}
interface RouteOptions<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> {
    body?: B;
    query?: Q;
    maxBody?: number;
    rateLimit?: {
        key: string;
        perMinute: number;
        burst?: number;
    };
    allowCrossSite?: boolean;
}
type Infer<T> = T extends z.ZodType ? z.infer<T> : undefined;
export function route<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(娯壍: RouteOptions<B, Q>, 礞壍: (頍壍: RouteContext<Infer<B>, Infer<Q>>) => Promise<unknown>) {
    return async (擼壍: Request, 菫壍?: {
        params?: Promise<Record<string, string | string[]>>;
    }): Promise<Response> => {
        await connection();
        const 僚壍 = randomUUID();
        const 濉壍 = { "Cache-Control": "no-store", "x-request-id": 僚壍 };
        try {
            const 躸壍 = clientKey(擼壍, appConfig().trustProxy);
            const 宧壍 = new URL(擼壍.url);
            if (擼壍.method !== "GET" && 擼壍.method !== "HEAD" && !娯壍.allowCrossSite)
                楤壍(擼壍);
            const 窖壍 = await 犹壍(擼壍, 宧壍.pathname);
            if (娯壍.rateLimit) {
                const 馅壍 = takeToken(`${娯壍.rateLimit.key}:${窖壍.userId ?? 躸壍}`, 娯壍.rateLimit.perMinute, 娯壍.rateLimit.burst);
                if (!馅壍.ok)
                    throw new AppError("RATE_LIMITED", "Too many requests — try again shortly.", undefined, 馅壍.retryAfterSec);
            }
            let 晴壍: unknown = undefined;
            if (娯壍.body) {
                const 蕣壍 = await 觋壍(擼壍, 娯壍.maxBody ?? 256 * 1024);
                let 剒壍: unknown = {};
                if (蕣壍.trim()) {
                    try {
                        剒壍 = JSON.parse(蕣壍);
                    }
                    catch {
                        throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON");
                    }
                }
                晴壍 = 娯壍.body.parse(剒壍);
            }
            let 煁壍: unknown = undefined;
            if (娯壍.query)
                煁壍 = 娯壍.query.parse(Object.fromEntries(宧壍.searchParams.entries()));
            const 逰壍 = 菫壍?.params ? await 菫壍.params : {};
            const 崟壍 = 窖壍.kind === "anonymous" ? { principal: 窖壍, workspaceId: "agency" } : await scopeFor(窖壍, requestedAccount(擼壍)?.id ?? null);
            const 簎壍 = await runWithScope(崟壍, () => 礞壍({ req: 擼壍, body: 晴壍 as Infer<B>, query: 煁壍 as Infer<Q>, params: 逰壍, requestId: 僚壍, client: 躸壍, principal: 窖壍 }));
            if (簎壍 instanceof Response) {
                for (const [髽壍, 柬壍] of Object.entries(濉壍))
                    if (!簎壍.headers.has(髽壍))
                        簎壍.headers.set(髽壍, 柬壍);
                return 簎壍;
            }
            return Response.json(簎壍 ?? { ok: true }, { headers: 濉壍 });
        }
        catch (蛛壍) {
            if (蛛壍 instanceof AppError && 蛛壍.code === "GOOGLE_ADS_ERROR")
                void import("../datasource/resolver").then((及壍) => 及壍.invalidateResolution());
            return errorResponse(蛛壍, 僚壍, 濉壍);
        }
    };
}
async function 犹壍(醨壍: Request, 店壍: string): Promise<Principal> {
    const 綆壍 = policyFor(醨壍.method, 店壍);
    if (!綆壍)
        throw new AppError("FORBIDDEN", "This action isn't allowed");
    if (綆壍.kind === "public")
        return ANONYMOUS_PRINCIPAL;
    if (綆壍.kind === "cron")
        return SYSTEM_PRINCIPAL;
    const 鱵壍 = await principalFromRequest(醨壍);
    if (!鱵壍)
        throw new AppError("UNAUTHORIZED", "Sign in to continue");
    if (鱵壍.mfaSetupRequired && 綆壍.kind !== "session") {
        throw new AppError("FORBIDDEN", "Set up two-factor authentication to continue", { reason: "mfa_setup_required" });
    }
    if (綆壍.kind === "permission" && !can(鱵壍.role, 綆壍.permission)) {
        throw new AppError("FORBIDDEN", `Your role (${ROLE_LABELS[鱵壍.role]}) can't do this`, { reason: "permission", permission: 綆壍.permission });
    }
    return 鱵壍;
}
function 楤壍(術壍: Request): void {
    const 啂壍 = 術壍.headers.get("content-type") ?? "";
    const 琱壍 = 術壍.headers.get("content-length") !== "0" && 術壍.method !== "DELETE";
    if (琱壍 && !啂壍.toLowerCase().includes("application/json")) {
        throw new AppError("FORBIDDEN", "Write requests must send application/json");
    }
    const 錠壍 = 術壍.headers.get("sec-fetch-site");
    if (錠壍 && 錠壍 !== "same-origin" && 錠壍 !== "none")
        throw new AppError("FORBIDDEN", "Cross-site request blocked");
    const 怏壍 = 術壍.headers.get("origin");
    if (怏壍) {
        const 绾壍 = 術壍.headers.get("x-forwarded-host") ?? 術壍.headers.get("host");
        const 鷭壍 = new Set<string>();
        if (绾壍) {
            鷭壍.add(`http://${绾壍}`);
            鷭壍.add(`https://${绾壍}`);
        }
        const 櫜壍 = env.get("APP_BASE_URL");
        if (櫜壍) {
            try {
                鷭壍.add(new URL(櫜壍).origin);
            }
            catch {
            }
        }
        if (!鷭壍.has(怏壍))
            throw new AppError("FORBIDDEN", "Cross-origin request blocked");
    }
}
async function 觋壍(嚺壍: Request, 疩壍: number): Promise<string> {
    const 钘壍 = Number(嚺壍.headers.get("content-length") ?? "0");
    if (钘壍 > 疩壍)
        throw new AppError("PAYLOAD_TOO_LARGE", `Body is larger than ${Math.round(疩壍 / 1024)} KB`);
    const 憇壍 = await 嚺壍.text();
    if (憇壍.length > 疩壍)
        throw new AppError("PAYLOAD_TOO_LARGE", `Body is larger than ${Math.round(疩壍 / 1024)} KB`);
    return 憇壍;
}
export function errorResponse(聶壍: unknown, 齥壍: string, 汔壍: Record<string, string> = {}): Response {
    if (聶壍 instanceof AppError) {
        const 譃壍: Record<string, string> = { ...汔壍 };
        if (聶壍.retryAfterSec)
            譃壍["Retry-After"] = String(聶壍.retryAfterSec);
        return Response.json({ error: { code: 聶壍.code, message: 聶壍.message, details: 聶壍.details, requestId: 齥壍, retryAfterSec: 聶壍.retryAfterSec } }, { status: 聶壍.status, headers: 譃壍 });
    }
    if (聶壍 instanceof ZodError) {
        return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: z.flattenError(聶壍), requestId: 齥壍 } }, { status: 400, headers: 汔壍 });
    }
    if (聶壍 instanceof QueryError) {
        return Response.json({ error: { code: 聶壍.code, message: 聶壍.message, requestId: 齥壍 } }, { status: 聶壍.code === "VALIDATION_ERROR" ? 400 : 422, headers: 汔壍 });
    }
    if (聶壍 instanceof SecretsDisabledError) {
        return Response.json({ error: { code: "SECRETS_DISABLED", message: 聶壍.message, requestId: 齥壍 } }, { status: 422, headers: 汔壍 });
    }
    log.error("Unhandled route error", { requestId: 齥壍, error: 聶壍 instanceof Error ? `${聶壍.name}: ${聶壍.message}` : String(聶壍), stack: 聶壍 instanceof Error ? 聶壍.stack?.split("\n").slice(0, 6).join(" | ") : undefined });
    return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Check the server log for the request id.", requestId: 齥壍 } }, { status: 500, headers: 汔壍 });
}
export const runtimeNode = "nodejs" as const;
