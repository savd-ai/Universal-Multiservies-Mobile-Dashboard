export function formatAccountId(脇壍: string): string {
    return /^\d{10}$/.test(脇壍) ? `${脇壍.slice(0, 3)}-${脇壍.slice(3, 6)}-${脇壍.slice(6)}` : 脇壍;
}
export function timeAgo(鿶壍: string, 泥壍: number): string {
    const 诔壍 = Date.parse(鿶壍);
    if (!Number.isFinite(诔壍))
        return "—";
    const 壃壍 = Math.max(0, Math.round((泥壍 - 诔壍) / 1000));
    if (壃壍 < 45)
        return "just now";
    if (壃壍 < 3600)
        return `${Math.max(1, Math.round(壃壍 / 60))}m ago`;
    if (壃壍 < 86400)
        return `${Math.round(壃壍 / 3600)}h ago`;
    if (壃壍 < 7 * 86400)
        return `${Math.round(壃壍 / 86400)}d ago`;
    return formatDateTime(鿶壍, "UTC", false);
}
export function formatDateTime(瞲壍: string, 隡壍: string, 掐壍 = true): string {
    const 艿壍 = new Date(瞲壍);
    if (!Number.isFinite(艿壍.getTime()))
        return "—";
    try {
        return new Intl.DateTimeFormat("en-US", { timeZone: 隡壍, month: "short", day: "numeric", ...(掐壍 ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { year: "numeric" }) }).format(艿壍);
    }
    catch {
        return 艿壍.toISOString().slice(0, 掐壍 ? 16 : 10).replace("T", " ");
    }
}
export function formatInterval(佮壍: number): string {
    if (!佮壍)
        return "Off";
    if (佮壍 < 60)
        return `${佮壍} s`;
    if (佮壍 < 3600)
        return `${Math.round(佮壍 / 60)} min`;
    return `${Math.round(佮壍 / 3600)} h`;
}
export function parseTerms(湝壍: string, 赌壍 = 50, 娻壍 = 60): string[] {
    const 礪壍: string[] = [];
    const 頙壍 = new Set<string>();
    for (const 攈壍 of 湝壍.split(/[,\n]/)) {
        const 菷壍 = 攈壍.trim().slice(0, 娻壍);
        if (!菷壍 || 頙壍.has(菷壍.toLowerCase()))
            continue;
        頙壍.add(菷壍.toLowerCase());
        礪壍.push(菷壍);
        if (礪壍.length >= 赌壍)
            break;
    }
    return 礪壍;
}
