import "server-only";
import { DEMO_TABLES, type DemoAccountRow, type DemoCampaignRow, type DemoDailyRow, type DemoDataset, type DemoLockedDetails, type DemoLockStatus, type DemoPuzzleVerdict, type DemoUnlockBody } from "@/lib/domain/contracts/demo";
import { isSolved, replay } from "@/lib/domain/demo/puzzle";
import { AppError } from "../http/errors";
import { boardFromChallenge, issueChallenge } from "./challenge";
import { DemoUnavailableError, keyMatches, openDemoDatabase, openSealedTables, readSeal, type SealedRows, type SealInfo } from "./vault";
export function demoLockStatus(): DemoLockStatus {
    let seal: SealInfo | null = null;
    let note: string | null = null;
    try {
        const db = openDemoDatabase();
        try {
            seal = readSeal(db);
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        note = error instanceof DemoUnavailableError ? error.message : "The demo database could not be read.";
    }
    return {
        available: seal !== null,
        note,
        format: seal?.format ?? null,
        cipher: seal?.cipher ?? null,
        keySha256: seal?.keySha256 ?? null,
        sealedAt: seal?.sealedAt ?? null,
        tables: seal?.tables ?? DEMO_TABLES.map((table) => ({ name: table.name, columns: [...table.columns], rows: 0 })),
        challenge: issueChallenge(),
    };
}
function parseKey(text: string): Buffer | null {
    return /^[0-9a-f]{64}$/i.test(text) ? Buffer.from(text, "hex") : null;
}
export function unlockDemo(body: DemoUnlockBody): DemoDataset {
    const board = boardFromChallenge(body.token);
    const played = replay(board, body.moves);
    const puzzle: DemoPuzzleVerdict = played.illegalAt !== null ? "illegal_move" : isSolved(played.board) ? "solved" : "unsolved";
    const key = parseKey(body.key);
    let db;
    try {
        db = openDemoDatabase();
    }
    catch (error) {
        if (error instanceof DemoUnavailableError)
            throw new AppError("NOT_FOUND", error.message);
        throw error;
    }
    try {
        const seal = readSeal(db);
        const keyVerdict = !key ? "malformed" : keyMatches(seal, key) ? "correct" : "incorrect";
        if (puzzle !== "solved" || keyVerdict !== "correct" || !key) {
            const details: DemoLockedDetails = { reason: "demo_locked", puzzle, key: keyVerdict, moves: body.moves.length };
            throw new AppError("FORBIDDEN", "The demo dashboard stays locked until both puzzles are solved.", details);
        }
        return toDataset(openSealedTables(db, key));
    }
    finally {
        db.close();
    }
}
function zip<T>(columns: readonly string[], rows: unknown[][]): T[] {
    return rows.map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]])) as T);
}
export function toDataset(rows: SealedRows): DemoDataset {
    const [account, campaign, daily] = DEMO_TABLES;
    const accounts = zip<DemoAccountRow>(account.columns, rows.demo_account);
    if (!accounts[0])
        throw new DemoUnavailableError("The sealed demo account table is empty.");
    return { account: accounts[0], campaigns: zip<DemoCampaignRow>(campaign.columns, rows.demo_campaign), daily: zip<DemoDailyRow>(daily.columns, rows.demo_campaign_daily) };
}
