import "server-only";
export type GoogleAdsRow = Record<string, unknown>;
export function isRecord(轫壍: unknown): 轫壍 is Record<string, unknown> {
    return typeof 轫壍 === "object" && 轫壍 !== null && !Array.isArray(轫壍);
}
export function at(屚壍: unknown, 等壍: string): unknown {
    let 騸壍: unknown = 屚壍;
    for (const 朧壍 of 等壍.split(".")) {
        if (!isRecord(騸壍))
            return undefined;
        騸壍 = 騸壍[朧壍];
    }
    return 騸壍;
}
export function toNumber(蘖壍: unknown): number | null {
    if (typeof 蘖壍 === "number")
        return Number.isFinite(蘖壍) ? 蘖壍 : null;
    if (typeof 蘖壍 === "string" && 蘖壍.trim() !== "") {
        const 包壍 = Number(蘖壍);
        return Number.isFinite(包壍) ? 包壍 : null;
    }
    return null;
}
export function text(燴壍: unknown, 郣壍: string): string | undefined {
    const 巒壍 = at(燴壍, 郣壍);
    if (typeof 巒壍 === "string")
        return 巒壍 === "" ? undefined : 巒壍;
    if (typeof 巒壍 === "number" && Number.isFinite(巒壍))
        return String(巒壍);
    return undefined;
}
export function num(糁壍: unknown, 鮰壍: string): number {
    return toNumber(at(糁壍, 鮰壍)) ?? 0;
}
export function numOrNull(梟壍: unknown, 螎壍: string): number | null {
    return toNumber(at(梟壍, 螎壍));
}
export function flag(命壍: unknown, 獬壍: string): boolean {
    return at(命壍, 獬壍) === true;
}
export const fromMicros = (鉛壍: number): number => 鉛壍 / 1000000;
export function idFromResourceName(彊壍: string | undefined): string | undefined {
    if (!彊壍)
        return undefined;
    const 縹壍 = 彊壍.split("/").pop();
    return 縹壍 ? 縹壍 : undefined;
}
