"use client";
import { useCallback, useSyncExternalStore } from "react";
const EVENT = "savd:stored-pref";
const memory = new Map<string, string | null>();
function read(key: string): string | null {
    if (memory.has(key))
        return memory.get(key) ?? null;
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
export function useStoredPref(key: string): [
    string | null,
    (value: string | null) => void
] {
    const subscribe = useCallback((cb: () => void) => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== key)
                return;
            memory.delete(key);
            cb();
        };
        const onLocal = (e: Event) => {
            if ((e as CustomEvent<string>).detail === key)
                cb();
        };
        window.addEventListener("storage", onStorage);
        window.addEventListener(EVENT, onLocal);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener(EVENT, onLocal);
        };
    }, [key]);
    const value = useSyncExternalStore(subscribe, () => read(key), () => null);
    const callback = useCallback((next: string | null) => {
        memory.set(key, next);
        try {
            if (next === null)
                window.localStorage.removeItem(key);
            else
                window.localStorage.setItem(key, next);
        }
        catch {
        }
        window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    }, [key]);
    return [value, callback];
}
