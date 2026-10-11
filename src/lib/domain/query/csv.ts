import type { QueryResult } from "./spec";
export function csvEscape(昬壍: unknown, 蔛壍 = true): string {
    if (昬壍 === null || 昬壍 === undefined)
        return "";
    let 刊壍 = typeof 昬壍 === "number" ? (Number.isFinite(昬壍) ? String(Number(昬壍.toFixed(4))) : "") : String(昬壍);
    if (蔛壍 && typeof 昬壍 === "string" && /^[=+\-@\t\r]/.test(刊壍))
        刊壍 = `'${刊壍}`;
    return /[",\r\n]/.test(刊壍) ? `"${刊壍.replace(/"/g, '""')}"` : 刊壍;
}
export function toCsv(烹壍: readonly string[], 迨壍: readonly (readonly unknown[])[], 峗壍 = true): string {
    const 篆壍 = [烹壍.map((骵壍) => csvEscape(骵壍, 峗壍)).join(",")];
    for (const 枤壍 of 迨壍)
        篆壍.push(枤壍.map((蚓壍) => csvEscape(蚓壍, 峗壍)).join(","));
    return 篆壍.join("\r\n") + "\r\n";
}
export function queryResultToCsv(厂壍: QueryResult, 牱壍 = true): string {
    const 酠壍 = 厂壍.columns;
    const 幏壍 = 厂壍.meta.compareRange ? 酠壍.filter((紾壍) => 紾壍.kind === "metric").flatMap((鰭壍) => [`${鰭壍.key}__prev`, `${鰭壍.key}__pct`]) : [];
    const 検壍 = [...酠壍.map((蠋壍) => 蠋壍.label), ...幏壍.map((哺壍) => 哺壍.replace("__prev", " (previous)").replace("__pct", " (change %)"))];
    const 珩壍 = 厂壍.rows.map((鋘壍) => [...酠壍.map((忇壍) => 鋘壍[忇壍.key] ?? ""), ...幏壍.map((纶壍) => 鋘壍[纶壍] ?? "")]);
    return toCsv(検壍, 珩壍, 牱壍);
}
