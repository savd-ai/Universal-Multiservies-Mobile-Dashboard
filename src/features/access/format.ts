const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
export function formatWhen(iso: string | null | undefined): string {
    if (!iso)
        return "—";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? dateTime.format(t) : "—";
}
