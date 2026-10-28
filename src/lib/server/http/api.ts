import "server-only";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { z, ZodError } from "zod";
import { awaitingAccess, can, ROLE_LABELS } from "@/lib/domain/auth/roles";
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
export function route<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(opts: RouteOptions<B, Q>, handler: (ctx: RouteContext<Infer<B>, Infer<Q>>) => Promise<unknown>) {
    return async (req: Request, ctx?: {
        params?: Promise<Record<string, string | string[]>>;
    }): Promise<Response> => {
        await connection();
        const requestId = randomUUID();
        const headers = { "Cache-Control": "no-store", "x-request-id": requestId };
        try {
            const client = clientKey(req, appConfig().trustProxy);
            const url = new URL(req.url);
            if (req.method !== "GET" && req.method !== "HEAD" && !opts.allowCrossSite)
                csrfCheck(req);
            const principal = await authorize(req, url.pathname);
            if (opts.rateLimit) {
                const rl = takeToken(`${opts.rateLimit.key}:${principal.userId ?? client}`, opts.rateLimit.perMinute, opts.rateLimit.burst);
                if (!rl.ok)
                    throw new AppError("RATE_LIMITED", "Too many requests — try again shortly.", undefined, rl.retryAfterSec);
            }
            let body: unknown = undefined;
            if (opts.body) {
                const text = await readBody(req, opts.maxBody ?? 256 * 1024);
                let json: unknown = {};
                if (text.trim()) {
                    try {
                        json = JSON.parse(text);
                    }
                    catch {
                        throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON");
                    }
                }
                body = opts.body.parse(json);
            }
            let query: unknown = undefined;
            if (opts.query)
                query = opts.query.parse(Object.fromEntries(url.searchParams.entries()));
            const params = ctx?.params ? await ctx.params : {};
            const scope = principal.kind === "anonymous" ? { principal, workspaceId: "agency" } : await scopeFor(principal, requestedAccount(req)?.id ?? null);
            const result = await runWithScope(scope, () => handler({ req, body: body as Infer<B>, query: query as Infer<Q>, params, requestId, client, principal }));
            if (result instanceof Response) {
                for (const [k, v] of Object.entries(headers))
                    if (!result.headers.has(k))
                        result.headers.set(k, v);
                return result;
            }
            return Response.json(result ?? { ok: true }, { headers });
        }
        catch (err) {
            if (err instanceof AppError && err.code === "GOOGLE_ADS_ERROR")
                void import("../datasource/resolver").then((m) => m.invalidateResolution());
            return errorResponse(err, requestId, headers);
        }
    };
}
async function authorize(req: Request, pathname: string): Promise<Principal> {
    const policy = policyFor(req.method, pathname);
    if (!policy)
        throw new AppError("FORBIDDEN", "This action isn't allowed");
    if (policy.kind === "public")
        return ANONYMOUS_PRINCIPAL;
    if (policy.kind === "cron")
        return SYSTEM_PRINCIPAL;
    const principal = await principalFromRequest(req);
    if (!principal)
        throw new AppError("UNAUTHORIZED", "Sign in to continue");
    if (principal.mfaSetupRequired && policy.kind !== "session") {
        throw new AppError("FORBIDDEN", "Set up two-factor authentication to continue", { reason: "mfa_setup_required" });
    }
    if (policy.kind === "permission" && awaitingAccess(principal))
        throw new AppError("FORBIDDEN", "Your account is waiting for an admin to give you access.", { reason: "awaiting_access" });
    if (policy.kind === "permission" && !can(principal.role, policy.permission)) {
        throw new AppError("FORBIDDEN", `Your role (${ROLE_LABELS[principal.role]}) can't do this`, { reason: "permission", permission: policy.permission });
    }
    return principal;
}
function csrfCheck(req: Request): void {
    const ct = req.headers.get("content-type") ?? "";
    const hasBody = req.headers.get("content-length") !== "0" && req.method !== "DELETE";
    if (hasBody && !ct.toLowerCase().includes("application/json")) {
        throw new AppError("FORBIDDEN", "Write requests must send application/json");
    }
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none")
        throw new AppError("FORBIDDEN", "Cross-site request blocked");
    const origin = req.headers.get("origin");
    if (origin) {
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
        const allowed = new Set<string>();
        if (host) {
            allowed.add(`http://${host}`);
            allowed.add(`https://${host}`);
        }
        const base = env.get("APP_BASE_URL");
        if (base) {
            try {
                allowed.add(new URL(base).origin);
            }
            catch {
            }
        }
        if (!allowed.has(origin))
            throw new AppError("FORBIDDEN", "Cross-origin request blocked");
    }
}
async function readBody(req: Request, max: number): Promise<string> {
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > max)
        throw new AppError("PAYLOAD_TOO_LARGE", `Body is larger than ${Math.round(max / 1024)} KB`);
    const text = await req.text();
    if (text.length > max)
        throw new AppError("PAYLOAD_TOO_LARGE", `Body is larger than ${Math.round(max / 1024)} KB`);
    return text;
}
export function errorResponse(err: unknown, requestId: string, headers: Record<string, string> = {}): Response {
    if (err instanceof AppError) {
        const h: Record<string, string> = { ...headers };
        if (err.retryAfterSec)
            h["Retry-After"] = String(err.retryAfterSec);
        return Response.json({ error: { code: err.code, message: err.message, details: err.details, requestId, retryAfterSec: err.retryAfterSec } }, { status: err.status, headers: h });
    }
    if (err instanceof ZodError) {
        return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: z.flattenError(err), requestId } }, { status: 400, headers });
    }
    if (err instanceof QueryError) {
        return Response.json({ error: { code: err.code, message: err.message, requestId } }, { status: err.code === "VALIDATION_ERROR" ? 400 : 422, headers });
    }
    if (err instanceof SecretsDisabledError) {
        return Response.json({ error: { code: "SECRETS_DISABLED", message: err.message, requestId } }, { status: 422, headers });
    }
    log.error("Unhandled route error", { requestId, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err), stack: err instanceof Error ? err.stack?.split("\n").slice(0, 6).join(" | ") : undefined });
    return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Check the server log for the request id.", requestId } }, { status: 500, headers });
}
export const runtimeNode = "nodejs" as const;
