import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { CHROMA_PALETTES, CHROMA_SIZE, isChromaBoard, scrambleChroma, type ChromaBoard } from "@/lib/domain/captcha/chroma";
import type { CaptchaChallenge } from "@/lib/domain/contracts/captcha";
import { now } from "../clock";
import { AppError } from "../http/errors";

/** A 5×5 colour board takes a while by eye; give people an hour before the board goes stale. */
export const CAPTCHA_TTL_MS = 60 * 60 * 1000;

const state = globalThis as unknown as { __savdCaptchaKey?: Buffer };

function sign(payload: string): string {
  state.__savdCaptchaKey ??= randomBytes(32);
  return createHmac("sha256", state.__savdCaptchaKey).update(`savd:captcha:${payload}`).digest("base64url");
}

/** Short, one-way tag of the session so a board solved in one session can't unlock another. */
function sessionTag(sessionId: string): string {
  return createHash("sha256").update(`savd:captcha-session:${sessionId}`).digest("base64url").slice(0, 22);
}

const cryptoRng = () => randomInt(0, 2 ** 32) / 2 ** 32;

export function issueCaptchaChallenge(sessionId: string): CaptchaChallenge {
  const board = scrambleChroma(cryptoRng);
  const palette = randomInt(0, CHROMA_PALETTES.length);
  const expiresAt = new Date(now().getTime() + CAPTCHA_TTL_MS).toISOString();
  const payload = Buffer.from(JSON.stringify({ b: board, p: palette, e: expiresAt, s: sessionTag(sessionId) })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, board, size: CHROMA_SIZE, palette, paletteName: CHROMA_PALETTES[palette]!.name, expiresAt };
}

export function boardFromCaptcha(token: string, sessionId: string): ChromaBoard {
  const invalid = new AppError("FORBIDDEN", "This puzzle wasn't issued for this session — load a new one.", { reason: "captcha_invalid" });
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) throw invalid;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid;
  let parsed: { b?: unknown; e?: unknown; s?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof parsed;
  } catch {
    throw invalid;
  }
  if (!isChromaBoard(parsed.b) || typeof parsed.e !== "string" || parsed.s !== sessionTag(sessionId)) throw invalid;
  if (!(Date.parse(parsed.e) > now().getTime())) {
    throw new AppError("FORBIDDEN", "This puzzle expired — load a new one.", { reason: "captcha_expired" });
  }
  return parsed.b;
}
