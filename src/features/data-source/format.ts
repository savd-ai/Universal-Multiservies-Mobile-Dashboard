export function formatAccountId(id: string): string {
    return /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}
export function timeAgo(iso: string, now: number): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t))
        return "—";
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 45)
        return "just now";
    if (s < 3600)
        return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400)
        return `${Math.round(s / 3600)}h ago`;
    if (s < 7 * 86400)
        return `${Math.round(s / 86400)}d ago`;
    return formatDateTime(iso, "UTC", false);
}
export function formatDateTime(iso: string, timeZone: string, withTime = true): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()))
        return "—";
    try {
        return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { year: "numeric" }) }).format(d);
    }
    catch {
        return d.toISOString().slice(0, withTime ? 16 : 10).replace("T", " ");
    }
}
export function formatInterval(seconds: number): string {
    if (!seconds)
        return "Off";
    if (seconds < 60)
        return `${seconds} s`;
    if (seconds < 3600)
        return `${Math.round(seconds / 60)} min`;
    return `${Math.round(seconds / 3600)} h`;
}
export function parseTerms(text: string, max = 50, maxLen = 60): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of text.split(/[,\n]/)) {
        const t = raw.trim().slice(0, maxLen);
        if (!t || seen.has(t.toLowerCase()))
            continue;
        seen.add(t.toLowerCase());
        out.push(t);
        if (out.length >= max)
            break;
    }
    return out;
}
