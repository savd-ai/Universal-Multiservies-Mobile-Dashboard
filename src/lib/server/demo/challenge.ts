import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { DemoChallenge } from "@/lib/domain/contracts/demo";
import { isBoard, scrambleUnsolvable, type Board } from "@/lib/domain/demo/puzzle";
import { now } from "../clock";
import { AppError } from "../http/errors";
export const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const state = globalThis as unknown as {
    __savdDemoChallengeKey?: Buffer;
};
function sign(payload: string): string {
    state.__savdDemoChallengeKey ??= randomBytes(32);
    return createHmac("sha256", state.__savdDemoChallengeKey).update(`savd:demo-challenge:${payload}`).digest("base64url");
}
const cryptoRng = () => randomInt(0, 2 ** 32) / 2 ** 32;
export function issueChallenge(): DemoChallenge {
    const board = scrambleUnsolvable(cryptoRng);
    const expiresAt = new Date(now().getTime() + CHALLENGE_TTL_MS).toISOString();
    const payload = Buffer.from(JSON.stringify({ b: board, e: expiresAt })).toString("base64url");
    return { token: `${payload}.${sign(payload)}`, board: [...board], expiresAt };
}
export function boardFromChallenge(token: string): Board {
    const invalid = new AppError("FORBIDDEN", "This puzzle wasn't issued by this server — load a new one.", { reason: "demo_challenge_invalid" });
    const [payload, mac, extra] = token.split(".");
    if (!payload || !mac || extra !== undefined)
        throw invalid;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
        throw invalid;
    let parsed: {
        b?: unknown;
        e?: unknown;
    };
    try {
        parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof parsed;
    }
    catch {
        throw invalid;
    }
    if (!Array.isArray(parsed.b) || !isBoard(parsed.b) || typeof parsed.e !== "string")
        throw invalid;
    if (!(Date.parse(parsed.e) > now().getTime()))
        throw new AppError("FORBIDDEN", "This puzzle expired — load a new one.", { reason: "demo_challenge_expired" });
    return parsed.b;
}
