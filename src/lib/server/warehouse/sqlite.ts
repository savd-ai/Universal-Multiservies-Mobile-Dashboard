import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
export type Db = DatabaseSync;
type SqliteModule = typeof import("node:sqlite");
export function sqliteModule(): SqliteModule | null {
    try {
        const getBuiltinModule = (process as unknown as {
            getBuiltinModule?: (id: string) => unknown;
        }).getBuiltinModule;
        const mod = getBuiltinModule?.call(process, "node:sqlite") as SqliteModule | undefined;
        return mod && typeof mod.DatabaseSync === "function" ? mod : null;
    }
    catch {
        return null;
    }
}
export const SQLITE_UNAVAILABLE = `SQLite is built into Node.js 22.13 and later; this server runs Node.js ${process.versions.node}.`;
export function openDatabase(location: string): Db {
    const mod = sqliteModule();
    if (!mod)
        throw new Error(SQLITE_UNAVAILABLE);
    if (location !== ":memory:")
        mkdirSync(path.dirname(location), { recursive: true });
    const db = new mod.DatabaseSync(location);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA temp_store = MEMORY;");
    if (location !== ":memory:")
        db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    return db;
}
export function sqliteVersion(db: Db): string | null {
    const row = db.prepare("SELECT sqlite_version() AS v").get() as {
        v?: string;
    } | undefined;
    return row?.v ?? null;
}
const depth = new WeakMap<Db, number>();
export function transaction<T>(db: Db, fn: () => T): T {
    const d = depth.get(db) ?? 0;
    if (d > 0)
        return fn();
    db.exec("BEGIN IMMEDIATE");
    depth.set(db, 1);
    try {
        const out = fn();
        db.exec("COMMIT");
        return out;
    }
    catch (err) {
        try {
            db.exec("ROLLBACK");
        }
        catch {
        }
        throw err;
    }
    finally {
        depth.set(db, 0);
    }
}
