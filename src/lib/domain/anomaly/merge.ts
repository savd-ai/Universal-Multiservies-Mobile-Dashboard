import type { DetectorId, Signal } from "../contracts/anomaly";
import { DETECTOR_PRIORITY, mergeKey, SEVERITY_RANK } from "./ids";
const priority = (d: DetectorId) => {
    const i = DETECTOR_PRIORITY.indexOf(d);
    return i < 0 ? DETECTOR_PRIORITY.length : i;
};
function better(a: Signal, b: Signal): Signal {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0)
        return sev > 0 ? a : b;
    if (a.score !== b.score)
        return a.score > b.score ? a : b;
    return priority(a.detectors[0] ?? "zscore") <= priority(b.detectors[0] ?? "zscore") ? a : b;
}
const unionDetectors = (...lists: DetectorId[][]): DetectorId[] => [...new Set(lists.flat())].sort((x, y) => priority(x) - priority(y));
export function mergeSignals(signals: readonly Signal[]): Signal[] {
    const groups = new Map<string, Signal>();
    for (const s of signals) {
        const key = mergeKey(s);
        const prev = groups.get(key);
        if (!prev) {
            groups.set(key, s);
            continue;
        }
        const keep = better(prev, s);
        const other = keep === prev ? s : prev;
        const detectors = unionDetectors(keep.detectors, other.detectors);
        groups.set(key, { ...keep, detectors: [keep.detectors[0] ?? detectors[0] ?? "zscore", ...detectors.filter((d) => d !== keep.detectors[0])] });
    }
    return [...groups.values()];
}
const TRACKING_SYMPTOMS = new Set(["conversions", "cpa", "cvr", "roas"]);
export function absorbSymptoms(signals: readonly Signal[], accountId?: string): Signal[] {
    const diagnoses = new Map<string, Signal>();
    for (const s of signals) {
        if (s.kind === "tracking_break" || s.kind === "zero_delivery") {
            const key = `${s.entity.id}:${s.window.recentEnd}`;
            const prev = diagnoses.get(key);
            diagnoses.set(key, prev && prev.kind === "zero_delivery" ? prev : s);
        }
    }
    if (!diagnoses.size)
        return [...signals];
    const absorbed = new Map<string, Signal[]>();
    const kept: Signal[] = [];
    for (const s of signals) {
        const own = diagnoses.get(`${s.entity.id}:${s.window.recentEnd}`);
        const account = accountId ? diagnoses.get(`${accountId}:${s.window.recentEnd}`) : undefined;
        const d = own ?? (account?.kind === "tracking_break" ? account : undefined);
        const symptom = d && s !== d && s.kind === "metric_deviation" && s.polarity === "bad" && (d.kind === "zero_delivery" || TRACKING_SYMPTOMS.has(s.metric ?? ""));
        if (symptom && d) {
            const list = absorbed.get(d.id) ?? [];
            list.push(s);
            absorbed.set(d.id, list);
        }
        else
            kept.push(s);
    }
    return kept.map((s) => {
        const list = absorbed.get(s.id);
        if (!list?.length)
            return s;
        const worst = list.reduce((a, b) => better(a, b));
        return {
            ...s,
            severity: SEVERITY_RANK[worst.severity] > SEVERITY_RANK[s.severity] ? worst.severity : s.severity,
            detectors: [s.detectors[0] ?? "tracking_break", ...unionDetectors(s.detectors.slice(1), ...list.map((x) => x.detectors)).filter((d) => d !== s.detectors[0])],
            evidence: [...s.evidence, { label: "Also flagged", value: list.map((x) => `${x.entity.id === s.entity.id ? "" : `${x.entity.name}: `}${x.title}${x.z !== undefined ? ` (z ${x.z.toFixed(1)})` : ""}`).join(" · ") }],
        };
    });
}
export function sortSignals(signals: readonly Signal[]): Signal[] {
    return [...signals].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.score - a.score || a.id.localeCompare(b.id));
}
