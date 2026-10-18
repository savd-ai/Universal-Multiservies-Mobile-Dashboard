import { mobileDevicePrefsSchema } from "@/lib/domain/contracts/history";
import { route } from "@/lib/server/http/api";
import { currentDevice, updateCurrentDevice } from "@/lib/server/mobile/notifications";

export const runtime = "nodejs";

export const GET = route({}, async ({ principal }) => ({ device: currentDevice(principal) }));
export const PUT = route({ body: mobileDevicePrefsSchema, maxBody: 8 * 1024, rateLimit: { key: "mobile-device", perMinute: 30, burst: 10 } }, async ({ body, principal }) => ({ device: updateCurrentDevice(principal, body) }));
