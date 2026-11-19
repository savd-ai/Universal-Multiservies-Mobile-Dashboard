// Prints a compact summary of the demo dataset (per campaign totals for the last 30 days + planted scenarios) —
// handy when checking that generator changes keep the planted anomalies intact.
//   npm run demo:snapshot                     realistic profile, anchored to yesterday (or DEMO_ANCHOR_DATE)
//   npm run demo:snapshot -- --profile prototype --anchor 2026-09-28 --account 4821193307
import { addDays } from "../src/lib/domain/dates";
import { generateDemoDataset } from "../src/lib/domain/demo/generator";
import { DEMO_ACCOUNTS } from "../src/lib/domain/demo/scenario";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const profile = (arg("profile") ?? process.env.DEMO_PROFILE ?? "realistic") as "realistic" | "prototype";
const accountId = arg("account") ?? DEMO_ACCOUNTS[0]?.id ?? "4821193307";
const spec = DEMO_ACCOUNTS.find((a) => a.id === accountId);
if (!spec) throw new Error(`Unknown demo account ${accountId}; use one of ${DEMO_ACCOUNTS.map((a) => a.id).join(", ")}`);
const anchor = arg("anchor") ?? process.env.DEMO_ANCHOR_DATE ?? addDays(new Date().toISOString().slice(0, 10), -1);

const ds = generateDemoDataset(spec, { profile, anchor, seed: process.env.DEMO_SEED ?? "savd-demo-v1", scenarios: (process.env.DEMO_SCENARIOS as "extended" | "basic") ?? "extended", timezone: process.env.DEMO_TIMEZONE ?? "America/New_York" } as never);
const start = addDays(ds.anchor, -29);
const rows = (ds.tables.campaign_daily as unknown as { date: string; campaign_id: string; cost: number; clicks: number; impressions: number; conversions: number; conv_value: number }[]).filter((r) => r.date >= start && r.date <= ds.anchor);

const by = new Map<string, { cost: number; clicks: number; impressions: number; conversions: number; value: number }>();
for (const r of rows) {
  const a = by.get(r.campaign_id) ?? { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 };
  a.cost += r.cost;
  a.clicks += r.clicks;
  a.impressions += r.impressions;
  a.conversions += r.conversions;
  a.value += r.conv_value;
  by.set(r.campaign_id, a);
}

console.log(`demo dataset · account ${ds.account.id} (${ds.account.name}) · profile ${ds.profile} · anchor ${ds.anchor} · last 30 days`);
const table = [...by.entries()].map(([id, a]) => ({
  id,
  name: ds.dims.campaigns.get(id)?.name ?? id,
  spend: Math.round(a.cost),
  conv: Math.round(a.conversions),
  cpa: a.conversions ? +(a.cost / a.conversions).toFixed(2) : null,
  roas: a.cost ? +(a.value / a.cost).toFixed(2) : null,
  ctr: a.impressions ? `${((a.clicks / a.impressions) * 100).toFixed(2)}%` : null,
}));
console.table(table);
console.log(`change events: ${ds.changeEvents.length} · tables: ${Object.keys(ds.tables).join(", ")}`);
