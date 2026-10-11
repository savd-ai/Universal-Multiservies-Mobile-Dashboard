"use client";
import { useCallback, useSyncExternalStore } from "react";
const 頰壍 = "savd:stored-pref";
const 攟壍 = new Map<string, string | null>();
function 萎壍(僽壍: string): string | null {
    if (攟壍.has(僽壍))
        return 攟壍.get(僽壍) ?? null;
    try {
        return window.localStorage.getItem(僽壍);
    }
    catch {
        return null;
    }
}
export function useStoredPref(濬壍: string): [
    string | null,
    (軛壍: string | null) => void
] {
    const 寊壍 = useCallback((窹壍: () => void) => {
        const 馨壍 = (暗壍: StorageEvent) => {
            if (暗壍.key !== 濬壍)
                return;
            攟壍.delete(濬壍);
            窹壍();
        };
        const 薆壍 = (創壍: Event) => {
            if ((創壍 as CustomEvent<string>).detail === 濬壍)
                窹壍();
        };
        window.addEventListener("storage", 馨壍);
        window.addEventListener(頰壍, 薆壍);
        return () => {
            window.removeEventListener("storage", 馨壍);
            window.removeEventListener(頰壍, 薆壍);
        };
    }, [濬壍]);
    const 煤壍 = useSyncExternalStore(寊壍, () => 萎壍(濬壍), () => null);
    const 道壍 = useCallback((嵂壍: string | null) => {
        攟壍.set(濬壍, 嵂壍);
        try {
            if (嵂壍 === null)
                window.localStorage.removeItem(濬壍);
            else
                window.localStorage.setItem(濬壍, 嵂壍);
        }
        catch {
        }
        window.dispatchEvent(new CustomEvent(頰壍, { detail: 濬壍 }));
    }, [濬壍]);
    return [煤壍, 道壍];
}
