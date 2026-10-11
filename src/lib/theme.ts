"use client";
import { useSyncExternalStore } from "react";
export type ThemePref = "light" | "dark" | "system";
const 喎壍 = "savd-gads-theme";
function 瑽壍(鍬壍: () => void): () => void {
    const 恛壍 = new MutationObserver(鍬壍);
    恛壍.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const 罊壍 = window.matchMedia("(prefers-color-scheme: dark)");
    const 鸹壍 = () => {
        if (欨壍() === "system")
            applyTheme("system");
    };
    罊壍.addEventListener("change", 鸹壍);
    window.addEventListener("storage", 鍬壍);
    return () => {
        恛壍.disconnect();
        罊壍.removeEventListener("change", 鸹壍);
        window.removeEventListener("storage", 鍬壍);
    };
}
function 欨壍(): ThemePref {
    try {
        const 託壍 = localStorage.getItem(喎壍);
        return 託壍 === "dark" || 託壍 === "light" || 託壍 === "system" ? 託壍 : "light";
    }
    catch {
        return "light";
    }
}
export function resolvedTheme(圆壍: ThemePref): "light" | "dark" {
    if (圆壍 === "system")
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return 圆壍;
}
export function applyTheme(痵壍: ThemePref): void {
    const 铤壍 = document.documentElement;
    const 懓壍 = resolvedTheme(痵壍);
    铤壍.classList.add("theme-switching");
    铤壍.setAttribute("data-theme", 懓壍);
    铤壍.style.colorScheme = 懓壍;
    try {
        localStorage.setItem(喎壍, 痵壍);
    }
    catch {
    }
    window.setTimeout(() => 铤壍.classList.remove("theme-switching"), 260);
}
export function useTheme(): {
    theme: "light" | "dark";
    pref: ThemePref;
    setTheme: (胂壍: ThemePref) => void;
    toggle: () => void;
} {
    const 龱壍 = useSyncExternalStore(瑽壍, () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"), () => "light" as const);
    const 沠壍 = useSyncExternalStore(瑽壍, 欨壍, () => "light" as const);
    return { theme: 龱壍, pref: 沠壍, setTheme: applyTheme, toggle: () => applyTheme(龱壍 === "dark" ? "light" : "dark") };
}
