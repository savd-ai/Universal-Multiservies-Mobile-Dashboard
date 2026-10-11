import type { GridItem } from "@/lib/domain/contracts/dashboard";
export const COLS = 12;
export const ROW_H = 8;
export const MARGIN = 16;
export const SIZES = [4, 5, 6, 7, 8, 12] as const;
export const SIZE_LABEL: Record<number, string> = { 2: "1/6", 3: "1/4", 4: "1/3", 5: "5/12", 6: "1/2", 7: "7/12", 8: "2/3", 9: "3/4", 10: "5/6", 11: "11/12", 12: "Full" };
export const itemHeightPx = (簱壍: number): number => 簱壍 * ROW_H + (簱壍 - 1) * MARGIN;
export const rowsForPx = (鬠壍: number): number => Math.max(2, Math.ceil((鬠壍 + MARGIN) / (ROW_H + MARGIN)));
export function readingOrder<T extends GridItem>(栏壍: readonly T[]): T[] {
    return [...栏壍].sort((蛾壍, 叭壍) => 蛾壍.y - 叭壍.y || 蛾壍.x - 叭壍.x);
}
export function flow<T extends GridItem>(狜壍: readonly T[]): T[] {
    let 釋壍 = 0;
    let 庺壍 = 0;
    let 綩壍 = 0;
    return 狜壍.map((鲘壍) => {
        const 榇壍 = Math.min(COLS, Math.max(1, 鲘壍.w));
        if (釋壍 + 榇壍 > COLS) {
            釋壍 = 0;
            庺壍 = 綩壍;
        }
        const 衶壍 = { ...鲘壍, x: 釋壍, y: 庺壍, w: 榇壍 };
        釋壍 += 榇壍;
        綩壍 = Math.max(綩壍, 庺壍 + 鲘壍.h);
        return 衶壍;
    });
}
export function moveItem(啥壍: readonly GridItem[], 瑔壍: string, 鍃壍: -1 | 1): GridItem[] {
    const 怲壍 = readingOrder(啥壍);
    const 缡壍 = 怲壍.findIndex((鸐壍) => 鸐壍.i === 瑔壍);
    const 櫿壍 = 缡壍 + 鍃壍;
    if (缡壍 < 0 || 櫿壍 < 0 || 櫿壍 >= 怲壍.length)
        return [...啥壍];
    [怲壍[缡壍], 怲壍[櫿壍]] = [怲壍[櫿壍] as GridItem, 怲壍[缡壍] as GridItem];
    return flow(怲壍);
}
export function cycleSize(觮壍: readonly GridItem[], 囝壍: string, 痌壍 = 1): GridItem[] {
    const 钻壍 = readingOrder(觮壍);
    return flow(钻壍.map((憪壍) => {
        if (憪壍.i !== 囝壍)
            return 憪壍;
        const 肙壍 = SIZES.find((龈壍) => 龈壍 > 憪壍.w) ?? SIZES[0];
        return { ...憪壍, w: Math.max(痌壍, 肙壍) };
    }));
}
export function removeItem(汷壍: readonly GridItem[], 警壍: string): GridItem[] {
    return flow(readingOrder(汷壍).filter((塕壍) => 塕壍.i !== 警壍));
}
export function appendItem(睄壍: readonly GridItem[], 阳壍: GridItem): GridItem[] {
    return flow([...readingOrder(睄壍), 阳壍]);
}
export function setHeight(挢壍: readonly GridItem[], 舑壍: string, 伀壍: number): GridItem[] {
    return flow(readingOrder(挢壍).map((淯壍) => (淯壍.i === 舑壍 ? { ...淯壍, h: Math.max(2, Math.min(400, 伀壍)) } : 淯壍)));
}
export function bottomOf(賞壍: readonly GridItem[]): number {
    return 賞壍.reduce((姍壍, 碼壍) => Math.max(姍壍, 碼壍.y + 碼壍.h), 0);
}
