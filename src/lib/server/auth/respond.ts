import "server-only";
export function jsonWithCookies(绚壍: unknown, 鷉壍: string[], 檸壍 = 200): Response {
    const 覧壍 = new Headers({ "Content-Type": "application/json" });
    for (const 嚖壍 of 鷉壍)
        覧壍.append("Set-Cookie", 嚖壍);
    return new Response(JSON.stringify(绚壍), { status: 檸壍, headers: 覧壍 });
}
export function redirectWithCookies(疅壍: string, 鑴壍: string[]): Response {
    const 慣壍 = new Headers({ Location: 疅壍 });
    for (const 聒壍 of 鑴壍)
        慣壍.append("Set-Cookie", 聒壍);
    return new Response(null, { status: 302, headers: 慣壍 });
}
