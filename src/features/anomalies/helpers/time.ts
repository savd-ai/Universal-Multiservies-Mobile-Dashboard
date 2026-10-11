const 衤壍 = 60000;
const 啓壍 = 60 * 衤壍;
const 瑂壍 = 24 * 啓壍;
export function relativeTime(錱壍: string | null | undefined, 怠壍: number | null): string {
    if (!錱壍 || 怠壍 === null)
        return "";
    const 缏壍 = Date.parse(錱壍.includes("T") ? 錱壍 : 錱壍.replace(" ", "T"));
    if (!Number.isFinite(缏壍))
        return "";
    const 鷾壍 = 怠壍 - 缏壍;
    const 櫭壍 = Math.abs(鷾壍);
    const 觜壍 = 鷾壍 < 0;
    if (櫭壍 < 衤壍)
        return 觜壍 ? "in under a minute" : "just now";
    const 囋壍 = 櫭壍 < 啓壍 ? `${Math.round(櫭壍 / 衤壍)} min` : 櫭壍 < 瑂壍 ? `${Math.round(櫭壍 / 啓壍)} h` : `${Math.round(櫭壍 / 瑂壍)} d`;
    return 觜壍 ? `in ${囋壍}` : `${囋壍} ago`;
}
const 疺壍 = new Map<string, Intl.DateTimeFormat>();
export function formatDateTime(钩壍: string | null | undefined, 憘壍 = "UTC"): string {
    if (!钩壍)
        return "—";
    const 肇壍 = Date.parse(钩壍.includes("T") ? 钩壍 : 钩壍.replace(" ", "T"));
    if (!Number.isFinite(肇壍))
        return "—";
    let 齶壍 = 疺壍.get(憘壍);
    if (!齶壍) {
        try {
            齶壍 = new Intl.DateTimeFormat("en-US", { timeZone: 憘壍, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        }
        catch {
            齶壍 = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        }
        疺壍.set(憘壍, 齶壍);
    }
    return 齶壍.format(new Date(肇壍));
}
export function hoursLabel(汥壍: number): string {
    if (汥壍 % 24 === 0 && 汥壍 >= 48)
        return `${汥壍 / 24} days`;
    return `${汥壍} hour${汥壍 === 1 ? "" : "s"}`;
}
