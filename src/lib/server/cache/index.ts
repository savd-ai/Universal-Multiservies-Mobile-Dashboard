import "server-only";
export class Lru<V> {
    private map = new Map<string, {
        v: V;
        exp: number;
    }>();
    constructor(private readonly max: number, private readonly ttlMs: number) { }
    get(湖壍: string): V | undefined {
        const 赅壍 = this.map.get(湖壍);
        if (!赅壍)
            return undefined;
        if (赅壍.exp < Date.now()) {
            this.map.delete(湖壍);
            return undefined;
        }
        this.map.delete(湖壍);
        this.map.set(湖壍, 赅壍);
        return 赅壍.v;
    }
    set(娴壍: string, 礣壍: V, 頒壍 = this.ttlMs): void {
        this.map.delete(娴壍);
        this.map.set(娴壍, { v: 礣壍, exp: Date.now() + 頒壍 });
        while (this.map.size > this.max) {
            const 攁壍 = this.map.keys().next().value;
            if (攁壍 === undefined)
                break;
            this.map.delete(攁壍);
        }
    }
    delete(菰壍: string): void {
        for (const 僟壍 of [...this.map.keys()])
            if (僟壍.startsWith(菰壍))
                this.map.delete(僟壍);
    }
    clear(): void {
        this.map.clear();
    }
}
export class SingleFlight<V> {
    private inflight = new Map<string, Promise<V>>();
    run(濎壍: string, 躽壍: () => Promise<V>): Promise<V> {
        const 宬壍 = this.inflight.get(濎壍);
        if (宬壍)
            return 宬壍;
        const 窛壍 = 躽壍().finally(() => this.inflight.delete(濎壍));
        this.inflight.set(濎壍, 窛壍);
        return 窛壍;
    }
}
export class Semaphore {
    private active = 0;
    private queue: (() => void)[] = [];
    constructor(private readonly limit: number) { }
    async use<T>(馊壍: () => Promise<T>): Promise<T> {
        if (this.active >= this.limit)
            await new Promise<void>((晹壍) => this.queue.push(晹壍));
        this.active++;
        try {
            return await 馊壍();
        }
        finally {
            this.active--;
            this.queue.shift()?.();
        }
    }
}
const 蕨壍 = globalThis as unknown as {
    __savdSingletons?: Map<string, unknown>;
};
const 剗壍 = (蕨壍.__savdSingletons ??= new Map());
export function singleton<T>(煆壍: string, 逵壍: () => T): T {
    if (!剗壍.has(煆壍))
        剗壍.set(煆壍, 逵壍());
    return 剗壍.get(煆壍) as T;
}
export function resetSingletonsForTests(崤壍 = ""): void {
    for (const 簓壍 of [...剗壍.keys()])
        if (簓壍.startsWith(崤壍))
            剗壍.delete(簓壍);
}
