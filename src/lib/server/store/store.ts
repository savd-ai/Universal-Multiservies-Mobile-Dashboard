import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { appConfig } from "../env/config";
import { AppError } from "../http/errors";
import { log } from "../log";
import { singleton } from "../cache";
export interface BaseRecord {
    id: string;
    createdAt: string;
    updatedAt: string;
    version: number;
}
type NewRecord<T extends BaseRecord> = Omit<T, "id" | "createdAt" | "updatedAt" | "version"> & {
    id?: string;
};
export interface Driver {
    read(name: string): Promise<string | null>;
    write(name: string, content: string): Promise<void>;
    append(name: string, line: string): Promise<void>;
    readonly kind: "file" | "memory";
    readonly writable: boolean;
}
class MemoryDriver implements Driver {
    kind = "memory" as const;
    writable = true;
    private files = new Map<string, string>();
    async read(name: string) {
        return this.files.get(name) ?? null;
    }
    async write(name: string, content: string) {
        this.files.set(name, content);
    }
    async append(name: string, line: string) {
        this.files.set(name, (this.files.get(name) ?? "") + line);
    }
}
class FileDriver implements Driver {
    kind = "file" as const;
    writable = true;
    constructor(private readonly dir: string) { }
    private p(name: string) {
        return path.join(this.dir, name);
    }
    async read(name: string) {
        try {
            return await fs.readFile(this.p(name), "utf8");
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code === "ENOENT")
                return null;
            throw e;
        }
    }
    async write(name: string, content: string) {
        await fs.mkdir(path.dirname(this.p(name)), { recursive: true });
        const tmp = this.p(`${name}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`);
        const fh = await fs.open(tmp, "w");
        try {
            await fh.writeFile(content, "utf8");
            await fh.sync();
        }
        finally {
            await fh.close();
        }
        for (let attempt = 0;; attempt++) {
            try {
                await fs.rename(tmp, this.p(name));
                break;
            }
            catch (e) {
                const code = (e as NodeJS.ErrnoException).code;
                if ((code === "EPERM" || code === "EBUSY") && attempt < 3) {
                    await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
                    continue;
                }
                throw e;
            }
        }
    }
    async append(name: string, line: string) {
        await fs.mkdir(path.dirname(this.p(name)), { recursive: true });
        const file = this.p(name);
        try {
            const st = await fs.stat(file);
            if (st.size > 5 * 1024 * 1024)
                await this.rotate(name);
        }
        catch {
        }
        await fs.appendFile(file, line, "utf8");
    }
    private async rotate(name: string) {
        for (let i = 2; i >= 1; i--) {
            try {
                await fs.rename(this.p(`${name}.${i}`), this.p(`${name}.${i + 1}`));
            }
            catch {
            }
        }
        await fs.rename(this.p(name), this.p(`${name}.1`));
    }
}
class Mutex {
    private tail: Promise<void> = Promise.resolve();
    run<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.tail.then(fn, fn);
        this.tail = result.then(() => undefined, () => undefined);
        return result;
    }
}
interface FileShape<T> {
    schemaVersion: number;
    updatedAt: string;
    items: Record<string, T>;
}
export class Collection<T extends BaseRecord> {
    private cache: Map<string, T> | null = null;
    private mutex = new Mutex();
    constructor(private readonly driver: Driver, readonly name: string, private readonly seed?: () => T[]) { }
    private async load(): Promise<Map<string, T>> {
        if (this.cache)
            return this.cache;
        const raw = await this.driver.read(`${this.name}.json`);
        let items: Record<string, T> = {};
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as FileShape<T>;
                items = parsed.items ?? {};
            }
            catch {
                log.error(`Store collection ${this.name} is corrupt; starting empty and keeping a copy`);
                await this.driver.write(`${this.name}.corrupt-${Date.now()}.json`, raw).catch(() => undefined);
            }
        }
        else if (this.seed) {
            for (const s of this.seed())
                items[s.id] = s;
        }
        this.cache = new Map(Object.entries(items));
        return this.cache;
    }
    private async persist(map: Map<string, T>): Promise<void> {
        const shape: FileShape<T> = { schemaVersion: 1, updatedAt: new Date().toISOString(), items: Object.fromEntries(map) };
        await this.driver.write(`${this.name}.json`, JSON.stringify(shape, null, 2));
    }
    async list(filter?: (t: T) => boolean): Promise<T[]> {
        const map = await this.load();
        const all = [...map.values()];
        return filter ? all.filter(filter) : all;
    }
    async get(id: string): Promise<T | null> {
        return (await this.load()).get(id) ?? null;
    }
    async create(input: NewRecord<T>): Promise<T> {
        return this.mutex.run(async () => {
            const map = await this.load();
            const nowIso = new Date().toISOString();
            const id = input.id ?? randomUUID();
            if (map.has(id))
                throw new AppError("CONFLICT", `${this.name} ${id} already exists`);
            const rec = { ...input, id, createdAt: nowIso, updatedAt: nowIso, version: 1 } as T;
            map.set(id, rec);
            await this.persist(map);
            return rec;
        });
    }
    async update(id: string, patch: Partial<T> | ((prev: T) => T), opts: {
        expectedVersion?: number;
    } = {}): Promise<T> {
        return this.mutex.run(async () => {
            const map = await this.load();
            const prev = map.get(id);
            if (!prev)
                throw new AppError("NOT_FOUND", `${this.name} ${id} not found`);
            if (opts.expectedVersion !== undefined && opts.expectedVersion !== prev.version) {
                throw new AppError("CONFLICT", "This item was changed elsewhere. Reload to see the latest version.", { current: prev });
            }
            const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
            const rec = { ...next, id, createdAt: prev.createdAt, updatedAt: new Date().toISOString(), version: prev.version + 1 } as T;
            map.set(id, rec);
            await this.persist(map);
            return rec;
        });
    }
    async upsert(item: Omit<T, "createdAt" | "updatedAt" | "version"> & Partial<BaseRecord>): Promise<T> {
        return this.mutex.run(async () => {
            const map = await this.load();
            const prev = map.get(item.id);
            const nowIso = new Date().toISOString();
            const rec = { ...item, createdAt: prev?.createdAt ?? nowIso, updatedAt: nowIso, version: (prev?.version ?? 0) + 1 } as T;
            map.set(item.id, rec);
            await this.persist(map);
            return rec;
        });
    }
    async delete(id: string): Promise<boolean> {
        return this.mutex.run(async () => {
            const map = await this.load();
            const had = map.delete(id);
            if (had)
                await this.persist(map);
            return had;
        });
    }
    async restore(records: T[]): Promise<void> {
        if (!records.length)
            return;
        await this.mutex.run(async () => {
            const map = await this.load();
            for (const r of records)
                map.set(r.id, r);
            await this.persist(map);
        });
    }
    async take(filter: (t: T) => boolean): Promise<T[]> {
        return this.mutex.run(async () => {
            const map = await this.load();
            const hit = [...map.values()].filter(filter);
            if (!hit.length)
                return [];
            for (const r of hit)
                map.delete(r.id);
            await this.persist(map);
            return hit;
        });
    }
}
export class Singleton<T> {
    private col: Collection<{
        id: string;
        value: T;
    } & BaseRecord>;
    constructor(driver: Driver, name: string, private readonly defaults: () => T) {
        this.col = new Collection(driver, name);
    }
    async get(): Promise<T> {
        const rec = await this.col.get("singleton");
        return rec ? { ...this.defaults(), ...rec.value } : this.defaults();
    }
    async set(v: T | ((prev: T) => T)): Promise<T> {
        const prev = await this.get();
        const value = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        await this.col.upsert({ id: "singleton", value } as {
            id: string;
            value: T;
        } & BaseRecord);
        return value;
    }
}
export class AppendLog<T extends {
    ts: string;
}> {
    constructor(private readonly driver: Driver, private readonly name: string) { }
    async append(entry: T): Promise<void> {
        await this.driver.append(`${this.name}.jsonl`, `${JSON.stringify(entry)}\n`);
    }
    async tail(n: number, filter?: (e: T) => boolean): Promise<T[]> {
        const raw = await this.driver.read(`${this.name}.jsonl`);
        if (!raw)
            return [];
        const out: T[] = [];
        const lines = raw.split("\n");
        for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
            const line = lines[i];
            if (!line)
                continue;
            try {
                const e = JSON.parse(line) as T;
                if (!filter || filter(e))
                    out.push(e);
            }
            catch {
            }
        }
        return out;
    }
}
export interface StoreInfo {
    driver: "file" | "memory";
    dir: string | null;
    writable: boolean;
    fallbackReason?: string;
}
const info = () => singleton("store:driverInfo", () => ({ value: null as StoreInfo | null }));
async function probeWritable(dir: string): Promise<boolean> {
    try {
        await fs.mkdir(dir, { recursive: true });
        const probe = path.join(dir, `.probe-${process.pid}`);
        await fs.writeFile(probe, "ok");
        await fs.unlink(probe);
        return true;
    }
    catch {
        return false;
    }
}
export function getDriver(): Driver {
    return singleton("store:driver", () => {
        const cfg = appConfig();
        if (cfg.storeDriver === "memory" || !cfg.dataDir) {
            info().value = { driver: "memory", dir: null, writable: true, fallbackReason: cfg.storeDriver === "memory" ? "STORE_DRIVER=memory" : "DATA_DIR is empty" };
            return new MemoryDriver();
        }
        const dir = path.resolve(process.cwd(), cfg.dataDir);
        const file = new FileDriver(dir);
        const memory = new MemoryDriver();
        let resolved: Driver | null = null;
        const pick = async (): Promise<Driver> => {
            if (resolved)
                return resolved;
            const ok = await probeWritable(dir);
            resolved = ok ? file : memory;
            const next: StoreInfo = ok ? { driver: "file", dir, writable: true } : { driver: "memory", dir, writable: false, fallbackReason: `${dir} is not writable; changes are kept in memory until restart` };
            info().value = next;
            if (!ok)
                log.warn(next.fallbackReason ?? "store fallback");
            return resolved;
        };
        const proxy: Driver = {
            kind: "file",
            writable: true,
            read: async (n) => (await pick()).read(n),
            write: async (n, c) => (await pick()).write(n, c),
            append: async (n, l) => (await pick()).append(n, l),
        };
        info().value = { driver: "file", dir, writable: true };
        return proxy;
    });
}
export function prefixedDriver(base: Driver, prefix: string): Driver {
    if (!/^[a-z0-9][a-z0-9/-]*\/$/.test(prefix) || prefix.includes(".."))
        throw new Error(`Invalid store prefix ${prefix}`);
    return {
        get kind() {
            return base.kind;
        },
        get writable() {
            return base.writable;
        },
        read: (n) => base.read(prefix + n),
        write: (n, c) => base.write(prefix + n, c),
        append: (n, l) => base.append(prefix + n, l),
    };
}
export function storeInfo(): StoreInfo {
    const driver = getDriver();
    return info().value ?? { driver: driver.kind, dir: null, writable: driver.writable };
}
