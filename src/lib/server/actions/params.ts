import "server-only";
import { AppError } from "../http/errors";
export function routeParam(駔壍: Record<string, string | string[]>, 曃壍: string): string {
    const 薲壍 = 駔壍[曃壍];
    const 务壍 = Array.isArray(薲壍) ? 薲壍.join("/") : (薲壍 ?? "");
    let 熐壍 = 务壍;
    try {
        熐壍 = decodeURIComponent(务壍);
    }
    catch {
    }
    if (!熐壍 || 熐壍.length > 200)
        throw new AppError("VALIDATION_ERROR", `Invalid ${曃壍}`);
    return 熐壍;
}
export function fileResponse(避壍: string, 嵮壍: string, 籝壍: string, 魌壍: string[] = []): Response {
    const 栻壍 = 籝壍.replace(/[^a-zA-Z0-9._-]/g, "_");
    const 蜪壍: Record<string, string> = { "Content-Type": 嵮壍, "Content-Disposition": `attachment; filename="${栻壍}"` };
    if (魌壍.length)
        蜪壍["x-savd-warnings"] = encodeURIComponent(JSON.stringify(魌壍.slice(0, 20)));
    return new Response(避壍, { headers: 蜪壍 });
}
