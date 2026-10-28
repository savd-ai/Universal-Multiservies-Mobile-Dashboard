import { NextResponse, type NextRequest } from "next/server";
const SESSION_COOKIE = "savd-session";
const PUBLIC_PAGES = /^\/(login|register|setup|invite)(\/|$)/;
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
function basicAuth(request: NextRequest): NextResponse | null {
    const setting = process.env.DASHBOARD_BASIC_AUTH?.trim();
    if (!setting)
        return null;
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/api/cron/") || pathname === "/api/health")
        return null;
    const sep = setting.indexOf(":");
    if (sep <= 0 || sep === setting.length - 1) {
        return new NextResponse("DASHBOARD_BASIC_AUTH must look like user:password", { status: 503 });
    }
    const header = request.headers.get("authorization") ?? "";
    if (header.startsWith("Basic ")) {
        try {
            const decoded = atob(header.slice(6));
            if (timingSafeEqual(decoded, setting))
                return null;
        }
        catch {
        }
    }
    return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="SAVD Ads Intelligence", charset="UTF-8"' } });
}
export function proxy(request: NextRequest) {
    const blocked = basicAuth(request);
    if (blocked)
        return blocked;
    const { pathname, search } = request.nextUrl;
    const isApi = pathname.startsWith("/api/");
    const authOff = process.env.AUTH_MODE?.trim().toLowerCase() === "off";
    if (!isApi && !authOff && !PUBLIC_PAGES.test(pathname) && !request.cookies.get(SESSION_COOKIE)?.value) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
        return NextResponse.redirect(url);
    }
    if (isApi)
        return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.set("x-savd-path", pathname + search);
    return NextResponse.next({ request: { headers } });
}
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
