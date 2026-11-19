import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

// SQLite access for the analytics warehouse through Node's built-in `node:sqlite` (no native dependency). It is
// loaded with process.getBuiltinModule so bundlers never try to resolve it, and it is optional: on Node.js older than
// 22.13 (no unflagged node:sqlite) the warehouse reports itself unavailable and the app runs without it.

export type Db = DatabaseSync;
type SqliteModule = typeof import("node:sqlite");

export function sqliteModule(): SqliteModule | null {
  try {
    const get = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
    const mod = get?.call(process, "node:sqlite") as SqliteModule | undefined;
    return mod && typeof mod.DatabaseSync === "function" ? mod : null;
  } catch {
    return null;
  }
}

export const SQLITE_UNAVAILABLE = `SQLite is built into Node.js 22.13 and later; this server runs Node.js ${process.versions.node}.`;

/** Open (and create) a database file, or ":memory:". WAL keeps readers and the single writer out of each other's way. */
export function openDatabase(location: string): Db {
  const mod = sqliteModule();
  if (!mod) throw new Error(SQLITE_UNAVAILABLE);
  if (location !== ":memory:") mkdirSync(path.dirname(location), { recursive: true });
  const db = new mod.DatabaseSync(location);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA temp_store = MEMORY;");
  if (location !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  return db;
}

export function sqliteVersion(db: Db): string | null {
  const row = db.prepare("SELECT sqlite_version() AS v").get() as { v?: string } | undefined;
  return row?.v ?? null;
}

// node:sqlite only gained `isTransaction` in recent releases, so nesting is tracked here.
const depth = new WeakMap<Db, number>();

/** Run `fn` in one write transaction (BEGIN IMMEDIATE); nested calls join the outer one. `fn` must be synchronous. */
export function transaction<T>(db: Db, fn: () => T): T {
  const d = depth.get(db) ?? 0;
  if (d > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  depth.set(db, 1);
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw err;
  } finally {
    depth.set(db, 0);
  }
}
