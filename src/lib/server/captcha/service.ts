import "server-only";
import { chromaReplay, isChromaSolved } from "@/lib/domain/captcha/chroma";
import type { CaptchaFailedDetails, CaptchaStatus, CaptchaVerdict, CaptchaVerifyBody } from "@/lib/domain/contracts/captcha";
import { CAPTCHA_REQUIRED_REASON } from "@/lib/domain/contracts/captcha";
import { now } from "../clock";
import { AppError } from "../http/errors";
import type { Principal } from "../scope";
import { getGlobalStore } from "../store";
import { boardFromCaptcha, issueCaptchaChallenge } from "./challenge";

/**
 * Signed-in users solve the colour puzzle once per session before any page or data route opens. Local
 * (AUTH_MODE=off), system and anonymous principals have no session to remember a solve on, so they skip it.
 */
export function captchaApplies(principal: Principal): principal is Principal & { sessionId: string } {
  return principal.kind === "user" && !!principal.sessionId;
}

export function captchaPending(principal: Principal): boolean {
  return captchaApplies(principal) && !principal.captchaPassed;
}

export function assertCaptchaPassed(principal: Principal): void {
  if (captchaPending(principal)) {
    throw new AppError("FORBIDDEN", "Solve the colour puzzle to continue.", { reason: CAPTCHA_REQUIRED_REASON });
  }
}

export function captchaStatus(principal: Principal): CaptchaStatus {
  if (!captchaApplies(principal)) return { required: false, passed: true, challenge: null };
  if (principal.captchaPassed) return { required: true, passed: true, challenge: null };
  return { required: true, passed: false, challenge: issueCaptchaChallenge(principal.sessionId) };
}

export async function verifyCaptcha(principal: Principal, body: CaptchaVerifyBody): Promise<{ ok: true; moves: number }> {
  if (!captchaApplies(principal)) return { ok: true, moves: 0 };
  const board = boardFromCaptcha(body.token, principal.sessionId);
  const played = chromaReplay(board, body.moves);
  const verdict: CaptchaVerdict = played.illegalAt !== null ? "illegal_move" : isChromaSolved(played.board) ? "solved" : "unsolved";
  if (verdict !== "solved") {
    const details: CaptchaFailedDetails = { reason: "captcha_failed", verdict, moves: body.moves.length };
    throw new AppError("FORBIDDEN", verdict === "illegal_move" ? "A move broke the rules — start over." : "The colours aren't in place yet.", details);
  }
  await getGlobalStore().sessions.update(principal.sessionId, { captchaPassedAt: now().toISOString() });
  return { ok: true, moves: body.moves.length };
}
