import { captchaVerifySchema } from "@/lib/domain/contracts/captcha";
import { captchaStatus, verifyCaptcha } from "@/lib/server/captcha/service";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

export const GET = route({ rateLimit: { key: "captcha-status", perMinute: 30, burst: 10 } }, async ({ principal }) => captchaStatus(principal));

export const POST = route(
  { body: captchaVerifySchema, maxBody: 128 * 1024, rateLimit: { key: "captcha-verify", perMinute: 20, burst: 5 } },
  async ({ principal, body }) => verifyCaptcha(principal, body),
);
