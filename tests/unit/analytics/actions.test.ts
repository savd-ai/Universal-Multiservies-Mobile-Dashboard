import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseChange } from "@/lib/domain/anomaly/changes";
import type { ReadOnlyAlternatives } from "@/lib/domain/contracts/actions";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { emptyDims, type EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo } from "@/lib/domain/types";
import { listActions, revertAction, simulateAction } from "@/lib/server/actions/simulate";
import type { RequestContext } from "@/lib/server/context";
import { requestContext } from "@/lib/server/context";
import type { GoogleAdsSource } from "@/lib/server/datasource/types";
import { errorResponse } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
import { getStore } from "@/lib/server/store";
import { campaign, resetServerState, restoreServerState } from "./helpers";

/** A live source that must never be asked to change anything (it has no write methods to begin with). */
function liveContext(): RequestContext {
  const dims: EntityDims = emptyDims();
  dims.campaigns.set("1234567890", campaign("1234567890", { name: "Brand — Core Terms", budget_daily: 420 }));
  dims.campaigns.set("2222222222", campaign("2222222222", { name: "Generic — Running Shoes", budget_daily: 780 }));
  dims.adGroups.set("555", { id: "555", campaign_id: "1234567890", name: "Brand — Exact", status: "Enabled" });
  const account: AccountInfo = { id: "9998887777", name: "Live account", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" };
  const unused = () => {
    throw new Error("not used");
  };
  const source: GoogleAdsSource = {
    mode: "live",
    reason: null,
    apiVersion: "v25",
    listAccounts: async () => [account],
    manager: async () => null,
    defaultAccountId: () => account.id,
    account: async () => account,
    today: async () => "2026-09-29",
    dataThrough: async () => "2026-09-28",
    getDims: async () => dims,
    getTable: unused,
    getChangeEvents: async () => [],
    getGoogleEstimates: async () => ({ simulations: [], recommendations: [], warnings: [] }),
    coverage: async () => null,
    invalidate: async () => undefined,
  };
  return { resolved: { source, health: null }, source, accountId: account.id, account, accounts: [account], today: "2026-09-29", dataThrough: "2026-09-28", registry: new MetricRegistry() };
}

async function readOnlyError(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error("expected READ_ONLY_LIVE");
}

describe("read-only guard (live mode)", () => {
  beforeEach(() => resetServerState());
  afterEach(() => restoreServerState());

  it("refuses to pause in live mode and offers deep links, a change list and an Editor CSV", async () => {
    const err = await readOnlyError(simulateAction(liveContext(), { type: "campaign.pause", campaignIds: ["1234567890"] }));
    expect(err.code).toBe("READ_ONLY_LIVE");
    expect(err.status).toBe(409);
    expect(err.message).toBe("This dashboard is read-only for Google Ads");
    const alt = err.details as ReadOnlyAlternatives;
    expect(alt.deepLinks[0]?.url).toContain("campaignId=1234567890");
    expect(alt.deepLinks[0]?.url).toContain("ocid=9998887777");
    expect(alt.changeList).toEqual(["Pause campaign 'Brand — Core Terms'"]);
    expect(alt.editorCsv.split("\r\n")[0]).toBe("Campaign,Campaign ID,Budget,Budget type,Campaign status");
    expect(alt.editorCsv).toContain("Brand — Core Terms,1234567890,420.00,Daily,Paused");
    // Nothing is persisted and nothing is audited as a change.
    expect(await getStore().simulatedActions.list()).toEqual([]);

    const res = errorResponse(err, "req-1");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; details: ReadOnlyAlternatives } };
    expect(body.error.code).toBe("READ_ONLY_LIVE");
    expect(body.error.details.changeList).toHaveLength(1);
  });

  it("budget and negative-keyword alternatives", async () => {
    const budget = await readOnlyError(simulateAction(liveContext(), { type: "campaign.set_budget", budgets: [{ campaignId: "1234567890", dailyBudget: 455 }] }));
    expect((budget.details as ReadOnlyAlternatives).changeList).toEqual(["Set daily budget of 'Brand — Core Terms' from $420.00 to $455.00 (+8.3%)"]);
    const negatives = await readOnlyError(
      simulateAction(liveContext(), { type: "keywords.add_negatives", negatives: [{ text: "free shoes", matchType: "Exact", campaignId: "1234567890", adGroupId: "555" }] }),
    );
    const alt = negatives.details as ReadOnlyAlternatives;
    expect(alt.changeList[0]).toBe("Add negative keyword [free shoes] (Exact) to campaign 'Brand — Core Terms'");
    expect(alt.editorCsv).toContain("Brand — Core Terms,Brand — Exact,free shoes,Negative exact");
  });
});

