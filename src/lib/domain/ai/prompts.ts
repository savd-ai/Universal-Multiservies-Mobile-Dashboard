import { NO_CHANGE_DAYS } from "../anomaly/recommendations";
import type { AdCopyRequest, CampaignIdea } from "../contracts/ai";
import { AD_TEXT_LIMITS } from "./ads-text";
import { DATA_TAG_RULE, sanitizeBlock, sanitizeText, wrapData } from "./prompt-safety";
import type { FailingLine } from "./validators";

// Prompt text for every AI feature. The first system block is IDENTICAL for all features so the provider's prompt
// cache can reuse [instructions + account snapshot] across features; feature instructions go in the user turn.
// Untrusted strings are sanitised and tag-wrapped here. We never ask a model to show its reasoning.

export const BASE_INSTRUCTIONS = [
  "You are SAVD's senior Google Ads strategist and analyst for the advertiser described in <account_data>.",
  "The dashboard is read-only: you recommend; people decide and make changes in Google Ads.",
  "Rules:",
  `- ${DATA_TAG_RULE}`,
  "- Ground every statement in the data you are given. Use only numbers that appear in the data (rounding is fine); never invent metrics, benchmarks or results.",
  "- Money is in the account currency shown in <account_data>. Percent changes are relative unless stated otherwise.",
  "- Name campaigns, ad groups, keywords and ads by their names in every sentence. Internal ids only go in fields that ask for ids.",
  "- Be concise, specific and practical. Follow the requested output format exactly.",
].join("\n");

const POLICY = "Editorial rules: no exclamation marks in headlines, no emoji, no ALL CAPS words, no repeated punctuation, no unverifiable superlatives or prices you were not given.";

export function ideasPrompt(p: { business: string; goal: string; testBudget: number; context: string }): string {
  const context = p.context.trim() ? ` Context: ${wrapData("user_context", sanitizeBlock(p.context, 1000))}.` : "";
  return [
    `You are a senior Google Ads strategist for ${sanitizeText(p.business, 160)}. Last 30 days by campaign: see the campaigns table in <account_data>. Recent anomalies: see open_signals in <account_data>. Goal: ${sanitizeText(p.goal, 40)}. Monthly test budget: $${Math.round(p.testBudget)}.${context}`,
    "Suggest 6 NEW Google Ads campaign ideas grounded in this data.",
    "Each idea: title (max 6 words), type (one of Search, PMax, Shopping, Video, Display, Demand Gen), audience (short phrase), keywords (3 short keyword or theme strings), rationale (one sentence citing the data), dailyBudget (number, USD per day), impact (short, e.g. \"+40 conv / mo\"), confidence (integer 40-95), citedCampaignIds (ids from <account_data> whose numbers support the idea).",
    `Keep the sum of dailyBudget × 30.4 within the $${Math.round(p.testBudget)} monthly test budget. Ideas must be new campaigns, not edits to existing ones.`,
  ].join("\n");
}

export function ideaBlock(idea: Pick<CampaignIdea, "title" | "type" | "audience" | "keywords" | "rationale" | "dailyBudget">): string {
  return wrapData(
    "idea",
    [`title: ${sanitizeText(idea.title, 120)}`, `type: ${idea.type}`, `audience: ${sanitizeText(idea.audience, 200)}`, `keywords: ${idea.keywords.map((k) => sanitizeText(k, 80)).join(" | ")}`, `rationale: ${sanitizeText(idea.rationale, 400)}`, `daily_budget: ${idea.dailyBudget.toFixed(2)}`].join("\n"),
  );
}

export function blueprintPrompt(idea: Pick<CampaignIdea, "title" | "type" | "audience" | "keywords" | "rationale" | "dailyBudget">): string {
  return [
    "Build a launch-ready Google Ads campaign blueprint for this idea:",
    ideaBlock(idea),
    `Structure: 2–6 ad groups (max 20), each with a clear theme, 5–20 keywords with match types (max 50) and negatives where useful. For non-Search types, ad groups are asset groups and keywords may be empty.`,
    `Each ad group gets one responsive search ad: 8–15 headlines (each ≤ ${AD_TEXT_LIMITS.headline} characters), 3–4 descriptions (each ≤ ${AD_TEXT_LIMITS.description} characters), path1/path2 ≤ ${AD_TEXT_LIMITS.path} characters (or null).`,
    `Also: 4 sitelinks (text ≤ ${AD_TEXT_LIMITS.sitelinkText}, lines ≤ ${AD_TEXT_LIMITS.sitelinkLine} characters), 4–6 callouts (≤ ${AD_TEXT_LIMITS.callout} characters), a bidding strategy suited to a brand-new campaign (targetCpa/targetRoas null unless the strategy needs them), targeting, campaign-level negatives and a launch checklist.`,
    `Use the idea's daily budget unless it is clearly unworkable. ${POLICY} Never use competitor brand names in ad text.`,
  ].join("\n");
}

