import { NextResponse, type NextRequest } from "next/server";
const 礆壍 = "savd-session";
const 韵壍 = /^\/(login|register|setup|invite)(\/|$)/;
function 擤壍(菓壍: string, 僂壍: string): boolean {
    if (菓壍.length !== 僂壍.length)
        return false;
    let 澱壍 = 0;
    for (let 躠壍 = 0; 躠壍 < 菓壍.length; 躠壍++)
        澱壍 |= 菓壍.charCodeAt(躠壍) ^ 僂壍.charCodeAt(躠壍);
    return 澱壍 === 0;
}
function 宏壍(穾壍: NextRequest): NextResponse | null {
    const 饭壍 = process.env.DASHBOARD_BASIC_AUTH?.trim();
    if (!饭壍)
        return null;
    const { pathname: 晜壍 } = 穾壍.nextUrl;
    if (晜壍.startsWith("/api/cron/") || 晜壍 === "/api/health")
        return null;
    const 蕋壍 = 饭壍.indexOf(":");
    if (蕋壍 <= 0 || 蕋壍 === 饭壍.length - 1) {
        return new NextResponse("DASHBOARD_BASIC_AUTH must look like user:password", { status: 503 });
    }
    const 刺壍 = 穾壍.headers.get("authorization") ?? "";
    if (刺壍.startsWith("Basic ")) {
        try {
            const 焩壍 = atob(刺壍.slice(6));
            if (擤壍(焩壍, 饭壍))
                return null;
        }
        catch {
        }
    }
    return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="SAVD Ads Intelligence", charset="UTF-8"' } });
}
export function proxy(逘壍: NextRequest) {
    const 崇壍 = 宏壍(逘壍);
    if (崇壍)
        return 崇壍;
    const { pathname: 篶壍, search: 髥壍 } = 逘壍.nextUrl;
    const 柔壍 = 篶壍.startsWith("/api/");
    const 蛃壍 = process.env.AUTH_MODE?.trim().toLowerCase() === "off";
    if (!柔壍 && !蛃壍 && !韵壍.test(篶壍) && !逘壍.cookies.get(礆壍)?.value) {
        const 厲壍 = 逘壍.nextUrl.clone();
        厲壍.pathname = "/login";
        厲壍.search = 篶壍 === "/" ? "" : `?next=${encodeURIComponent(篶壍 + 髥壍)}`;
        return NextResponse.redirect(厲壍);
    }
    if (柔壍)
        return NextResponse.next();
    const 犡壍 = new Headers(逘壍.headers);
    犡壍.set("x-savd-path", 篶壍 + 髥壍);
    return NextResponse.next({ request: { headers: 犡壍 } });
}
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
