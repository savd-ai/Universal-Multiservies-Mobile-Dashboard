import { Platform, useColorScheme } from "react-native";

/** SAVD design tokens (src/styles/tokens.css in the web app), as React Native colors. */
const light = {
  bg: "#f2f2f7",
  surface: "#ffffff",
  card: "#ffffff",
  cardBorder: "rgba(60, 60, 67, 0.12)",
  text: "#1c1c1e",
  muted: "#48484a",
  muted3: "#5f5f64",
  faint: "#6e6e73",
  line: "rgba(60, 60, 67, 0.14)",
  input: "rgba(118, 118, 128, 0.12)",
  accent: "#007864",
  accentLine: "#00a38a",
  onAccent: "#ffffff",
  tealTint: "rgba(0, 163, 138, 0.12)",
  crit: "#d70015",
  critTint: "rgba(255, 59, 48, 0.12)",
  warn: "#c93400",
  warnTint: "rgba(255, 149, 0, 0.14)",
  series1: "#00a38a",
  series2: "#2a78d6",
  logoInk: "#16171a",
  logoD: "#027368",
};

const dark: typeof light = {
  bg: "#0b0c0e",
  surface: "#0e0f11",
  card: "#111a19",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  text: "#f5f5f3",
  muted: "#a8abb2",
  muted3: "#9aa0a6",
  faint: "#888c92",
  line: "rgba(255, 255, 255, 0.1)",
  input: "rgba(255, 255, 255, 0.08)",
  accent: "#04bf9d",
  accentLine: "#04bf9d",
  onAccent: "#0e0f11",
  tealTint: "rgba(4, 191, 157, 0.14)",
  crit: "#ef7b6c",
  critTint: "rgba(239, 123, 108, 0.14)",
  warn: "#e9c46a",
  warnTint: "rgba(233, 196, 106, 0.13)",
  series1: "#0a9e84",
  series2: "#3987e5",
  logoInk: "#f5f5f3",
  logoD: "#04bf9d",
};

export type Palette = typeof light;

export const fonts = {
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
  serifItalic: Platform.select({ ios: "Georgia-Italic", default: "serif" }),
};

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { card: 18, mini: 12, pill: 999 };
