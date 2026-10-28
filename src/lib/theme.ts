"use client";
import { useSyncExternalStore } from "react";
export type ThemePref = "light" | "dark" | "system";
const KEY = "savd-gads-theme";
function subscribe(cb: () => void): () => void {
    const obs = new MutationObserver(cb);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => {
        if (readPref() === "system")
            applyTheme("system");
    };
    mq.addEventListener("change", onMq);
    window.addEventListener("storage", cb);
    return () => {
        obs.disconnect();
        mq.removeEventListener("change", onMq);
        window.removeEventListener("storage", cb);
    };
}
function readPref(): ThemePref {
    try {
        const v = localStorage.getItem(KEY);
        return v === "dark" || v === "light" || v === "system" ? v : "light";
    }
    catch {
        return "light";
    }
}
export function resolvedTheme(pref: ThemePref): "light" | "dark" {
    if (pref === "system")
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return pref;
}
export function applyTheme(pref: ThemePref): void {
    const root = document.documentElement;
    const t = resolvedTheme(pref);
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", t);
    root.style.colorScheme = t;
    try {
        localStorage.setItem(KEY, pref);
    }
    catch {
    }
    window.setTimeout(() => root.classList.remove("theme-switching"), 260);
}
export function useTheme(): {
    theme: "light" | "dark";
    pref: ThemePref;
    setTheme: (p: ThemePref) => void;
    toggle: () => void;
} {
    const theme = useSyncExternalStore(subscribe, () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"), () => "light" as const);
    const pref = useSyncExternalStore(subscribe, readPref, () => "light" as const);
    return { theme, pref, setTheme: applyTheme, toggle: () => applyTheme(theme === "dark" ? "light" : "dark") };
}
