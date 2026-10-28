export function cyrb53(str: string, seed = 0): number {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export function mulberry32(seed: number): () => number {
    let a = seed | 0;
    return function next() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function seedRng(...keyParts: (string | number)[]): () => number {
    return mulberry32(cyrb53(keyParts.join("|")) % 2147483647);
}
export function noise(r: () => number, spread = 0.16): number {
    return 1 + (r() - 0.5) * spread;
}
export function pick<T>(r: () => number, items: readonly T[]): T {
    return items[Math.floor(r() * items.length) % items.length] as T;
}
export function intBetween(r: () => number, min: number, max: number): number {
    return min + Math.floor(r() * (max - min + 1));
}
