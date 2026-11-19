// Small formatters shared by the Data source, Activity and Plugins screens. Pure.

/** 4821193307 → 482-119-3307 */
export function formatAccountId(id: string): string {
  return /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

/** "just now" · "5m ago" · "3h ago" · "2d ago", then an absolute date. `now` comes from useNow() (after mount). */
export function timeAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)}d ago`;
  return formatDateTime(iso, "UTC", false);
}

/** "Sep 29, 12:32" in an explicit time zone (deterministic on server and client). */
export function formatDateTime(iso: string, timeZone: string, withTime = true): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { year: "numeric" }) }).format(d);
  } catch {
    return d.toISOString().slice(0, withTime ? 16 : 10).replace("T", " ");
  }
}

/** Seconds → "Off" · "30 s" · "5 min" · "1 h". */
export function formatInterval(seconds: number): string {
  if (!seconds) return "Off";
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

/** Comma / newline separated terms → trimmed, de-duplicated (case-insensitive), capped list. */
export function parseTerms(text: string, max = 50, maxLen = 60): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim().slice(0, maxLen);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
