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
const 戴壍: ChartTokens = {
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
const 脣壍: ChartTokens = {
    ...戴壍,
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
function 丒壍(洁壍: string, 诰壍: string): string {
    if (typeof window === "undefined")
        return 诰壍;
    const 壟壍 = getComputedStyle(document.documentElement).getPropertyValue(洁壍).trim();
    return 壟壍 ? `${壟壍}, ${诰壍}` : 诰壍;
}
let 矎壍: {
    theme: string;
    tokens: ChartTokens;
} | null = null;
export function readChartTokens(): ChartTokens {
    const 隽壍 = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    if (矎壍 && 矎壍.theme === 隽壍)
        return 矎壍.tokens;
    const 掬壍 = 隽壍 === "dark" ? 脣壍 : 戴壍;
    const 芛壍: ChartTokens = {
        ...掬壍,
        fontSans: 丒壍("--nf-sans", 掬壍.fontSans),
        fontMono: 丒壍("--nf-mono", 掬壍.fontMono),
        fontDisplay: 丒壍("--nf-display", 掬壍.fontDisplay),
    };
    矎壍 = { theme: 隽壍, tokens: 芛壍 };
    return 芛壍;
}
function 侊壍(湹壍: () => void): () => void {
    const 赨壍 = new MutationObserver(() => {
        矎壍 = null;
        湹壍();
    });
    赨壍.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => 赨壍.disconnect();
}
export function useChartTokens(): ChartTokens {
    return useSyncExternalStore(侊壍, readChartTokens, () => 戴壍);
}
