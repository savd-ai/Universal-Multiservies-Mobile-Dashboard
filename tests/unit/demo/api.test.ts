import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoLockStatus } from "@/lib/domain/contracts/demo";
import { isSolvable, movableTiles, replay, slide, SOLVED_BOARD, type Board } from "@/lib/domain/demo/puzzle";
import { seedRng } from "@/lib/domain/rng";
import { policyFor } from "@/lib/server/auth/policy";
import { setClockForTests } from "@/lib/server/clock";
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));
const statusRoute = await import("@/app/api/demo/route");
const unlockRoute = await import("@/app/api/demo/unlock/route");
const BASE = "http://localhost:3000";
const state = globalThis as unknown as {
    __savdBuckets?: Map<string, unknown>;
    __savdDemoChallengeKey?: Buffer;
};
async function lockStatus(): Promise<DemoLockStatus> {
    const res = await statusRoute.GET(new Request(`${BASE}/api/demo`));
    expect(res.status).toBe(200);
    return (await res.json()) as DemoLockStatus;
}
async function unlock(body: unknown): Promise<{
    status: number;
    json: {
        error?: {
            code: string;
            details?: Record<string, unknown>;
        };
    } & Record<string, unknown>;
}> {
    const res = await unlockRoute.POST(new Request(`${BASE}/api/demo/unlock`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    return { status: res.status, json: await res.json() };
}
function play(board: Board, count: number): number[] {
    const rng = seedRng("demo-api", count);
    const moves: number[] = [];
    let current = board;
    for (let i = 0; i < count; i++) {
        const options = movableTiles(current);
        const tile = options[Math.floor(rng() * options.length)]!;
        current = slide(current, tile)!;
        moves.push(tile);
    }
    return moves;
}
function forge(board: Board, expiresAt: string): string {
    const payload = Buffer.from(JSON.stringify({ b: board, e: expiresAt })).toString("base64url");
    const mac = createHmac("sha256", state.__savdDemoChallengeKey!).update(`savd:demo-challenge:${payload}`).digest("base64url");
    return `${payload}.${mac}`;
}
describe("demo dashboard API", () => {
    beforeEach(() => {
        state.__savdBuckets?.clear();
        setClockForTests(() => new Date("2026-10-12T09:00:00.000Z"));
    });
    afterEach(() => setClockForTests(undefined));
    it("needs a signed-in reader for both routes", () => {
        expect(policyFor("GET", "/api/demo")).toEqual({ kind: "permission", permission: "accounts.read" });
        expect(policyFor("POST", "/api/demo/unlock")).toEqual({ kind: "permission", permission: "accounts.read" });
        expect(policyFor("PUT", "/api/demo/unlock")).toBeNull();
    });
    it("describes the seal and issues an unsolvable board, with no demo values", async () => {
        const status = await lockStatus();
        expect(status).toMatchObject({ available: true, note: null, format: "savd.demo-seal.v1", cipher: "aes-256-gcm" });
        expect(status.tables.map((table) => table.rows)).toEqual([1, 8, 720]);
        expect(isSolvable(status.challenge.board)).toBe(false);
        expect(Object.keys(status).sort()).toEqual(["available", "challenge", "cipher", "format", "keySha256", "note", "sealedAt", "tables"]);
        expect((await lockStatus()).challenge.token).not.toBe(status.challenge.token);
    });
    it("stays locked for honest play: the board is never in order and no key matches", async () => {
        const { challenge } = await lockStatus();
        const res = await unlock({ token: challenge.token, moves: play(challenge.board, 3000), key: randomBytes(32).toString("hex") });
        expect(res.status).toBe(403);
        expect(res.json.error?.details).toEqual({ reason: "demo_locked", puzzle: "unsolved", key: "incorrect", moves: 3000 });
        expect(res.json).not.toHaveProperty("daily");
    });
    it("reports illegal moves and malformed keys", async () => {
        const { challenge } = await lockStatus();
        const moves = play(challenge.board, 3);
        const after = replay(challenge.board, moves).board;
        const stuck = SOLVED_BOARD.find((tile) => tile !== 0 && !movableTiles(after).includes(tile))!;
        const res = await unlock({ token: challenge.token, moves: [...moves, stuck], key: "not-a-key" });
        expect(res.status).toBe(403);
        expect(res.json.error?.details).toMatchObject({ puzzle: "illegal_move", key: "malformed", moves: 4 });
    });
    it("stays locked even when the puzzle lock is bypassed, because the key is gone", async () => {
        await lockStatus();
        const token = forge(SOLVED_BOARD, "2026-10-12T10:00:00.000Z");
        const res = await unlock({ token, moves: [], key: "0".repeat(64) });
        expect(res.status).toBe(403);
        expect(res.json.error?.details).toMatchObject({ reason: "demo_locked", puzzle: "solved", key: "incorrect" });
    });
    it("refuses boards it did not issue and boards that expired", async () => {
        const { challenge } = await lockStatus();
        const [payload, mac] = challenge.token.split(".");
        const solvedPayload = Buffer.from(JSON.stringify({ b: SOLVED_BOARD, e: challenge.expiresAt })).toString("base64url");
        for (const token of [`${solvedPayload}.${mac}`, `${payload}.${mac}x`, payload!, `${payload}.${mac}.extra`]) {
            const res = await unlock({ token, moves: [], key: "" });
            expect(res.status).toBe(403);
            expect(res.json.error?.details).toEqual({ reason: "demo_challenge_invalid" });
        }
        state.__savdBuckets?.clear();
        setClockForTests(() => new Date("2026-10-12T09:31:00.000Z"));
        const expired = await unlock({ token: challenge.token, moves: [], key: "" });
        expect(expired.status).toBe(403);
        expect(expired.json.error?.details).toEqual({ reason: "demo_challenge_expired" });
    });
    it("validates the body and rate-limits attempts", async () => {
        const { challenge } = await lockStatus();
        expect((await unlock({ token: challenge.token, moves: [16], key: "" })).status).toBe(400);
        expect((await unlock({ token: challenge.token, moves: [], key: "x".repeat(300) })).status).toBe(400);
        state.__savdBuckets?.clear();
        const codes: number[] = [];
        for (let i = 0; i < 7; i++)
            codes.push((await unlock({ token: challenge.token, moves: [], key: "" })).status);
        expect(codes.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
        expect(codes.at(-1)).toBe(429);
    });
});
