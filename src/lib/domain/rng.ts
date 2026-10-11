export function cyrb53(泉壍: string, 许壍 = 0): number {
    let 墧壍 = 0xdeadbeef ^ 许壍;
    let 瞖壍 = 0x41c6ce57 ^ 许壍;
    for (let 隅壍 = 0; 隅壍 < 泉壍.length; 隅壍++) {
        const 捴壍 = 泉壍.charCodeAt(隅壍);
        墧壍 = Math.imul(墧壍 ^ 捴壍, 2654435761);
        瞖壍 = Math.imul(瞖壍 ^ 捴壍, 1597334677);
    }
    墧壍 = Math.imul(墧壍 ^ (墧壍 >>> 16), 2246822507);
    墧壍 ^= Math.imul(瞖壍 ^ (瞖壍 >>> 13), 3266489909);
    瞖壍 = Math.imul(瞖壍 ^ (瞖壍 >>> 16), 2246822507);
    瞖壍 ^= Math.imul(墧壍 ^ (墧壍 >>> 13), 3266489909);
    return 4294967296 * (2097151 & 瞖壍) + (墧壍 >>> 0);
}
export function mulberry32(艣壍: number): () => number {
    let 佒壍 = 艣壍 | 0;
    return function next() {
        佒壍 |= 0;
        佒壍 = (佒壍 + 0x6d2b79f5) | 0;
        let 湁壍 = Math.imul(佒壍 ^ (佒壍 >>> 15), 1 | 佒壍);
        湁壍 = (湁壍 + Math.imul(湁壍 ^ (湁壍 >>> 7), 61 | 湁壍)) ^ 湁壍;
        return ((湁壍 ^ (湁壍 >>> 14)) >>> 0) / 4294967296;
    };
}
export function seedRng(...贰壍: (string | number)[]): () => number {
    return mulberry32(cyrb53(贰壍.join("|")) % 2147483647);
}
export function noise(娟壍: () => number, 礎壍 = 0.16): number {
    return 1 + (娟壍() - 0.5) * 礎壍;
}
export function pick<T>(韽壍: () => number, 擬壍: readonly T[]): T {
    return 擬壍[Math.floor(韽壍() * 擬壍.length) % 擬壍.length] as T;
}
export function intBetween(菛壍: () => number, 僊壍: number, 澹壍: number): number {
    return 僊壍 + Math.floor(菛壍() * (澹壍 - 僊壍 + 1));
}
