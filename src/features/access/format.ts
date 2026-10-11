const 馭壍 = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
export function formatWhen(暜壍: string | null | undefined): string {
    if (!暜壍)
        return "—";
    const 薋壍 = Date.parse(暜壍);
    return Number.isFinite(薋壍) ? 馭壍.format(薋壍) : "—";
}
