import type { GridItem } from "@/lib/domain/contracts/dashboard";
export const COLS = 12;
export const ROW_H = 8;
export const MARGIN = 16;
export const SIZES = [4, 5, 6, 7, 8, 12] as const;
export const SIZE_LABEL: Record<number, string> = { 2: "1/6", 3: "1/4", 4: "1/3", 5: "5/12", 6: "1/2", 7: "7/12", 8: "2/3", 9: "3/4", 10: "5/6", 11: "11/12", 12: "Full" };
export const itemHeightPx = (h: number): number => h * ROW_H + (h - 1) * MARGIN;
export const rowsForPx = (px: number): number => Math.max(2, Math.ceil((px + MARGIN) / (ROW_H + MARGIN)));
export function readingOrder<T extends GridItem>(layout: readonly T[]): T[] {
    return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}
export function flow<T extends GridItem>(items: readonly T[]): T[] {
    let x = 0;
    let rowY = 0;
    let rowBottom = 0;
    return items.map((it) => {
        const w = Math.min(COLS, Math.max(1, it.w));
        if (x + w > COLS) {
            x = 0;
            rowY = rowBottom;
        }
        const placed = { ...it, x, y: rowY, w };
        x += w;
        rowBottom = Math.max(rowBottom, rowY + it.h);
        return placed;
    });
}
export function moveItem(layout: readonly GridItem[], id: string, dir: -1 | 1): GridItem[] {
    const order = readingOrder(layout);
    const i = order.findIndex((l) => l.i === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length)
        return [...layout];
    [order[i], order[j]] = [order[j] as GridItem, order[i] as GridItem];
    return flow(order);
}
export function cycleSize(layout: readonly GridItem[], id: string, minW = 1): GridItem[] {
    const order = readingOrder(layout);
    return flow(order.map((l) => {
        if (l.i !== id)
            return l;
        const next = SIZES.find((s) => s > l.w) ?? SIZES[0];
        return { ...l, w: Math.max(minW, next) };
    }));
}
export function removeItem(layout: readonly GridItem[], id: string): GridItem[] {
    return flow(readingOrder(layout).filter((l) => l.i !== id));
}
export function appendItem(layout: readonly GridItem[], item: GridItem): GridItem[] {
    return flow([...readingOrder(layout), item]);
}
export function setHeight(layout: readonly GridItem[], id: string, h: number): GridItem[] {
    return flow(readingOrder(layout).map((l) => (l.i === id ? { ...l, h: Math.max(2, Math.min(400, h)) } : l)));
}
export function bottomOf(layout: readonly GridItem[]): number {
    return layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
}
