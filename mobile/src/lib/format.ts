/** Number and date formatting for a phone screen (compact, en-US like the web dashboard). */
const compact = (value: number, digits = 1) => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(digits)}K`;
  return Math.round(value).toLocaleString("en-US");
};

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", VND: "₫", JPY: "¥", AUD: "A$", CAD: "C$" };

export function money(value: number | null | undefined, currency = "USD", options: { exact?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const abs = Math.abs(value);
  const body = options.exact || abs < 1e4 ? abs.toLocaleString("en-US", { minimumFractionDigits: abs < 100 ? 2 : 0, maximumFractionDigits: abs < 100 ? 2 : 0 }) : compact(abs);
  return `${value < 0 ? "−" : ""}${symbol}${body}`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return compact(value);
}

export function decimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.abs(value) >= 1e4 ? compact(value) : value.toLocaleString("en-US", { maximumFractionDigits: value < 100 ? 1 : 0 });
}

export function percent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function ratio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

/** Signal values use the metric's own format (money, number, decimal, percent, ratio). */
export function formatValue(format: string, value: number, currency = "USD"): string {
  switch (format) {
    case "money":
      return money(value, currency);
    case "percent":
      return percent(value);
    case "ratio":
      return ratio(value);
    case "decimal":
      return decimal(value);
    default:
      return count(value);
  }
}

export function delta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function signedPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value * 100).toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-17" → "Oct 17"; with year → "Oct 17, 2026". */
export function shortDate(civil: string, withYear = false): string {
  const [year, month, day] = civil.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return civil;
  return `${MONTHS[month - 1]} ${day}${withYear ? `, ${year}` : ""}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return month ? `${MONTHS[month - 1]}${year ? ` ’${String(year).slice(2)}` : ""}` : key;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : shortDate(iso.slice(0, 10), true);
}

export function hours(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 48) return `${value.toFixed(value < 10 ? 1 : 0)} h`;
  return `${(value / 24).toFixed(1)} days`;
}

export const SEVERITY_LABEL = { critical: "Critical", warning: "Warning", info: "Opportunity" } as const;
