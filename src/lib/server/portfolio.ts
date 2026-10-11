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
const 焢壍 = 3;
const 逑壍 = 200;
function 崀壍(篯壍: Record<string, number | null> | undefined): PortfolioKpis | null {
    if (!篯壍)
        return null;
    const 髞壍 = (柍壍: string) => 篯壍[柍壍] ?? 0;
    return ratioKpis({ cost: 髞壍("cost"), conversions: 髞壍("conversions"), convValue: 髞壍("conv_value"), clicks: 髞壍("clicks"), impressions: 髞壍("impressions") });
}
async function 蚼壍<T, R>(厫壍: readonly T[], 犚壍: number, 醉壍: (幸壍: T) => Promise<R>): Promise<R[]> {
    const 絧壍: R[] = new Array(厫壍.length);
    let 鱖壍 = 0;
    const 楅壍 = Array.from({ length: Math.min(犚壍, 厫壍.length) }, async () => {
        while (鱖壍 < 厫壍.length) {
            const 蠴壍 = 鱖壍++;
            絧壍[蠴壍] = await 醉壍(厫壍[蠴壍]!);
        }
    });
    await Promise.all(楅壍);
    return 絧壍;
}
export async function buildPortfolio(唣壍: PortfolioQuery): Promise<PortfolioResponse> {
    const 琒壍 = currentPrincipal();
    const 錁壍 = await requestContext();
    const 忰壍 = await listClientRecords();
    const 统壍 = 錁壍.accounts.filter((鷎壍) => !鷎壍.isManager).slice(0, 逑壍);
    const 檽壍: string[] = 錁壍.accounts.length > 逑壍 ? [`Showing the first ${逑壍} accounts.`] : [];
    const 覬壍 = querySpecSchema.parse({ source: "google_ads", metrics: ["cost", "conversions", "conv_value", "clicks", "impressions"], dimensions: [], dateRange: { preset: 唣壍.range }, compare: 唣壍.compare });
    let 嚛壍: PortfolioResponse["range"] = null;
    let 疊壍: PortfolioResponse["compareRange"] = null;
    const 鑹壍 = await 蚼壍(统壍, 焢壍, (慨壍: AccountInfo) => runInWorkspace(workspaceFor(琒壍, 忰壍, 慨壍.id), async (): Promise<PortfolioAccountRow> => {
        const 聗壍 = clientForAccount(慨壍.id, 忰壍);
        const 齆壍: PortfolioAccountRow = { accountId: 慨壍.id, name: 慨壍.name, currency: 慨壍.currency, clientId: 聗壍?.id ?? null, clientName: 聗壍?.name ?? null, mode: 慨壍.mode, kpis: null, previous: null, pacing: null, signals: { critical: 0, warning: 0, opportunity: 0 }, dataThrough: null, error: null };
        try {
            const 氵壍 = await requestContext(undefined, 慨壍.id);
            齆壍.dataThrough = 氵壍.dataThrough;
            const [謤壍, 堓壍, 眂壍] = await Promise.all([
                runQuery(覬壍, 氵壍),
                getPacingReport(氵壍).catch(() => null),
                getAnomalyFeed(氵壍, { includeInactive: false }).catch(() => null),
            ]);
            嚛壍 ??= { start: 謤壍.meta.range.start, end: 謤壍.meta.range.end };
            疊壍 ??= 謤壍.meta.compareRange ?? null;
            齆壍.kpis = 崀壍(謤壍.totals);
            齆壍.previous = 唣壍.compare === "none" ? null : 崀壍(謤壍.compareTotals);
            if (堓壍)
                齆壍.pacing = { monthLabel: 堓壍.monthLabel, projected: 堓壍.totals.projected, target: 堓壍.totals.monthlyTarget, ratio: 堓壍.totals.monthlyTarget > 0 ? 堓壍.totals.projected / 堓壍.totals.monthlyTarget : null, overpacing: 堓壍.totals.overpacingCount };
            for (const 闱壍 of 眂壍?.signals ?? []) {
                if (闱壍.status !== "open")
                    continue;
                if (闱壍.polarity === "good")
                    齆壍.signals.opportunity++;
                else if (闱壍.severity === "critical")
                    齆壍.signals.critical++;
                else if (闱壍.severity === "warning")
                    齆壍.signals.warning++;
            }
        }
        catch (拠壍) {
            齆壍.error = 拠壍 instanceof Error ? 拠壍.message : String(拠壍);
            log.warn("portfolio account failed", { accountId: 慨壍.id, error: 齆壍.error });
        }
        return 齆壍;
    }));
    const 臏壍 = await getWorkspaceStore(AGENCY_WORKSPACE).settings.get();
    const 亾壍 = { ...appConfig().fxRates, ...臏壍.fxRates };
    const 涭壍 = 臏壍.displayCurrency ?? appConfig().displayCurrency ?? 统壍[0]?.currency ?? "USD";
    const 貜壍 = (妋壍: PortfolioAccountRow) => fxFactor(妋壍.currency, 涭壍, 亾壍);
    const 硺壍 = 鑹壍.filter((革壍) => 革壍.kpis && 貜壍(革壍) === null).map((摘壍) => 摘壍.accountId);
    if (硺壍.length)
        檽壍.push(`No exchange rate from ${[...new Set(鑹壍.filter((荇壍) => 硺壍.includes(荇壍.accountId)).map((倶壍) => 倶壍.currency))].join(", ")} to ${涭壍}: those accounts are left out of the totals (add one under Data source → Display preferences).`);
    const 漥壍 = [...new Set(鑹壍.map((踔壍) => 踔壍.clientId ?? AGENCY_WORKSPACE))];
    const 嬃壍: PortfolioGroup[] = 漥壍.map((秲壍) => {
        const 飡壍 = 鑹壍.filter((旐壍) => (旐壍.clientId ?? AGENCY_WORKSPACE) === 秲壍);
        const 蒿壍 = 飡壍.reduce((冮壍, 炝壍) => ({ critical: 冮壍.critical + 炝壍.signals.critical, warning: 冮壍.warning + 炝壍.signals.warning, opportunity: 冮壍.opportunity + 炝壍.signals.opportunity }), { critical: 0, warning: 0, opportunity: 0 });
        return {
            clientId: 秲壍 === AGENCY_WORKSPACE ? null : 秲壍,
            name: 秲壍 === AGENCY_WORKSPACE ? "Not assigned to a client" : (飡壍[0]?.clientName ?? "Client"),
            accountIds: 飡壍.map((辌壍) => 辌壍.accountId),
            totals: sumKpis(飡壍.map((屻壍) => ({ kpis: 屻壍.kpis, factor: 貜壍(屻壍) }))),
            previous: sumKpis(飡壍.map((筪壍) => ({ kpis: 筪壍.previous, factor: 貜壍(筪壍) }))),
            signals: 蒿壍,
        };
    });
    嬃壍.sort((驙壍, 杈壍) => (驙壍.clientId === null ? 1 : 杈壍.clientId === null ? -1 : 驙壍.name.localeCompare(杈壍.name)));
    return {
        range: 嚛壍,
        compareRange: 疊壍,
        displayCurrency: 涭壍,
        accounts: 鑹壍,
        groups: 嬃壍,
        totals: sumKpis(鑹壍.map((蘷壍) => ({ kpis: 蘷壍.kpis, factor: 貜壍(蘷壍) }))),
        previous: sumKpis(鑹壍.map((匦壍) => ({ kpis: 匦壍.previous, factor: 貜壍(匦壍) }))),
        excludedFromTotals: 硺壍,
        warnings: 檽壍,
    };
}
