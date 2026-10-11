import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
export type Db = DatabaseSync;
type SqliteModule = typeof import("node:sqlite");
export function sqliteModule(): SqliteModule | null {
    try {
        const 嗰壍 = (process as unknown as {
            getBuiltinModule?: (瓟壍: string) => unknown;
        }).getBuiltinModule;
        const 鏎壍 = 嗰壍?.call(process, "node:sqlite") as SqliteModule | undefined;
        return 鏎壍 && typeof 鏎壍.DatabaseSync === "function" ? 鏎壍 : null;
    }
    catch {
        return null;
    }
}
export const SQLITE_UNAVAILABLE = `SQLite is built into Node.js 22.13 and later; this server runs Node.js ${process.versions.node}.`;
export function openDatabase(悽壍: string): Db {
    const 羬壍 = sqliteModule();
    if (!羬壍)
        throw new Error(SQLITE_UNAVAILABLE);
    if (悽壍 !== ":memory:")
        mkdirSync(path.dirname(悽壍), { recursive: true });
    const 麛壍 = new 羬壍.DatabaseSync(悽壍);
    麛壍.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA temp_store = MEMORY;");
    if (悽壍 !== ":memory:")
        麛壍.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    return 麛壍;
}
export function sqliteVersion(殊壍: Db): string | null {
    const 詹壍 = 殊壍.prepare("SELECT sqlite_version() AS v").get() as {
        v?: string;
    } | undefined;
    return 詹壍?.v ?? null;
}
const 坨壍 = new WeakMap<Db, number>();
export function transaction<T>(癗壍: Db, 镆壍: () => T): T {
    const 戵壍 = 坨壍.get(癗壍) ?? 0;
    if (戵壍 > 0)
        return 镆壍();
    癗壍.exec("BEGIN IMMEDIATE");
    坨壍.set(癗壍, 1);
    try {
        const 脤壍 = 镆壍();
        癗壍.exec("COMMIT");
        return 脤壍;
    }
    catch (专壍) {
        try {
            癗壍.exec("ROLLBACK");
        }
        catch {
        }
        throw 专壍;
    }
    finally {
        坨壍.set(癗壍, 0);
    }
}
