import "server-only";
export class Lru<V> {
    private map = new Map<string, {
        v: V;
        exp: number;
    }>();
    constructor(private readonly max: number, private readonly ttlMs: number) { }
    get(key: string): V | undefined {
        const e = this.map.get(key);
        if (!e)
            return undefined;
        if (e.exp < Date.now()) {
            this.map.delete(key);
            return undefined;
        }
        this.map.delete(key);
        this.map.set(key, e);
        return e.v;
    }
    set(key: string, v: V, ttlMs = this.ttlMs): void {
        this.map.delete(key);
        this.map.set(key, { v, exp: Date.now() + ttlMs });
        while (this.map.size > this.max) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined)
                break;
            this.map.delete(oldest);
        }
    }
    delete(prefix: string): void {
        for (const k of [...this.map.keys()])
            if (k.startsWith(prefix))
                this.map.delete(k);
    }
    clear(): void {
        this.map.clear();
    }
}
export class SingleFlight<V> {
    private inflight = new Map<string, Promise<V>>();
    run(key: string, fn: () => Promise<V>): Promise<V> {
        const existing = this.inflight.get(key);
        if (existing)
            return existing;
        const p = fn().finally(() => this.inflight.delete(key));
        this.inflight.set(key, p);
        return p;
    }
}
export class Semaphore {
    private active = 0;
    private queue: (() => void)[] = [];
    constructor(private readonly limit: number) { }
    async use<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.limit)
            await new Promise<void>((resolve) => this.queue.push(resolve));
        this.active++;
        try {
            return await fn();
        }
        finally {
            this.active--;
            this.queue.shift()?.();
        }
    }
}
const g = globalThis as unknown as {
    __savdSingletons?: Map<string, unknown>;
};
const singletons = (g.__savdSingletons ??= new Map());
export function singleton<T>(key: string, create: () => T): T {
    if (!singletons.has(key))
        singletons.set(key, create());
    return singletons.get(key) as T;
}
export function resetSingletonsForTests(prefix = ""): void {
    for (const k of [...singletons.keys()])
        if (k.startsWith(prefix))
            singletons.delete(k);
}
