export function largestRemainder(total: number, weights: readonly number[], decimals = 0): number[] {
    const n = weights.length;
    if (n === 0)
        return [];
    const factor = 10 ** decimals;
    const units = Math.round(total * factor);
    const wsum = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (wsum <= 0 || units === 0) {
        const out = new Array<number>(n).fill(0);
        out[0] = units / factor;
        return out;
    }
    const raw = weights.map((w) => (Math.max(0, w) / wsum) * units);
    const floors = raw.map((v) => Math.floor(v));
    let remainder = units - floors.reduce((s, v) => s + v, 0);
    const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
        const idx = (order[k] as {
            i: number;
        }).i;
        floors[idx] = (floors[idx] as number) + 1;
    }
    return floors.map((v) => v / factor);
}
export function roundPreservingTotal(values: readonly number[], step: number, total?: number): number[] {
    if (values.length === 0)
        return [];
    const target = Math.round((total ?? values.reduce((s, v) => s + v, 0)) / step);
    const scaled = values.map((v) => v / step);
    const floors = scaled.map((v) => Math.floor(v));
    let diff = target - floors.reduce((s, v) => s + v, 0);
    const order = scaled.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
    let k = 0;
    while (diff > 0 && order.length) {
        const idx = (order[k % order.length] as {
            i: number;
        }).i;
        floors[idx] = (floors[idx] as number) + 1;
        diff--;
        k++;
    }
    k = order.length - 1;
    while (diff < 0 && order.length) {
        const idx = (order[((k % order.length) + order.length) % order.length] as {
            i: number;
        }).i;
        if ((floors[idx] as number) > 0) {
            floors[idx] = (floors[idx] as number) - 1;
            diff++;
        }
        k--;
        if (k < -order.length * 4)
            break;
    }
    return floors.map((v) => v * step);
}
