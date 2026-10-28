import { portfolioQuerySchema } from "@/lib/domain/contracts/portfolio";
import { route } from "@/lib/server/http/api";
import { buildPortfolio } from "@/lib/server/portfolio";
export const runtime = "nodejs";
export const maxDuration = 120;
export const GET = route({ query: portfolioQuerySchema, rateLimit: { key: "portfolio", perMinute: 30 } }, async ({ query }) => buildPortfolio(query));
