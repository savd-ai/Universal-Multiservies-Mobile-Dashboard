"use client";
import { useSyncExternalStore } from "react";
export interface ChartTokens {
    theme: "light" | "dark";
    text: string;
    muted: string;
    muted3: string;
    faint: string;
    surface: string;
    grid: string;
    line: string;
    accent: string;
    accentLine: string;
    crit: string;
    warn: string;
    mint: string;
    series: string[];
    other: string;
    fontSans: string;
    fontMono: string;
    fontDisplay: string;
}
const LIGHT: ChartTokens = {
    theme: "light",
    text: "#1c1c1e",
    muted: "#48484a",
    muted3: "#5f5f64",
    faint: "#6e6e73",
    surface: "#ffffff",
    grid: "rgba(60,60,67,0.08)",
    line: "rgba(60,60,67,0.12)",
    accent: "#007864",
    accentLine: "#00a38a",
    crit: "#d70015",
    warn: "#c93400",
    mint: "#1d9e8a",
    series: ["#00a38a", "#2a78d6", "#c2549a", "#4a3aa7", "#8f9a2b", "#a24bc2"],
    other: "rgba(60,60,67,0.35)",
    fontSans: "Plus Jakarta Sans, sans-serif",
    fontMono: "IBM Plex Mono, monospace",
    fontDisplay: "Space Grotesk, sans-serif",
};
const DARK: ChartTokens = {
    ...LIGHT,
    theme: "dark",
    text: "#f5f5f3",
    muted: "#a8abb2",
    muted3: "#9aa0a6",
    faint: "#888c92",
    surface: "#0e0f11",
    grid: "rgba(255,255,255,0.06)",
    line: "rgba(255,255,255,0.12)",
    accent: "#04bf9d",
    accentLine: "#04bf9d",
    crit: "#f47c6b",
    warn: "#f2c36a",
    mint: "#5fe3cd",
    series: ["#0a9e84", "#3987e5", "#d55181", "#9085e9", "#8f9a2b", "#c06bd8"],
    other: "rgba(255,255,255,0.35)",
};
function cssFont(name: string, fallback: string): string {
    if (typeof window === "undefined")
        return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? `${v}, ${fallback}` : fallback;
}
let cached: {
    theme: string;
    tokens: ChartTokens;
} | null = null;
export function readChartTokens(): ChartTokens {
    const theme = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    if (cached && cached.theme === theme)
        return cached.tokens;
    const base = theme === "dark" ? DARK : LIGHT;
    const tokens: ChartTokens = {
        ...base,
        fontSans: cssFont("--nf-sans", base.fontSans),
        fontMono: cssFont("--nf-mono", base.fontMono),
        fontDisplay: cssFont("--nf-display", base.fontDisplay),
    };
    cached = { theme, tokens };
    return tokens;
}
function subscribe(cb: () => void): () => void {
    const obs = new MutationObserver(() => {
        cached = null;
        cb();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
}
export function useChartTokens(): ChartTokens {
    return useSyncExternalStore(subscribe, readChartTokens, () => LIGHT);
}
