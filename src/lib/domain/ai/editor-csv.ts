import type { Blueprint } from "../contracts/ai";
import { toCsv } from "../query/csv";

// Google Ads Editor-style CSV for a blueprint: campaign, location, ad group, keyword, negative, RSA, sitelink and
// callout rows — everything Paused so nothing can go live on import. Editor matches names exactly, so values are
// NOT formula-escaped; risky leading characters produce a warning instead.

const CAMPAIGN_TYPE: Record<Blueprint["type"], string> = {
  Search: "Search",
  PMax: "Performance Max",
  Shopping: "Shopping",
  Video: "Video",
  Display: "Display",
  "Demand Gen": "Demand Gen",
};

const BID_STRATEGY: Record<Blueprint["bidding"]["strategy"], string> = {
  MAXIMIZE_CONVERSIONS: "Maximize conversions",
  TARGET_CPA: "Target CPA",
  MAXIMIZE_CONVERSION_VALUE: "Maximize conversion value",
  TARGET_ROAS: "Target ROAS",
  MAXIMIZE_CLICKS: "Maximize clicks",
  MANUAL_CPC: "Manual CPC",
};

const HEADLINES = 15;
const DESCRIPTIONS = 4;

export const EDITOR_HEADER = [
  "Campaign",
  "Campaign Type",
  "Campaign Status",
  "Budget",
  "Budget type",
  "Bid Strategy Type",
  "Target CPA",
  "Target ROAS",
  "Languages",
  "Location",
  "Ad Group",
  "Asset Group",
  "Ad Group Status",
  "Keyword",
  "Criterion Type",
  "Ad type",
  "Status",
  ...Array.from({ length: HEADLINES }, (_, i) => `Headline ${i + 1}`),
  ...Array.from({ length: DESCRIPTIONS }, (_, i) => `Description ${i + 1}`),
  "Path 1",
  "Path 2",
  "Final URL",
  "Sitelink text",
  "Description line 1",
  "Description line 2",
  "Callout text",
] as const;

type Col = (typeof EDITOR_HEADER)[number];
type Row = Partial<Record<Col, string | number | null>>;

export interface EditorCsv {
  csv: string;
  rows: number;
  warnings: string[];
}

export function blueprintToEditorCsv(bp: Blueprint, opts: { finalUrl?: string | null } = {}): EditorCsv {
  const warnings: string[] = [];
  const rows: Row[] = [];
  const campaign = bp.campaignName;
  const search = bp.type === "Search";
  const finalUrl = opts.finalUrl?.trim() || null;
  const groupCol: Col = search ? "Ad Group" : "Asset Group";

  rows.push({
    Campaign: campaign,
    "Campaign Type": CAMPAIGN_TYPE[bp.type],
    "Campaign Status": "Paused",
    Budget: Math.round(bp.dailyBudget * 100) / 100,
    "Budget type": "Daily",
    "Bid Strategy Type": BID_STRATEGY[bp.bidding.strategy],
    "Target CPA": bp.bidding.targetCpa,
    "Target ROAS": bp.bidding.targetRoas,
    Languages: bp.targeting.languages.join(";"),
  });
  for (const loc of bp.targeting.locations) rows.push({ Campaign: campaign, Location: loc });

  for (const g of bp.adGroups) {
    rows.push({ Campaign: campaign, [groupCol]: g.name, "Ad Group Status": "Paused" });
    for (const k of g.keywords) rows.push({ Campaign: campaign, "Ad Group": g.name, Keyword: k.text, "Criterion Type": k.matchType, Status: "Paused" });
    for (const n of g.negatives) rows.push({ Campaign: campaign, "Ad Group": g.name, Keyword: n.text, "Criterion Type": `Negative ${n.matchType}` });
    const ad: Row = { Campaign: campaign, [groupCol]: g.name, Status: "Paused", "Path 1": g.rsa.path1, "Path 2": g.rsa.path2, "Final URL": finalUrl };
    if (search) ad["Ad type"] = "Responsive search ad";
    g.rsa.headlines.slice(0, HEADLINES).forEach((h, i) => (ad[`Headline ${i + 1}` as Col] = h));
    g.rsa.descriptions.slice(0, DESCRIPTIONS).forEach((d, i) => (ad[`Description ${i + 1}` as Col] = d));
    rows.push(ad);
  }
  for (const n of bp.campaignNegatives) rows.push({ Campaign: campaign, Keyword: n.text, "Criterion Type": `Campaign Negative ${n.matchType}` });
  for (const s of bp.sitelinks) rows.push({ Campaign: campaign, "Sitelink text": s.text, "Description line 1": s.line1, "Description line 2": s.line2, "Final URL": finalUrl, Status: "Paused" });
  for (const c of bp.callouts) rows.push({ Campaign: campaign, "Callout text": c, Status: "Paused" });

  if (!finalUrl) warnings.push("No final URL was given — add one to every ad and sitelink before importing.");
  if (!search) warnings.push(`${CAMPAIGN_TYPE[bp.type]} campaigns also need images/videos; the CSV covers the campaign, asset groups and text assets.`);
  const risky = new Set<string>();
  for (const r of rows) for (const v of Object.values(r)) if (typeof v === "string" && /^[=+\-@]/.test(v)) risky.add(v);
  if (risky.size) warnings.push(`${risky.size} value${risky.size === 1 ? " starts" : "s start"} with = + - or @; spreadsheet apps may treat ${risky.size === 1 ? "it" : "them"} as a formula (kept as-is because Editor matches names exactly).`);

  const matrix = rows.map((r) => EDITOR_HEADER.map((h) => r[h] ?? ""));
  return { csv: toCsv(EDITOR_HEADER, matrix, false), rows: rows.length, warnings };
}
