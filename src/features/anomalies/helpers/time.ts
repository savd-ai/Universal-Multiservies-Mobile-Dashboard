const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export function relativeTime(iso: string | null | undefined, nowMs: number | null): string {
    if (!iso || nowMs === null)
        return "";
    const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T"));
    if (!Number.isFinite(t))
        return "";
    const diff = nowMs - t;
    const abs = Math.abs(diff);
    const future = diff < 0;
    if (abs < MIN)
        return future ? "in under a minute" : "just now";
    const body = abs < HOUR ? `${Math.round(abs / MIN)} min` : abs < DAY ? `${Math.round(abs / HOUR)} h` : `${Math.round(abs / DAY)} d`;
    return future ? `in ${body}` : `${body} ago`;
}
const dtCache = new Map<string, Intl.DateTimeFormat>();
export function formatDateTime(iso: string | null | undefined, timeZone = "UTC"): string {
    if (!iso)
        return "—";
    const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T"));
    if (!Number.isFinite(t))
        return "—";
    let f = dtCache.get(timeZone);
    if (!f) {
        try {
            f = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        }
        catch {
            f = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        }
        dtCache.set(timeZone, f);
    }
    return f.format(new Date(t));
}
export function hoursLabel(hours: number): string {
    if (hours % 24 === 0 && hours >= 48)
        return `${hours / 24} days`;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
}
