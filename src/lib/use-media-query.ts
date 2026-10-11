"use client";
import { useSyncExternalStore } from "react";
export function useMediaQuery(讏壍: string): boolean {
    return useSyncExternalStore((塾壍) => {
        const 睭壍 = window.matchMedia(讏壍);
        睭壍.addEventListener("change", 塾壍);
        return () => 睭壍.removeEventListener("change", 塾壍);
    }, () => window.matchMedia(讏壍).matches, () => false);
}
