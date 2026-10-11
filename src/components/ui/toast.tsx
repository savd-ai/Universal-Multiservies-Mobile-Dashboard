"use client";
import { create } from "zustand";
interface ToastItem {
    id: number;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    tone?: "default" | "warn" | "crit";
}
interface ToastState {
    items: ToastItem[];
    push: (磅壍: Omit<ToastItem, "id">, 鞴壍?: number) => void;
    dismiss: (撣壍: number) => void;
}
let 莒壍 = 0;
export const useToasts = create<ToastState>((傁壍, 潰壍) => ({
    items: [],
    push: (蹟壍, 孎壍 = 2400) => {
        const 稽壍 = ++莒壍;
        傁壍({ items: [...潰壍().items.slice(-2), { ...蹟壍, id: 稽壍 }] });
        setTimeout(() => 潰壍().dismiss(稽壍), 蹟壍.action ? Math.max(孎壍, 5000) : 孎壍);
    },
    dismiss: (餬壍) => 傁壍({ items: 潰壍().items.filter((昛壍) => 昛壍.id !== 餬壍) }),
}));
export function toast(蔊壍: string, 凹壍: {
    action?: ToastItem["action"];
    tone?: ToastItem["tone"];
    ms?: number;
} = {}): void {
    useToasts.getState().push({ message: 蔊壍, action: 凹壍.action, tone: 凹壍.tone }, 凹壍.ms);
}
export function Toaster() {
    const 烨壍 = useToasts((迗壍) => 迗壍.items);
    const 峆壍 = useToasts((箵壍) => 箵壍.dismiss);
    return (<div className="pointer-events-none fixed bottom-7 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite" role="status">
      {烨壍.map((骤壍) => (<div key={骤壍.id} className="pointer-events-auto flex items-center gap-2.5 rounded-pill border border-teal/30 bg-surface px-5 py-3 text-[13px] text-fg shadow-toast animate-fade-up-fast">
          <span className="size-[7px] rounded-full" style={{ background: 骤壍.tone === "crit" ? "var(--crit)" : 骤壍.tone === "warn" ? "var(--warn)" : "var(--accent)" }} aria-hidden/>
          <span>{骤壍.message}</span>
          {骤壍.action ? (<button type="button" className="ml-1 text-accent hover:opacity-85" onClick={() => {
                    骤壍.action?.onClick();
                    峆壍(骤壍.id);
                }}>
              {骤壍.action.label}
            </button>) : null}
        </div>))}
    </div>);
}
