// Time copy for the Anomalies pages. Pure: the caller passes "now" (read after mount, never during SSR).

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now" · "5 min ago" · "3 h ago" · "2 d ago" · "in 4 h"; "" until the clock is known. */
export function relativeTime(iso: string | null | undefined, nowMs: number | null): string {
  if (!iso || nowMs === null) return "";
  const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (!Number.isFinite(t)) return "";
  const diff = nowMs - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  if (abs < MIN) return future ? "in under a minute" : "just now";
  const body = abs < HOUR ? `${Math.round(abs / MIN)} min` : abs < DAY ? `${Math.round(abs / HOUR)} h` : `${Math.round(abs / DAY)} d`;
  return future ? `in ${body}` : `${body} ago`;
}

const dtCache = new Map<string, Intl.DateTimeFormat>();

/** "Sep 29, 8:19 AM" in the given time zone (defaults to UTC so server and client agree). */
export function formatDateTime(iso: string | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "—";
  const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (!Number.isFinite(t)) return "—";
  let f = dtCache.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      f = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
    dtCache.set(timeZone, f);
  }
  return f.format(new Date(t));
}

/** 1 → "1 hour", 24 → "24 hours", 168 → "7 days". */
export function hoursLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