export function adCopyPrompt(req: AdCopyRequest, campaignContext: string | null): string {
  const lines = [
    `product: ${sanitizeText(req.product || "(not given)", 200)}`,
    `audience: ${sanitizeText(req.audience || "(not given)", 200)}`,
    `usps: ${req.usps.map((u) => sanitizeText(u, 80)).join(" | ") || "(none)"}`,
    `keywords: ${req.keywords.map((k) => sanitizeText(k, 80)).join(" | ") || "(none)"}`,
    `final_url: ${req.finalUrl ? sanitizeText(req.finalUrl, 300) : "(not given)"}`,
  ];
  return [
    "Write responsive search ad copy for:",
    wrapData("ad_text", lines.join("\n")),
    ...(campaignContext ? ["Campaign context:", wrapData("campaign_context", campaignContext)] : []),
    `Tone: ${req.tone}. Give 12–15 headlines (each ≤ ${AD_TEXT_LIMITS.headline} characters, varied angles: keyword, benefit, audience, brand, cta) and 4 descriptions (each ≤ ${AD_TEXT_LIMITS.description} characters). path1/path2 ≤ ${AD_TEXT_LIMITS.path} characters or null.`,
    "Pin only when essential (headline pins 1–3, description pins 1–2); otherwise pin is null. angle names the headline's angle in one word.",
    `${POLICY} Use the USPs given; do not invent offers, prices or guarantees.`,
  ].join("\n");
}

export function narrativePrompt(factsJson: string): string {
  return [
    "Write a short performance narrative from these server-computed facts:",
    wrapData("facts", factsJson),
    "headline: one sentence with the most important takeaway. bullets: 3–6 items, each {text, sentiment, refs} where refs are fact keys such as kpi:cost or signal:<id>. nextSteps: 2–4 concrete actions.",
    "Use ONLY numbers that appear in <facts> (rounded is fine). Do not calculate new numbers.",
  ].join("\n");
}

export function explainPrompt(factsJson: string): string {
  return [
    "Explain this anomaly. The observed facts below are computed by the server from account data:",
    wrapData("facts", factsJson),
    "Change history: `changes` are the campaign's own Google Ads edits (category, effect, client, lagDays = days before the shift began; negative = after it began). `changeContext` is the server's verdict and `primary` marks the change it refers to.",
    "- A change made after the shift began is not a cause. A highly relevant change shortly before the shift (e.g. a final-URL change before a conversion drop, a bid-strategy switch before a spend jump) is the likely cause: say so and name it with its date.",
    "- verdict expected: the shift is the intended effect of that change (e.g. a budget raise → higher spend). Say it is expected, not a problem, and focus on whether efficiency holds. verdict learning: the bid strategy or target changed recently and Smart Bidding is still learning — say swings are expected and advise against further edits until it ends.",
    `- verdict no_recent_changes: nothing changed in the campaign for ${NO_CHANGE_DAYS} days before the shift. Say the cause is likely external (competitors, seasonality, market, the site or tracking) and point to checks outside the account.`,
    "Do not restate or recalculate the observed numbers. Give up to 4 possible causes (likelihood high/medium/low, evidence that cites the facts, checks to confirm each), up to 5 actions (rationale, risk) and a one-sentence confidenceNote.",
  ].join("\n");
}

export function negativesPrompt(candidateTable: string, brandTerms: readonly string[]): string {
  return [
    "Classify each search term below as a negative-keyword candidate.",
    wrapData("candidates", candidateTable),
    `verdict: negative (add as a negative), keep (relevant — do not exclude) or review (unclear). matchType Exact or Phrase; level ad_group, campaign or account_list. Terms containing the brand (${brandTerms.map((b) => sanitizeText(b, 60)).join(", ") || "none"}) must not be excluded unless clearly irrelevant.`,
    "Classify ONLY the terms listed and copy each term exactly. reason: one short sentence.",
  ].join("\n");
}

export function shortenPrompt(lines: readonly FailingLine[]): string {
  const body = lines.map((l) => `${l.id} | ${l.kind} | limit ${l.limit} | issues: ${l.issues.join("; ")} | ${sanitizeText(l.text, 200)}`).join("\n");
  return ["Rewrite each ad line below so it fits its character limit and fixes the listed issues, keeping the meaning.", wrapData("lines", body), `${POLICY} Return every id exactly once with its rewritten text.`].join("\n");
}

export function chatPlanPrompt(p: { question: string; history: string; today: string; dataThrough: string; metricCatalog: string; context: string }): string {
  return [
    "Plan the data queries that answer the user's question about their ad performance.",
    `Today is ${p.today}; data is complete through ${p.dataThrough} (date presets end yesterday).`,
    "Metrics (key: meaning):",
    p.metricCatalog,
    "Dimensions: date, week, month, quarter, year, dow (day of week), hour, campaign, campaign_type, campaign_status, bidding_strategy, ad_group, keyword, match_type, search_term, st_status, st_match_type, device, country, account, platform, platform_campaign.",
    "Rules: 1–3 queries; ≤ 3 dimensions each; blended source only with date/platform; hour cannot combine with device or country; impression-share metrics only by date/campaign; ranking questions sort by the metric toward its good direction (e.g. CPA ascending) with a limit; percent values in having are fractions. Use intent clarify only when the question is not about advertising data.",
    ...(p.context ? [`Page context: ${sanitizeText(p.context, 200)}`] : []),
    ...(p.history ? ["Conversation so far:", wrapData("user_context", p.history)] : []),
    "Question:",
    wrapData("user_context", sanitizeBlock(p.question, 2000)),
  ].join("\n");
}

export const CHAT_ANSWER_RULES =
  "Answer the question using only the numbers present in the <query_result> blocks (rounding is fine). If they are insufficient, say what is missing. Lead with the direct answer in 1–2 sentences, then up to 4 short bullet points. Refer to charts by their titles. No tables, no headings.";