describe("simulated actions (demo mode)", () => {
  beforeEach(() => resetServerState());
  afterEach(() => restoreServerState());

  it("pause → overlay on the campaign → revert", async () => {
    const ctx = await requestContext();
    expect(ctx.source.mode).toBe("demo");
    const res = await simulateAction(ctx, { type: "campaign.pause", campaignIds: ["c2"] });
    expect(res).toMatchObject({ simulated: true, action: { type: "campaign.pause", targets: ["c2"], summary: "Paused 'Generic — Running Shoes'" } });
    expect((await ctx.source.getDims(ctx.accountId)).campaigns.get("c2")).toMatchObject({ status: "Paused", simulated: { status: true } });
    expect((await listActions(ctx)).map((a) => a.id)).toEqual([res.action.id]);

    const reverted = await revertAction(ctx, res.action.id);
    expect(reverted.alreadyReverted).toBe(false);
    expect(reverted.action.revertedAt).toBeTruthy();
    expect((await ctx.source.getDims(ctx.accountId)).campaigns.get("c2")?.status).toBe("Enabled");
    expect((await revertAction(ctx, res.action.id)).alreadyReverted).toBe(true);

    const log = await getStore().audit.tail(10);
    expect(log.map((e) => e.action)).toEqual(["simulate.revert", "simulate.campaign.pause"]);
    expect(log.every((e) => e.mode === "demo")).toBe(true);
  });

  it("simulated actions reach the change log with before → after diffs, classified like live changes", async () => {
    const ctx = await requestContext();
    await simulateAction(ctx, { type: "campaign.set_budget", budgets: [{ campaignId: "c6", dailyBudget: 350 }] });
    await simulateAction(ctx, { type: "campaign.pause", campaignIds: ["c2"] });
    await simulateAction(ctx, { type: "keywords.add_negatives", negatives: [{ text: "free", matchType: "Exact", campaignId: "c2" }] });
    const events = (await ctx.source.getChangeEvents(ctx.accountId, { start: "2026-09-01", end: "2026-09-30" })).filter((e) => e.client_type === "SAVD_DASHBOARD_SIMULATION");
    const budget = events.find((e) => e.resource_type === "CAMPAIGN_BUDGET");
    expect(budget).toMatchObject({ campaign_id: "c6", diffs: [{ field: "amount", before: 260, after: 350 }] });
    expect(parseChange(budget!)).toMatchObject({ category: "budget", action: "raised", effect: "Budget +35% ($260 → $350)", client: { label: "SAVD simulation", automated: false } });
    const pause = events.find((e) => e.changed_fields.includes("campaign.pause"));
    expect(pause?.diffs).toEqual([{ field: "status", before: "ENABLED", after: "PAUSED" }]);
    expect(parseChange(pause!)).toMatchObject({ category: "status", action: "paused" });
    const negatives = events.find((e) => e.resource_type === "CAMPAIGN_CRITERION");
    expect(negatives).toMatchObject({ operation: "create", diffs: [] });
    expect(parseChange(negatives!)).toMatchObject({ category: "negatives", action: "added" });
  });

  it("set budget stores the overlay the demo source applies, and validates campaigns", async () => {
    const ctx = await requestContext();
    const res = await simulateAction(ctx, { type: "campaign.set_budget", budgets: [{ campaignId: "c6", dailyBudget: 350 }] });
    expect(res.action.after).toEqual({ budgets: [{ campaignId: "c6", dailyBudget: 350 }] });
    expect(res.action.before).toEqual({ budgets: [{ campaignId: "c6", dailyBudget: 260 }] });
    expect((await ctx.source.getDims(ctx.accountId)).campaigns.get("c6")).toMatchObject({ budget_daily: 350, simulated: { budget: true } });
    await expect(simulateAction(ctx, { type: "campaign.pause", campaignIds: ["nope"] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(revertAction(ctx, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
