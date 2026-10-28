import type { QueryResult } from "./spec";
export function csvEscape(value: unknown, safe = true): string {
    if (value === null || value === undefined)
        return "";
    let s = typeof value === "number" ? (Number.isFinite(value) ? String(Number(value.toFixed(4))) : "") : String(value);
    if (safe && typeof value === "string" && /^[=+\-@\t\r]/.test(s))
        s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[], safe = true): string {
    const lines = [header.map((h) => csvEscape(h, safe)).join(",")];
    for (const r of rows)
        lines.push(r.map((v) => csvEscape(v, safe)).join(","));
    return lines.join("\r\n") + "\r\n";
}
export function queryResultToCsv(result: QueryResult, safe = true): string {
    const cols = result.columns;
    const compareKeys = result.meta.compareRange ? cols.filter((c) => c.kind === "metric").flatMap((c) => [`${c.key}__prev`, `${c.key}__pct`]) : [];
    const header = [...cols.map((c) => c.label), ...compareKeys.map((k) => k.replace("__prev", " (previous)").replace("__pct", " (change %)"))];
    const rows = result.rows.map((r) => [...cols.map((c) => r[c.key] ?? ""), ...compareKeys.map((k) => r[k] ?? "")]);
    return toCsv(header, rows, safe);
}
