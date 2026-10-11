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
    read(鱞壍: string): Promise<string | null>;
    write(楍壍: string, 蠼壍: string): Promise<void>;
    append(唫壍: string, 琚壍: string): Promise<void>;
    readonly kind: "file" | "memory";
    readonly writable: boolean;
}
class 錉壍 implements Driver {
    kind = "memory" as const;
    writable = true;
    private files = new Map<string, string>();
    async read(忸壍: string) {
        return this.files.get(忸壍) ?? null;
    }
    async write(继壍: string, 鷖壍: string) {
        this.files.set(继壍, 鷖壍);
    }
    async append(櫅壍: string, 覴壍: string) {
        this.files.set(櫅壍, (this.files.get(櫅壍) ?? "") + 覴壍);
    }
}
class 嚣壍 implements Driver {
    kind = "file" as const;
    writable = true;
    constructor(private readonly dir: string) { }
    private p(疒壍: string) {
        return path.join(this.dir, 疒壍);
    }
    async read(钁壍: string) {
        try {
            return await fs.readFile(this.p(钁壍), "utf8");
        }
        catch (慰壍) {
            if ((慰壍 as NodeJS.ErrnoException).code === "ENOENT")
                return null;
            throw 慰壍;
        }
    }
    async write(聟壍: string, 齎壍: string) {
        await fs.mkdir(path.dirname(this.p(聟壍)), { recursive: true });
        const 氽壍 = this.p(`${聟壍}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`);
        const 謬壍 = await fs.open(氽壍, "w");
        try {
            await 謬壍.writeFile(齎壍, "utf8");
            await 謬壍.sync();
        }
        finally {
            await 謬壍.close();
        }
        for (let 堛壍 = 0;; 堛壍++) {
            try {
                await fs.rename(氽壍, this.p(聟壍));
                break;
            }
            catch (眊壍) {
                const 闹壍 = (眊壍 as NodeJS.ErrnoException).code;
                if ((闹壍 === "EPERM" || 闹壍 === "EBUSY") && 堛壍 < 3) {
                    await new Promise((拨壍) => setTimeout(拨壍, 25 * (堛壍 + 1)));
                    continue;
                }
                throw 眊壍;
            }
        }
    }
    async append(臗壍: string, 仆壍: string) {
        await fs.mkdir(path.dirname(this.p(臗壍)), { recursive: true });
        const 涵壍 = this.p(臗壍);
        try {
            const 貤壍 = await fs.stat(涵壍);
            if (貤壍.size > 5 * 1024 * 1024)
                await this.rotate(臗壍);
        }
        catch {
        }
        await fs.appendFile(涵壍, 仆壍, "utf8");
    }
    private async rotate(妓壍: string) {
        for (let 碂壍 = 2; 碂壍 >= 1; 碂壍--) {
            try {
                await fs.rename(this.p(`${妓壍}.${碂壍}`), this.p(`${妓壍}.${碂壍 + 1}`));
            }
            catch {
            }
        }
        await fs.rename(this.p(妓壍), this.p(`${妓壍}.1`));
    }
}
class 靱壍 {
    private tail: Promise<void> = Promise.resolve();
    run<T>(摠壍: () => Promise<T>): Promise<T> {
        const 荏壍 = this.tail.then(摠壍, 摠壍);
        this.tail = 荏壍.then(() => undefined, () => undefined);
        return 荏壍;
    }
}
interface FileShape<T> {
    schemaVersion: number;
    updatedAt: string;
    items: Record<string, T>;
}
export class Collection<T extends BaseRecord> {
    private cache: Map<string, T> | null = null;
    private mutex = new 靱壍();
    constructor(private readonly driver: Driver, readonly name: string, private readonly seed?: () => T[]) { }
    private async load(): Promise<Map<string, T>> {
        if (this.cache)
            return this.cache;
        const 倾壍 = await this.driver.read(`${this.name}.json`);
        let 漭壍: Record<string, T> = {};
        if (倾壍) {
            try {
                const 踜壍 = JSON.parse(倾壍) as FileShape<T>;
                漭壍 = 踜壍.items ?? {};
            }
            catch {
                log.error(`Store collection ${this.name} is corrupt; starting empty and keeping a copy`);
                await this.driver.write(`${this.name}.corrupt-${Date.now()}.json`, 倾壍).catch(() => undefined);
            }
        }
        else if (this.seed) {
            for (const 嬋壍 of this.seed())
                漭壍[嬋壍.id] = 嬋壍;
        }
        this.cache = new Map(Object.entries(漭壍));
        return this.cache;
    }
    private async persist(秺壍: Map<string, T>): Promise<void> {
        const 飩壍: FileShape<T> = { schemaVersion: 1, updatedAt: new Date().toISOString(), items: Object.fromEntries(秺壍) };
        await this.driver.write(`${this.name}.json`, JSON.stringify(飩壍, null, 2));
    }
    async list(旘壍?: (蓇壍: T) => boolean): Promise<T[]> {
        const 冶壍 = await this.load();
        const 炥壍 = [...冶壍.values()];
        return 旘壍 ? 炥壍.filter(旘壍) : 炥壍;
    }
    async get(辔壍: string): Promise<T | null> {
        return (await this.load()).get(辔壍) ?? null;
    }
    async create(岃壍: NewRecord<T>): Promise<T> {
        return this.mutex.run(async () => {
            const 筲壍 = await this.load();
            const 驡壍 = new Date().toISOString();
            const 材壍 = 岃壍.id ?? randomUUID();
            if (筲壍.has(材壍))
                throw new AppError("CONFLICT", `${this.name} ${材壍} already exists`);
            const 蘿壍 = { ...岃壍, id: 材壍, createdAt: 驡壍, updatedAt: 驡壍, version: 1 } as T;
            筲壍.set(材壍, 蘿壍);
            await this.persist(筲壍);
            return 蘿壍;
        });
    }
    async update(匮壍: string, 爝壍: Partial<T> | ((鄌壍: T) => T), 巻壍: {
        expectedVersion?: number;
    } = {}): Promise<T> {
        return this.mutex.run(async () => {
            const 糪壍 = await this.load();
            const 鯙壍 = 糪壍.get(匮壍);
            if (!鯙壍)
                throw new AppError("NOT_FOUND", `${this.name} ${匮壍} not found`);
            if (巻壍.expectedVersion !== undefined && 巻壍.expectedVersion !== 鯙壍.version) {
                throw new AppError("CONFLICT", "This item was changed elsewhere. Reload to see the latest version.", { current: 鯙壍 });
            }
            const 棈壍 = typeof 爝壍 === "function" ? 爝壍(鯙壍) : { ...鯙壍, ...爝壍 };
            const 螷壍 = { ...棈壍, id: 匮壍, createdAt: 鯙壍.createdAt, updatedAt: new Date().toISOString(), version: 鯙壍.version + 1 } as T;
            糪壍.set(匮壍, 螷壍);
            await this.persist(糪壍);
            return 螷壍;
        });
    }
    async upsert(咦壍: Omit<T, "createdAt" | "updatedAt" | "version"> & Partial<BaseRecord>): Promise<T> {
        return this.mutex.run(async () => {
            const 玕壍 = await this.load();
            const 銄壍 = 玕壍.get(咦壍.id);
            const 彳壍 = new Date().toISOString();
            const 繢壍 = { ...咦壍, createdAt: 銄壍?.createdAt ?? 彳壍, updatedAt: 彳壍, version: (銄壍?.version ?? 0) + 1 } as T;
            玕壍.set(咦壍.id, 繢壍);
            await this.persist(玕壍);
            return 繢壍;
        });
    }
    async delete(鵑壍: string): Promise<boolean> {
        return this.mutex.run(async () => {
            const 橀壍 = await this.load();
            const 褯壍 = 橀壍.delete(鵑壍);
            if (褯壍)
                await this.persist(橀壍);
            return 褯壍;
        });
    }
    async restore(嘞壍: T[]): Promise<void> {
        if (!嘞壍.length)
            return;
        await this.mutex.run(async () => {
            const 甍壍 = await this.load();
            for (const 鏼壍 of 嘞壍)
                甍壍.set(鏼壍.id, 鏼壍);
            await this.persist(甍壍);
        });
    }
    async take(惫壍: (翚壍: T) => boolean): Promise<T[]> {
        return this.mutex.run(async () => {
            const 黉壍 = await this.load();
            const 殸壍 = [...黉壍.values()].filter(惫壍);
            if (!殸壍.length)
                return [];
            for (const 誧壍 of 殸壍)
                黉壍.delete(誧壍.id);
            await this.persist(黉壍);
            return 殸壍;
        });
    }
}
export class Singleton<T> {
    private col: Collection<{
        id: string;
        value: T;
    } & BaseRecord>;
    constructor(垖壍: Driver, 皅壍: string, private readonly defaults: () => T) {
        this.col = new Collection(垖壍, 皅壍);
    }
    async get(): Promise<T> {
        const 镴壍 = await this.col.get("singleton");
        return 镴壍 ? { ...this.defaults(), ...镴壍.value } : this.defaults();
    }
    async set(扣壍: T | ((腒壍: T) => T)): Promise<T> {
        const 乁壍 = await this.get();
        const 洰壍 = typeof 扣壍 === "function" ? (扣壍 as (谟壍: T) => T)(乁壍) : 扣壍;
        await this.col.upsert({ id: "singleton", value: 洰壍 } as {
            id: string;
            value: T;
        } & BaseRecord);
        return 洰壍;
    }
}
export class AppendLog<T extends {
    ts: string;
}> {
    constructor(private readonly driver: Driver, private readonly name: string) { }
    async append(夎壍: T): Promise<void> {
        await this.driver.append(`${this.name}.jsonl`, `${JSON.stringify(夎壍)}\n`);
    }
    async tail(矽壍: number, 雬壍?: (換壍: T) => boolean): Promise<T[]> {
        const 苊壍 = await this.driver.read(`${this.name}.jsonl`);
        if (!苊壍)
            return [];
        const 侹壍: T[] = [];
        const 溨壍 = 苊壍.split("\n");
        for (let 趗壍 = 溨壍.length - 1; 趗壍 >= 0 && 侹壍.length < 矽壍; 趗壍--) {
            const 媆壍 = 溨壍[趗壍];
            if (!媆壍)
                continue;
            try {
                const 祵壍 = JSON.parse(媆壍) as T;
                if (!雬壍 || 雬壍(祵壍))
                    侹壍.push(祵壍);
            }
            catch {
            }
        }
        return 侹壍;
    }
}
export interface StoreInfo {
    driver: "file" | "memory";
    dir: string | null;
    writable: boolean;
    fallbackReason?: string;
}
const 顤壍 = () => singleton("store:driverInfo", () => ({ value: null as StoreInfo | null }));
async function 敓壍(葂壍: string): Promise<boolean> {
    try {
        await fs.mkdir(葂壍, { recursive: true });
        const 儱壍 = path.join(葂壍, `.probe-${process.pid}`);
        await fs.writeFile(儱壍, "ok");
        await fs.unlink(儱壍);
        return true;
    }
    catch {
        return false;
    }
}
export function getDriver(): Driver {
    return singleton("store:driver", () => {
        const 瀠壍 = appConfig();
        if (瀠壍.storeDriver === "memory" || !瀠壍.dataDir) {
            顤壍().value = { driver: "memory", dir: null, writable: true, fallbackReason: 瀠壍.storeDriver === "memory" ? "STORE_DRIVER=memory" : "DATA_DIR is empty" };
            return new 錉壍();
        }
        const 輏壍 = path.resolve(process.cwd(), 瀠壍.dataDir);
        const 対壍 = new 嚣壍(輏壍);
        const 竭壍 = new 錉壍();
        let 駜壍: Driver | null = null;
        const 曋壍 = async (): Promise<Driver> => {
            if (駜壍)
                return 駜壍;
            const 薺壍 = await 敓壍(輏壍);
            駜壍 = 薺壍 ? 対壍 : 竭壍;
            const 助壍: StoreInfo = 薺壍 ? { driver: "file", dir: 輏壍, writable: true } : { driver: "memory", dir: 輏壍, writable: false, fallbackReason: `${輏壍} is not writable; changes are kept in memory until restart` };
            顤壍().value = 助壍;
            if (!薺壍)
                log.warn(助壍.fallbackReason ?? "store fallback");
            return 駜壍;
        };
        const 熘壍: Driver = {
            kind: "file",
            writable: true,
            read: async (邇壍) => (await 曋壍()).read(邇壍),
            write: async (嵶壍, 籥壍) => (await 曋壍()).write(嵶壍, 籥壍),
            append: async (魔壍, 桃壍) => (await 曋壍()).append(魔壍, 桃壍),
        };
        顤壍().value = { driver: "file", dir: 輏壍, writable: true };
        return 熘壍;
    });
}
export function prefixedDriver(蜲壍: Driver, 吡壍: string): Driver {
    if (!/^[a-z0-9][a-z0-9/-]*\/$/.test(吡壍) || 吡壍.includes(".."))
        throw new Error(`Invalid store prefix ${吡壍}`);
    return {
        get kind() {
            return 蜲壍.kind;
        },
        get writable() {
            return 蜲壍.writable;
        },
        read: (猐壍) => 蜲壍.read(吡壍 + 猐壍),
        write: (釿壍, 廮壍) => 蜲壍.write(吡壍 + 釿壍, 廮壍),
        append: (緝壍, 鳌壍) => 蜲壍.append(吡壍 + 緝壍, 鳌壍),
    };
}
export function storeInfo(): StoreInfo {
    const 榻壍 = getDriver();
    return 顤壍().value ?? { driver: 榻壍.kind, dir: null, writable: 榻壍.writable };
}
