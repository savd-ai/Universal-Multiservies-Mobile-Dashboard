import "server-only";
import { AGENCY_WORKSPACE, clientForAccount, workspaceFor } from "@/lib/domain/auth/roles";
import { fxFactor, ratioKpis, sumKpis, type PortfolioAccountRow, type PortfolioGroup, type PortfolioKpis, type PortfolioQuery, type PortfolioResponse } from "@/lib/domain/contracts/portfolio";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { AccountInfo } from "@/lib/domain/types";
import { getAnomalyFeed } from "./anomaly/service";
import { listClientRecords } from "./auth/clients";
import { getPacingReport } from "./budget/service";
import { requestContext } from "./context";
import { appConfig } from "./env/config";
import { log } from "./log";
import { runQuery } from "./query/service";
import { currentPrincipal, runInWorkspace } from "./scope";
import { getWorkspaceStore } from "./store";
const CONCURRENCY = 3;
const MAX_ACCOUNTS = 200;
function kpisFrom(t: Record<string, number | null> | undefined): PortfolioKpis | null {
    if (!t)
        return null;
    const n = (k: string) => t[k] ?? 0;
    return ratioKpis({ cost: n("cost"), conversions: n("conversions"), convValue: n("conv_value"), clicks: n("clicks"), impressions: n("impressions") });
}
async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]!);
        }
    });
    await Promise.all(workers);
    return out;
}
export async function buildPortfolio(query: PortfolioQuery): Promise<PortfolioResponse> {
    const principal = currentPrincipal();
    const base = await requestContext();
    const clients = await listClientRecords();
    const accounts = base.accounts.filter((a) => !a.isManager).slice(0, MAX_ACCOUNTS);
    const warnings: string[] = base.accounts.length > MAX_ACCOUNTS ? [`Showing the first ${MAX_ACCOUNTS} accounts.`] : [];
    const spec = querySpecSchema.parse({ source: "google_ads", metrics: ["cost", "conversions", "conv_value", "clicks", "impressions"], dimensions: [], dateRange: { preset: query.range }, compare: query.compare });
    let range: PortfolioResponse["range"] = null;
    let compareRange: PortfolioResponse["compareRange"] = null;
    const rows = await pool(accounts, CONCURRENCY, (a: AccountInfo) => runInWorkspace(workspaceFor(principal, clients, a.id), async (): Promise<PortfolioAccountRow> => {
        const owner = clientForAccount(a.id, clients);
        const row: PortfolioAccountRow = { accountId: a.id, name: a.name, currency: a.currency, clientId: owner?.id ?? null, clientName: owner?.name ?? null, mode: a.mode, kpis: null, previous: null, pacing: null, signals: { critical: 0, warning: 0, opportunity: 0 }, dataThrough: null, error: null };
        try {
            const ctx = await requestContext(undefined, a.id);
            row.dataThrough = ctx.dataThrough;
            const [result, pacing, feed] = await Promise.all([
                runQuery(spec, ctx),
                getPacingReport(ctx).catch(() => null),
                getAnomalyFeed(ctx, { includeInactive: false }).catch(() => null),
            ]);
            range ??= { start: result.meta.range.start, end: result.meta.range.end };
            compareRange ??= result.meta.compareRange ?? null;
            row.kpis = kpisFrom(result.totals);
            row.previous = query.compare === "none" ? null : kpisFrom(result.compareTotals);
            if (pacing)
                row.pacing = { monthLabel: pacing.monthLabel, projected: pacing.totals.projected, target: pacing.totals.monthlyTarget, ratio: pacing.totals.monthlyTarget > 0 ? pacing.totals.projected / pacing.totals.monthlyTarget : null, overpacing: pacing.totals.overpacingCount };
            for (const s of feed?.signals ?? []) {
                if (s.status !== "open")
                    continue;
                if (s.polarity === "good")
                    row.signals.opportunity++;
                else if (s.severity === "critical")
                    row.signals.critical++;
                else if (s.severity === "warning")
                    row.signals.warning++;
            }
        }
        catch (err) {
            row.error = err instanceof Error ? err.message : String(err);
            log.warn("portfolio account failed", { accountId: a.id, error: row.error });
        }
        return row;
    }));
    const agencySettings = await getWorkspaceStore(AGENCY_WORKSPACE).settings.get();
    const rates = { ...appConfig().fxRates, ...agencySettings.fxRates };
    const displayCurrency = agencySettings.displayCurrency ?? appConfig().displayCurrency ?? accounts[0]?.currency ?? "USD";
    const factor = (r: PortfolioAccountRow) => fxFactor(r.currency, displayCurrency, rates);
    const excludedFromTotals = rows.filter((r) => r.kpis && factor(r) === null).map((r) => r.accountId);
    if (excludedFromTotals.length)
        warnings.push(`No exchange rate from ${[...new Set(rows.filter((r) => excludedFromTotals.includes(r.accountId)).map((r) => r.currency))].join(", ")} to ${displayCurrency}: those accounts are left out of the totals (add one under Data source → Display preferences).`);
    const groupIds = [...new Set(rows.map((r) => r.clientId ?? AGENCY_WORKSPACE))];
    const groups: PortfolioGroup[] = groupIds.map((gid) => {
        const members = rows.filter((r) => (r.clientId ?? AGENCY_WORKSPACE) === gid);
        const signals = members.reduce((s, r) => ({ critical: s.critical + r.signals.critical, warning: s.warning + r.signals.warning, opportunity: s.opportunity + r.signals.opportunity }), { critical: 0, warning: 0, opportunity: 0 });
        return {
            clientId: gid === AGENCY_WORKSPACE ? null : gid,
            name: gid === AGENCY_WORKSPACE ? "Not assigned to a client" : (members[0]?.clientName ?? "Client"),
            accountIds: members.map((r) => r.accountId),
            totals: sumKpis(members.map((r) => ({ kpis: r.kpis, factor: factor(r) }))),
            previous: sumKpis(members.map((r) => ({ kpis: r.previous, factor: factor(r) }))),
            signals,
        };
    });
    groups.sort((a, b) => (a.clientId === null ? 1 : b.clientId === null ? -1 : a.name.localeCompare(b.name)));
    return {
        range,
        compareRange,
        displayCurrency,
        accounts: rows,
        groups,
        totals: sumKpis(rows.map((r) => ({ kpis: r.kpis, factor: factor(r) }))),
        previous: sumKpis(rows.map((r) => ({ kpis: r.previous, factor: factor(r) }))),
        excludedFromTotals,
        warnings,
    };
}
