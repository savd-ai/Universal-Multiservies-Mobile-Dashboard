import "server-only";
import { addDays, enumerate, isCivilDate } from "@/lib/domain/dates";
import { noise, seedRng } from "@/lib/domain/rng";

// A fake ad platform API used by tests and the plugin builder's "Klaviyo-style (mock)" preset. Resolved in-process
// for base URL mock://platform (so the SSRF guard is never loosened) and exposed at /api/dev/mock-platform in dev.
//   GET /reports?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&cursor=N&page_size=N  (header x-api-key: mock-key)
//   GET /health

export const MOCK_API_KEY = "mock-key";

export function mockPlatformHandle(pathWithQuery: string, headers: Headers): { status: number; body: unknown } {
  const url = new URL(pathWithQuery.startsWith("/") ? `http://mock${pathWithQuery}` : `http://mock/${pathWithQuery}`);
  const key = headers.get("x-api-key") ?? headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (key !== MOCK_API_KEY) return { status: 401, body: { error: "invalid api key", hint: `send header x-api-key: ${MOCK_API_KEY}` } };
  if (url.pathname.endsWith("/health")) return { status: 200, body: { ok: true, service: "mock-platform" } };
  if (!url.pathname.endsWith("/reports")) return { status: 404, body: { error: "not found" } };
  const from = url.searchParams.get("date_from") ?? "";
  const to = url.searchParams.get("date_to") ?? "";
  if (!isCivilDate(from) || !isCivilDate(to) || from > to) return { status: 400, body: { error: "date_from and date_to (YYYY-MM-DD) are required" } };
  const dates = enumerate(from, to > addDays(from, 400) ? addDays(from, 400) : to);
  const all = dates.flatMap((day) =>
    ["Spring launch", "Retargeting"].map((campaign) => {
      const r = seedRng("mock-platform", campaign, day);
      const spend = 180 * (campaign === "Retargeting" ? 0.45 : 1) * noise(r, 0.3);
      const orders = Math.max(0, Math.round((spend / 38) * noise(r, 0.5)));
      return {
        day,
        campaign: { name: campaign },
        metrics: { spend: spend.toFixed(2), impressions: Math.round(spend * 95 * noise(r, 0.2)), clicks: Math.round(spend * 1.6 * noise(r, 0.2)), placed_order: orders },
        actions: [
          { action_type: "purchase", value: orders },
          { action_type: "purchase_value", value: (orders * 84 * noise(r, 0.2)).toFixed(2) },
        ],
      };
    }),
  );
  const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get("page_size") ?? 100)));
  const cursor = Math.max(0, Number(url.searchParams.get("cursor") ?? 0));
  const page = all.slice(cursor, cursor + pageSize);
  const next = cursor + pageSize < all.length ? String(cursor + pageSize) : null;
  return { status: 200, body: { data: { rows: page }, paging: { next } } };
}
