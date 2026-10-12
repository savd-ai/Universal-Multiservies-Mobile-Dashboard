import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_SEAL_FORMAT } from "@/lib/domain/contracts/demo";
import { toDataset } from "@/lib/server/demo/service";
import { DEMO_DB_FILE, keyCommitment, keyMatches, openDemoDatabase, openSealedTables, readSeal, sealDemoDatabase, type SealedRows } from "@/lib/server/demo/vault";
import { openDatabase } from "@/lib/server/warehouse/sqlite";
const TEST_KEY = Buffer.alloc(32, 7);
const ROWS: SealedRows = {
    demo_account: [["1234567890", "Test Account", "USD", "UTC"]],
    demo_campaign: [["k1", "Test Campaign", "Search", "Enabled", "MANUAL_CPC", 50]],
    demo_campaign_daily: [
        ["2026-10-01", "k1", 1000, 50, 25.5, 2, 120],
        ["2026-10-02", "k1", 900, 45, 22, 0, 0],
    ],
};
function sealed(key: Uint8Array = TEST_KEY) {
    const db = openDatabase(":memory:");
    sealDemoDatabase(db, ROWS, key, "2026-10-12T00:00:00.000Z");
    return db;
}
describe("demo vault", () => {
    it("seals every table and opens it again with the same key", () => {
        const db = sealed();
        const seal = readSeal(db);
        expect(seal).toMatchObject({ format: DEMO_SEAL_FORMAT, cipher: "aes-256-gcm", keySha256: keyCommitment(TEST_KEY), sealedAt: "2026-10-12T00:00:00.000Z" });
        expect(seal.tables.map((table) => [table.name, table.rows])).toEqual([["demo_account", 1], ["demo_campaign", 1], ["demo_campaign_daily", 2]]);
        expect(keyMatches(seal, TEST_KEY)).toBe(true);
        const opened = openSealedTables(db, TEST_KEY);
        expect(opened).toEqual(ROWS);
        expect(toDataset(opened)).toMatchObject({ account: { id: "1234567890", currency: "USD" }, campaigns: [{ id: "k1", budget_daily: 50 }], daily: [{ date: "2026-10-01", cost: 25.5 }, { date: "2026-10-02", conversions: 0 }] });
    });
    it("stores no plaintext values", () => {
        const db = sealed();
        const blobs = db.prepare("SELECT ciphertext FROM sealed_table").all() as {
            ciphertext: Uint8Array;
        }[];
        const text = blobs.map((row) => Buffer.from(row.ciphertext).toString("latin1")).join("");
        expect(text).not.toContain("Test Campaign");
        expect(text).not.toContain("2026-10-01");
    });
    it("refuses any other key and any tampering", () => {
        const db = sealed();
        const other = randomBytes(32);
        expect(keyMatches(readSeal(db), other)).toBe(false);
        expect(() => openSealedTables(db, other)).toThrow();
        db.prepare("UPDATE sealed_table SET ciphertext = ? WHERE name = 'demo_campaign'").run(Buffer.from("tampered"));
        expect(() => openSealedTables(db, TEST_KEY)).toThrow();
    });
    it("rejects short keys and rows of the wrong width", () => {
        expect(() => sealDemoDatabase(openDatabase(":memory:"), ROWS, Buffer.alloc(16), "2026-10-12T00:00:00.000Z")).toThrow(/32 bytes/);
        expect(() => sealDemoDatabase(openDatabase(":memory:"), { ...ROWS, demo_campaign: [["k1", "Short"]] }, TEST_KEY, "2026-10-12T00:00:00.000Z")).toThrow(/needs 6 values/);
    });
});
describe("committed demo database", () => {
    it("is sealed, read-only and holds the demo tables", () => {
        const db = openDemoDatabase();
        try {
            const seal = readSeal(db);
            expect(seal.format).toBe(DEMO_SEAL_FORMAT);
            expect(seal.keySha256).toMatch(/^[0-9a-f]{64}$/);
            expect(seal.tables.map((table) => [table.name, table.rows])).toEqual([["demo_account", 1], ["demo_campaign", 8], ["demo_campaign_daily", 720]]);
            expect(() => db.exec("DELETE FROM seal")).toThrow();
            expect(keyMatches(seal, randomBytes(32))).toBe(false);
            expect(() => openSealedTables(db, randomBytes(32))).toThrow();
        }
        finally {
            db.close();
        }
    });
    it("keeps the demo values out of the file", () => {
        const bytes = readFileSync(DEMO_DB_FILE).toString("latin1");
        for (const plain of ["Acme", "Brand", "PMax", "Shopping", "MAXIMIZE", "America/", "2026-09-"])
            expect(bytes).not.toContain(plain);
    });
});
