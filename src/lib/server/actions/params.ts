import "server-only";
import { AppError } from "../http/errors";
export function routeParam(params: Record<string, string | string[]>, key: string): string {
    const raw = params[key];
    const v = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
    let out = v;
    try {
        out = decodeURIComponent(v);
    }
    catch {
    }
    if (!out || out.length > 200)
        throw new AppError("VALIDATION_ERROR", `Invalid ${key}`);
    return out;
}
export function fileResponse(body: string, contentType: string, filename: string, warnings: string[] = []): Response {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const headers: Record<string, string> = { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${safeName}"` };
    if (warnings.length)
        headers["x-savd-warnings"] = encodeURIComponent(JSON.stringify(warnings.slice(0, 20)));
    return new Response(body, { headers });
}
