import { z } from "zod";
import { CHROMA_CELLS, CHROMA_MAX_MOVES } from "../captcha/chroma";

/** A signed board from GET /api/captcha. The token binds it to the viewer's session and expires. */
export interface CaptchaChallenge {
  token: string;
  board: number[];
  size: number;
  palette: number;
  paletteName: string;
  expiresAt: string;
}

export interface CaptchaStatus {
  required: boolean;
  passed: boolean;
  challenge: CaptchaChallenge | null;
}

export const captchaVerifySchema = z.object({
  token: z.string().min(1).max(1024),
  moves: z.array(z.number().int().min(1).max(CHROMA_CELLS - 1)).max(CHROMA_MAX_MOVES),
});
export type CaptchaVerifyBody = z.infer<typeof captchaVerifySchema>;

export type CaptchaVerdict = "solved" | "unsolved" | "illegal_move";

export interface CaptchaFailedDetails {
  reason: "captcha_failed";
  verdict: Exclude<CaptchaVerdict, "solved">;
  moves: number;
}

/** 403 details when a data route is called before the puzzle is solved. */
export const CAPTCHA_REQUIRED_REASON = "captcha_required";
