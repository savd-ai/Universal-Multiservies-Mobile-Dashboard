import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { DEMO_SEAL_FORMAT, DEMO_TABLES, type DemoTableName, type SealedTableInfo } from "@/lib/domain/contracts/demo";
import { SQLITE_UNAVAILABLE, sqliteModule, type Db } from "../warehouse/sqlite";
export const DEMO_DB_FILE = path.join(process.cwd(), "demo", "demo-dashboard.sqlite");
export const DEMO_CIPHER = "aes-256-gcm";
export const SEAL_NOTE = "Every table is sealed with AES-256-GCM under 32 random bytes that were destroyed right after sealing. key_sha256 is the only trace of that key; nothing in the code, the environment or this file can rebuild it.";
const SCHEMA = `
CREATE TABLE seal (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  format TEXT NOT NULL,
  cipher TEXT NOT NULL,
  key_sha256 TEXT NOT NULL,
  sealed_at TEXT NOT NULL,
  note TEXT NOT NULL
);
CREATE TABLE sealed_table (
  name TEXT PRIMARY KEY,
  columns TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  iv BLOB NOT NULL,
  tag BLOB NOT NULL,
  ciphertext BLOB NOT NULL
);`;
export type SealedRows = Record<DemoTableName, unknown[][]>;
export interface SealInfo {
    format: string;
    cipher: string;
    keySha256: string;
    sealedAt: string;
    note: string;
    tables: SealedTableInfo[];
}
export class DemoUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DemoUnavailableError";
    }
}
const aad = (table: string) => Buffer.from(`${DEMO_SEAL_FORMAT}:${table}`);
export function keyCommitment(key: Uint8Array): string {
    return createHash("sha256").update(key).digest("hex");
}
export function sealDemoDatabase(db: Db, rows: SealedRows, key: Uint8Array, sealedAt: string): void {
    if (key.length !== 32)
        throw new Error("The seal key must be 32 bytes");
    db.exec(SCHEMA);
    db.prepare("INSERT INTO seal (id, format, cipher, key_sha256, sealed_at, note) VALUES (1, ?, ?, ?, ?, ?)").run(DEMO_SEAL_FORMAT, DEMO_CIPHER, keyCommitment(key), sealedAt, SEAL_NOTE);
    const insert = db.prepare("INSERT INTO sealed_table (name, columns, row_count, iv, tag, ciphertext) VALUES (?, ?, ?, ?, ?, ?)");
    for (const table of DEMO_TABLES) {
        const data = rows[table.name];
        if (data.some((row) => row.length !== table.columns.length))
            throw new Error(`Every ${table.name} row needs ${table.columns.length} values`);
        const iv = randomBytes(12);
        const cipher = createCipheriv(DEMO_CIPHER, key, iv);
        cipher.setAAD(aad(table.name));
        const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
        insert.run(table.name, JSON.stringify(table.columns), data.length, iv, cipher.getAuthTag(), ciphertext);
    }
}
export function openDemoDatabase(file = DEMO_DB_FILE): Db {
    const sqlite = sqliteModule();
    if (!sqlite)
        throw new DemoUnavailableError(SQLITE_UNAVAILABLE);
    if (!existsSync(file))
        throw new DemoUnavailableError("The demo database (demo/demo-dashboard.sqlite) is missing from this deployment.");
    return new sqlite.DatabaseSync(file, { readOnly: true });
}
export function readSeal(db: Db): SealInfo {
    const seal = db.prepare("SELECT format, cipher, key_sha256, sealed_at, note FROM seal WHERE id = 1").get() as {
        format: string;
        cipher: string;
        key_sha256: string;
        sealed_at: string;
        note: string;
    } | undefined;
    if (!seal || seal.format !== DEMO_SEAL_FORMAT || seal.cipher !== DEMO_CIPHER)
        throw new DemoUnavailableError("The demo database has no seal this server understands.");
    const stored = db.prepare("SELECT name, columns, row_count FROM sealed_table").all() as {
        name: string;
        columns: string;
        row_count: number;
    }[];
    const tables = DEMO_TABLES.map((table) => {
        const row = stored.find((candidate) => candidate.name === table.name);
        if (!row)
            throw new DemoUnavailableError(`The demo database has no sealed ${table.name} table.`);
        return { name: row.name, columns: JSON.parse(row.columns) as string[], rows: Number(row.row_count) };
    });
    return { format: seal.format, cipher: seal.cipher, keySha256: seal.key_sha256, sealedAt: seal.sealed_at, note: seal.note, tables };
}
export function keyMatches(seal: SealInfo, key: Uint8Array): boolean {
    const expected = Buffer.from(seal.keySha256, "hex");
    const actual = createHash("sha256").update(key).digest();
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function openSealedTables(db: Db, key: Uint8Array): SealedRows {
    const out = {} as SealedRows;
    const select = db.prepare("SELECT iv, tag, ciphertext FROM sealed_table WHERE name = ?");
    for (const table of DEMO_TABLES) {
        const row = select.get(table.name) as {
            iv: Uint8Array;
            tag: Uint8Array;
            ciphertext: Uint8Array;
        } | undefined;
        if (!row)
            throw new DemoUnavailableError(`The demo database has no sealed ${table.name} table.`);
        const decipher = createDecipheriv(DEMO_CIPHER, key, row.iv);
        decipher.setAAD(aad(table.name));
        decipher.setAuthTag(row.tag);
        const plain = Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString("utf8");
        out[table.name] = JSON.parse(plain) as unknown[][];
    }
    return out;
}
