import "server-only";
export function jsonWithCookies(body: unknown, cookies: string[], status = 200): Response {
    const headers = new Headers({ "Content-Type": "application/json" });
    for (const c of cookies)
        headers.append("Set-Cookie", c);
    return new Response(JSON.stringify(body), { status, headers });
}
export function redirectWithCookies(location: string, cookies: string[]): Response {
    const headers = new Headers({ Location: location });
    for (const c of cookies)
        headers.append("Set-Cookie", c);
    return new Response(null, { status: 302, headers });
}
