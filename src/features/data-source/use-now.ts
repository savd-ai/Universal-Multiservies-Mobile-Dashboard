"use client";
import { useSyncExternalStore } from "react";
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    if (!timer) {
        now = Date.now();
        timer = setInterval(() => {
            now = Date.now();
            for (const l of listeners)
                l();
        }, 30000);
    }
    return () => {
        listeners.delete(cb);
        if (!listeners.size && timer) {
            clearInterval(timer);
            timer = null;
        }
    };
}
const getSnapshot = (): number | null => (now ||= Date.now());
const getServerSnapshot = (): number | null => null;
export function useNow(): number | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
