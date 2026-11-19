import type { AdCopy, AdCopyRequest, Blueprint, CampaignIdea, Narrative, NarrativeFacts } from "../contracts/ai";
import { AI_GOALS, DEMO_IDEAS, GOAL_PICK, type AiGoal, type DemoIdea } from "../demo/scenario";
import { formatMetricValue, type MetricRegistry } from "../metrics/registry";
import type { QueryResult, QueryRow } from "../query/spec";
import { DIMENSIONS, type DimensionKey } from "../schema/dimensions";
import { cyrb53, mulberry32 } from "../rng";
import { AD_TEXT_LIMITS, fitAdText } from "./ads-text";

// The deterministic demo engine: what every AI feature returns when no provider is configured or a provider call
// fails. Same inputs → same outputs; numbers only ever come from the data passed in.

/** "Search — Competitor Terms" → "Competitor Terms" (the prototype's `name.split('—').pop().trim()`). */
export function shortCampaignName(name: string): string {
  return (name.split("—").pop() ?? name).trim() || name;
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 && w !== "vs" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

const seeded = (key: string) => mulberry32(cyrb53(key) % 2147483647);

function shuffle<T>(items: readonly T[], r: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const money0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

// ── Ideas ──────────────────────────────────────────────────────────────────────────────────────────────

export interface IdeaEvidenceCampaign {
  id: string;
  name: string;
  cost: number;
  conversions: number;
  cpa: number | null;
  roas: number | null;
}

export function toCampaignIdea(d: DemoIdea): CampaignIdea {
  return { title: d.title, type: d.type, audience: d.audience, keywords: [...d.keywords], rationale: d.rationale, dailyBudget: d.daily, impact: d.impact, confidence: d.confidence, citedCampaignIds: [...d.citedCampaignIds] };
}

export function isAiGoal(goal: string): goal is AiGoal {
  return (AI_GOALS as readonly string[]).includes(goal);
}

/** The prototype's goal-ordered demo ideas; rationales gain a data clause when the cited campaign exists. */
export function demoIdeas(goal: string, campaigns: readonly IdeaEvidenceCampaign[] = []): CampaignIdea[] {
  const order = GOAL_PICK[isAiGoal(goal) ? goal : "Scale conversions"];
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  return order.flatMap((i) => {
    const d = DEMO_IDEAS[i];
    if (!d) return [];
    const idea = toCampaignIdea(d);
    const cited = d.citedCampaignIds.map((id) => byId.get(id)).find((c): c is IdeaEvidenceCampaign => !!c && c.cost > 0);
    if (cited) {
      const parts = [`${money0(cited.cost)} spend`, cited.cpa !== null ? `CPA ${money0(cited.cpa)}` : null, cited.roas !== null ? `ROAS ${cited.roas.toFixed(2)}x` : null].filter(Boolean);
      idea.rationale = `${d.rationale} Last 30 days, ${shortCampaignName(cited.name)}: ${parts.join(", ")}.`;
    }
    return [idea];
  });
}

// ── Ad copy ────────────────────────────────────────────────────────────────────────────────────────────

const CTAS: Record<AdCopyRequest["tone"], string[]> = {
  confident: ["Shop Now", "Order Online Today", "Find Your Fit"],
  friendly: ["Find Your Perfect Pair", "Take a Look Today", "We're Here to Help"],
  premium: ["Crafted for Performance", "Designed to Last", "Discover the Collection"],
  urgent: ["Order Yours Today", "Shop Before It Sells Out", "Get Yours This Week"],
};

const GENERIC_HEADLINES = ["Explore the Collection", "New Styles Just Landed", "Easy Online Ordering", "Secure Checkout"];

export interface AdCopyContext {
  brand?: string | null;
}

/** Template ad copy from keywords, USPs and CTAs; deterministic by input hash; every line within limits. */
export function demoAdCopy(req: AdCopyRequest, ctx: AdCopyContext = {}): AdCopy {
  const r = seeded(JSON.stringify([req.product, req.audience, req.usps, req.keywords, req.tone, ctx.brand ?? ""]));
  const brand = ctx.brand ? titleCase(ctx.brand) : "";
  const product = titleCase(req.product || req.keywords[0] || "our range");
  const kws = req.keywords.map(titleCase).filter(Boolean);
  const audience = req.audience.trim();
  const ctas = CTAS[req.tone];
  const pool: { text: string; angle: string }[] = [];
  const add = (text: string, angle: string) => {
    const t = fitAdText(text, AD_TEXT_LIMITS.headline);
    if (t && !pool.some((p) => p.text.toLowerCase() === t.toLowerCase())) pool.push({ text: t, angle });
  };
  if (kws[0]) add(`{KeyWord:${fitAdText(kws[0], AD_TEXT_LIMITS.headline)}}`, "keyword");
  for (const k of kws.slice(0, 3)) {
    add(k, "keyword");
    add(`Shop ${k}`, "keyword");
  }
  add(product, "product");
  add(`Shop ${product}`, "product");
  if (audience) add(`${product} for ${titleCase(audience)}`, "audience");
  for (const u of req.usps.slice(0, 4)) add(titleCase(u), "benefit");
  if (brand) {
    add(`Official ${brand} Store`, "brand");
    add(`${brand} ${product}`, "brand");
  }
  for (const c of ctas) add(c, "cta");
  for (const g of shuffle(GENERIC_HEADLINES, r)) add(g, "generic");

  const head = pool.slice(0, 2);
  const headlines = [...head, ...shuffle(pool.slice(2), r)].slice(0, 12).map((h) => ({ text: h.text, pin: null, angle: h.angle }));

  const usp = req.usps.map((u) => u.trim().replace(/[.!]+$/, "")).filter(Boolean);
  const lower = product.toLowerCase();
  const descTemplates = [
    `${product}${audience ? ` for ${audience}` : ""}. ${usp[0] ? `${usp[0]}. ` : "Browse the full range and find your fit. "}${ctas[0]}.`,
    `Explore ${brand ? `${brand} ` : ""}${lower}${kws[1] ? ` and ${kws[1].toLowerCase()}` : ""}. Compare styles and sizes, then order online.`,
    `${usp[1] ? `${usp[1]}. ` : ""}Find the right ${lower} for you and check out in minutes.`,
    `${brand ? `${brand}: ` : ""}${usp[2] ?? "quality you can count on"}. ${ctas[1] ?? "Shop now"}.`,
  ];
  const descriptions: AdCopy["descriptions"] = [];
  for (const d of descTemplates) {
    const t = fitAdText(d.replace(/\s+/g, " ").replace(/\.\./g, "."), AD_TEXT_LIMITS.description);
    if (t && !descriptions.some((x) => x.text.toLowerCase() === t.toLowerCase())) descriptions.push({ text: t, pin: null });
  }
  const slug = (s: string | undefined) => (s ? fitAdText(s.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-"), AD_TEXT_LIMITS.path) : null);
  const words = (req.keywords[0] ?? req.product).split(/\s+/).filter(Boolean);
  return { headlines, descriptions, path1: slug(words[0] ? titleCase(words[0]) : undefined), path2: slug(words[1] ? titleCase(words.slice(1, 3).join(" ")) : undefined) };
}

// ── Blueprint ──────────────────────────────────────────────────────────────────────────────────────────

const BID_BY_TYPE: Record<CampaignIdea["type"], Blueprint["bidding"]["strategy"]> = {
  Search: "MAXIMIZE_CONVERSIONS",
  PMax: "MAXIMIZE_CONVERSION_VALUE",
  Shopping: "MAXIMIZE_CONVERSION_VALUE",
  Video: "MAXIMIZE_CONVERSIONS",
  Display: "MAXIMIZE_CONVERSIONS",
  "Demand Gen": "MAXIMIZE_CONVERSIONS",
};

const OBJECTIVE_BY_TYPE: Record<CampaignIdea["type"], string> = {
  Search: "Sales — capture high-intent searches",
  PMax: "Sales — conversion value across Google channels",
  Shopping: "Sales — product listing ads from the feed",
  Video: "Awareness and consideration with conversion follow-up",
  Display: "Remarketing and prospecting on the Display Network",
  "Demand Gen": "Demand generation on YouTube, Discover and Gmail",
};

export interface BlueprintContext {
  brand?: string | null;
  /** negative keywords every new campaign should start with */
  negatives?: readonly string[];
}

/** A launch-ready template built from the idea: one ad group per keyword theme, limits respected, all Paused on export. */
export function demoBlueprint(idea: CampaignIdea, ctx: BlueprintContext = {}): Blueprint {
  const themes = (idea.keywords.length ? idea.keywords : [idea.title]).slice(0, 3);
  const search = idea.type === "Search";
  const brand = ctx.brand ? titleCase(ctx.brand) : "";
  const adGroups: Blueprint["adGroups"] = themes.map((theme) => {
    const t = theme.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim() || idea.title.toLowerCase();
    const T = titleCase(t);
    const copy = demoAdCopy({ product: t, audience: "", usps: [], keywords: [t], tone: "confident" }, { brand });
    return {
      name: fitAdText(T, 60),
      theme: `${T} — ${idea.audience || idea.title}`,
      keywords: search
        ? [
            { text: t, matchType: "Exact" as const },
            { text: t, matchType: "Phrase" as const },
            { text: `${t} online`, matchType: "Phrase" as const },
            { text: `buy ${t}`, matchType: "Phrase" as const },
            { text: `${t} sale`, matchType: "Broad" as const },
          ]
        : [],
      negatives: [],
      rsa: { headlines: copy.headlines.map((h) => h.text).slice(0, 10), descriptions: copy.descriptions.map((d) => d.text).slice(0, 4), path1: copy.path1, path2: copy.path2 },
    };
  });
  const negatives = (ctx.negatives ?? ["free", "jobs", "diy", "repair", "used"]).map((text) => ({ text, matchType: "Phrase" as const }));
  return {
    campaignName: fitAdText(idea.title.toLowerCase().includes(idea.type.toLowerCase()) ? idea.title : `${idea.type} — ${idea.title}`, 120),
    type: idea.type,
    objective: OBJECTIVE_BY_TYPE[idea.type],
    bidding: { strategy: BID_BY_TYPE[idea.type], targetCpa: null, targetRoas: null },
    dailyBudget: idea.dailyBudget,
    targeting: { locations: ["United States"], languages: ["English"], audiences: idea.audience ? [idea.audience] : [], devices: null, adSchedule: null },
    adGroups,
    campaignNegatives: search ? negatives : [],
    sitelinks: [
      { text: "Shop New Arrivals", line1: "Discover the latest styles", line2: "Updated every season" },
      { text: "Best Sellers", line1: "Our most popular picks", line2: "Chosen by customers" },
      { text: "Size & Fit Guide", line1: "Find the right size", line2: "Compare fits before you buy" },
      { text: "Contact Us", line1: "Questions? We can help", line2: "Reach our support team" },
    ],
    callouts: ["Secure Checkout", "Easy Returns", "Order Online", "Helpful Support"],
    launchChecklist: [
      "Confirm the purchase conversion action is recording (Tag Assistant)",
      "Add a final URL to every ad and sitelink before importing",
      "Review every headline and claim for accuracy",
      search ? "Apply the account negative keyword list" : "Upload images and videos for the asset groups",
      "Check location and language targeting",
      "Import paused, review in Google Ads Editor, then enable",
      "Re-check spend and search terms after 3 days",
    ],
  };
}

// ── Narrative ──────────────────────────────────────────────────────────────────────────────────────────

const METRIC_LABEL: Record<string, string> = { spend: "Spend", cost: "Spend", conversions: "Conversions", cpa: "CPA", ctr: "CTR", cpc: "CPC", cvr: "CVR", roas: "ROAS" };

function signalPhrase(s: NarrativeFacts["signals"][number]): string {
  if (s.kind === "pacing" || s.kind === "overdelivery") return `${s.shortName} ${s.changePct < 0 ? "underpacing" : "overpacing"}`;
  if (!s.metric) return `${s.shortName} ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}`;
  const label = METRIC_LABEL[s.metric] ?? s.metric;
  return `${s.shortName} ${label} ${s.changePct >= 0 ? "+" : "−"}${Math.abs(s.changePct * 100).toFixed(0)}%`;
}

/** The prototype's insight sentence, generalised. */
export function insightSentence(facts: Pick<NarrativeFacts, "signals" | "bestRoas">): string {
  const top2 = facts.signals.slice(0, 2).map(signalPhrase);
  const first = top2.length ? `${top2.join(" and ")} need${top2.length === 1 ? "s" : ""} attention first.` : "No critical signals.";
  const best = facts.bestRoas ? ` ${facts.bestRoas.shortName} returns ${facts.bestRoas.roas.toFixed(1)}x — the clearest place to scale.` : "";
  return `${first}${best}`;
}

export function demoNarrative(facts: NarrativeFacts): Narrative {
  const bullets: Narrative["bullets"] = facts.kpis.map((k) => ({
    text: k.previous !== null && k.changePct !== null ? `${k.label} ${k.display} (${k.deltaDisplay} vs previous period).` : `${k.label} ${k.display}.`,
    sentiment: k.sentiment,
    refs: [`kpi:${k.metric}`],
  }));
  if (facts.biggestMover) {
    const m = facts.biggestMover;
    bullets.push({ text: `Biggest mover: ${m.shortName} spend ${m.delta >= 0 ? "up" : "down"} ${money0(Math.abs(m.delta))} (${money0(m.previous)} → ${money0(m.value)}).`, sentiment: "neutral", refs: [`campaign:${m.campaignId}`] });
  }
  if (facts.pacing) {
    const p = facts.pacing;
    bullets.push({ text: `Month-end spend projected at ${money0(p.projected)} vs ${money0(p.target)} target (${Math.round(p.paceRatio * 100)}% pace).`, sentiment: p.paceRatio > 1.05 || p.paceRatio < 0.9 ? "negative" : "positive", refs: ["pacing"] });
  }
  const nextSteps = facts.signals.slice(0, 2).map((s) => `${s.shortName}: ${s.recommendation}`);
  if (facts.bestRoas) nextSteps.push(`Test more budget on ${facts.bestRoas.shortName} while ROAS holds at ${facts.bestRoas.roas.toFixed(1)}x.`);
  if (!nextSteps.length) nextSteps.push("No action needed on critical signals — keep monitoring.");
  return { headline: insightSentence(facts), bullets, nextSteps };
}

/** Every number the narrative may quote (in the forms a writer would use: raw, percent, absolute delta). */
export function narrativeFactNumbers(facts: NarrativeFacts): number[] {
  const out: number[] = [facts.range.days];
  for (const k of facts.kpis) {
    for (const v of [k.value, k.previous]) if (v !== null) out.push(v);
    if (k.value !== null && k.previous !== null) out.push(k.value - k.previous);
    if (k.changePct !== null) out.push(k.changePct * 100);
  }
  for (const s of facts.signals) out.push(s.changePct * 100, (1 + s.changePct) * 100);
  if (facts.bestRoas) out.push(facts.bestRoas.roas, facts.bestRoas.cost);
  if (facts.biggestMover) {
    const m = facts.biggestMover;
    out.push(m.value, m.previous, m.delta);
    if (m.changePct !== null) out.push(m.changePct * 100);
  }
  if (facts.pacing) out.push(facts.pacing.projected, facts.pacing.target, facts.pacing.paceRatio * 100, facts.pacing.projected - facts.pacing.target);
  return out;
}

/** The sentences and names the model is given with the facts: numbers it quotes from them (a recommendation's
 *  "14 days", a change to an ad called "Fall drop 15s", "Search 360") are grounded too. */
export function narrativeFactTexts(facts: NarrativeFacts): string[] {
  return [
    facts.range.label,
    ...facts.kpis.flatMap((k) => [k.display, k.deltaDisplay]),
    ...facts.signals.flatMap((s) => [s.title, s.recommendation, s.campaign]),
    ...(facts.bestRoas ? [facts.bestRoas.name] : []),
    ...(facts.biggestMover ? [facts.biggestMover.name] : []),
  ];
}

// ── Chat narration (demo answers and step-2 fallback) ──────────────────────────────────────────────────

export interface NarrationItem {
  title: string;
  result: QueryResult;
}

function metricText(registry: MetricRegistry, key: string, v: number | null | undefined, currency: string): string {
  const def = registry.get(key);
  return formatMetricValue(def?.format ?? "number", v, { currency });
}

const dimLabelOf = (row: QueryRow, dims: string[]) => dims.map((d) => String(row[d] ?? "—")).join(" · ");

/** Templated narration of query results — only numbers present in the results are used. */
export function narrateResults(items: readonly NarrationItem[], registry: MetricRegistry): string {
  const parts: string[] = [];
  for (const { title, result } of items) {
    const currency = result.meta.currency;
    const dims = result.columns.filter((c) => c.kind === "dimension").map((c) => c.key);
    const metrics = result.columns.filter((c) => c.kind === "metric").map((c) => c.key);
    const label = (k: string) => registry.get(k)?.short ?? k;
    const fmt = (k: string, v: unknown) => metricText(registry, k, typeof v === "number" ? v : null, currency);
    const period = `${result.meta.range.start} → ${result.meta.range.end}`;
    if (!result.rows.length) {
      parts.push(`**${title}** — no rows matched (${period}). Try a wider date range or fewer filters.`);
      continue;
    }
    if (!dims.length) {
      const row = result.rows[0] ?? {};
      const kpis = metrics.map((m) => {
        const pct = row[`${m}__pct`];
        const change = typeof pct === "number" ? ` (${pct >= 0 ? "+" : "−"}${Math.abs(pct * 100).toFixed(1)}% vs ${fmt(m, row[`${m}__prev`])})` : "";
        return `${label(m)} ${fmt(m, row[m])}${change}`;
      });
      parts.push(`**${title}** (${period}): ${kpis.join(", ")}.`);
      continue;
    }
    const first = metrics[0] ?? "";
    const timeDim = dims[0] && DIMENSIONS[dims[0] as DimensionKey]?.kind === "time";
    if (timeDim && first) {
      const vals = result.rows.map((r) => ({ at: String(r[dims[0] as string] ?? ""), v: typeof r[first] === "number" ? (r[first] as number) : null })).filter((x) => x.v !== null) as { at: string; v: number }[];
      const peak = vals.reduce((a, b) => (b.v > a.v ? b : a), vals[0] ?? { at: "", v: 0 });
      const low = vals.reduce((a, b) => (b.v < a.v ? b : a), vals[0] ?? { at: "", v: 0 });
      const total = result.totals?.[first];
      const lastPoint = vals[vals.length - 1];
      parts.push(
        `**${title}** (${period}): ${label(first)} ${total !== undefined && total !== null ? `totals ${fmt(first, total)}; ` : ""}highest ${fmt(first, peak.v)} (${peak.at}), lowest ${fmt(first, low.v)} (${low.at})${lastPoint ? `, latest ${fmt(first, lastPoint.v)} (${lastPoint.at})` : ""}.`,
      );
      continue;
    }
    const lines = result.rows.slice(0, 5).map((r, i) => {
      const rest = metrics.slice(1, 3).map((m) => `${label(m)} ${fmt(m, r[m])}`);
      const pct = r[`${first}__pct`];
      const change = typeof pct === "number" ? `, ${pct >= 0 ? "+" : "−"}${Math.abs(pct * 100).toFixed(1)}% vs previous` : "";
      return `${i + 1}. ${dimLabelOf(r, dims)} — ${label(first)} ${fmt(first, r[first])}${change}${rest.length ? ` (${rest.join(", ")})` : ""}`;
    });
    const more = result.rows.length > 5 ? `\n…and ${result.rows.length - 5} more in the table.` : "";
    // Engine totals cover every row that passed filters/having, including rows cut by the limit.
    const scope = result.meta.truncated ? `All ${DIMENSIONS[dims[0] as DimensionKey]?.label.toLowerCase() ?? "row"}s combined` : "Total";
    const totals = result.totals && first && result.totals[first] !== undefined ? `\n${scope}: ${label(first)} ${fmt(first, result.totals[first])}.` : "";
    parts.push(`**${title}** (${period}):\n${lines.join("\n")}${more}${totals}`);
  }
  return parts.join("\n\n");
}

/** Deterministic follow-up prompts for a query. */
export function followUps(dims: readonly string[], compare: string): string[] {
  const out: string[] = [];
  if (!dims.includes("date")) out.push("Show the daily trend");
  if (!dims.includes("device")) out.push("Break it down by device");
  if (!dims.includes("campaign")) out.push("Which campaigns drive this?");
  if (compare === "none") out.push("Compare with the previous period");
  return out.slice(0, 3);
}
