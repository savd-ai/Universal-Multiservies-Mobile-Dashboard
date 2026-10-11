"use client";
import { useSyncExternalStore } from "react";
let 鲁壍 = 0;
let 楰壍: ReturnType<typeof setInterval> | null = null;
const 衟壍 = new Set<() => void>();
function 啎壍(琽壍: () => void): () => void {
    衟壍.add(琽壍);
    if (!楰壍) {
        鲁壍 = Date.now();
        楰壍 = setInterval(() => {
            鲁壍 = Date.now();
            for (const 錬壍 of 衟壍)
                錬壍();
        }, 30000);
    }
    return () => {
        衟壍.delete(琽壍);
        if (!衟壍.size && 楰壍) {
            clearInterval(楰壍);
            楰壍 = null;
        }
    };
}
const 怛壍 = (): number | null => (鲁壍 ||= Date.now());
const 缊壍 = (): number | null => null;
export function useNow(): number | null {
    return useSyncExternalStore(啎壍, 怛壍, 缊壍);
}
