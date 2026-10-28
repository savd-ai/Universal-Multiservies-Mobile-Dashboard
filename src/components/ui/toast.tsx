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
    push: (t: Omit<ToastItem, "id">, ms?: number) => void;
    dismiss: (id: number) => void;
}
let seq = 0;
export const useToasts = create<ToastState>((value, second) => ({
    items: [],
    push: (t, ms = 2400) => {
        const id = ++seq;
        value({ items: [...second().items.slice(-2), { ...t, id }] });
        setTimeout(() => second().dismiss(id), t.action ? Math.max(ms, 5000) : ms);
    },
    dismiss: (id) => value({ items: second().items.filter((x) => x.id !== id) }),
}));
export function toast(message: string, opts: {
    action?: ToastItem["action"];
    tone?: ToastItem["tone"];
    ms?: number;
} = {}): void {
    useToasts.getState().push({ message, action: opts.action, tone: opts.tone }, opts.ms);
}
export function Toaster() {
    const items = useToasts((s) => s.items);
    const dismiss = useToasts((s) => s.dismiss);
    return (<div className="pointer-events-none fixed bottom-7 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite" role="status">
      {items.map((t) => (<div key={t.id} className="pointer-events-auto flex items-center gap-2.5 rounded-pill border border-teal/30 bg-surface px-5 py-3 text-[13px] text-fg shadow-toast animate-fade-up-fast">
          <span className="size-[7px] rounded-full" style={{ background: t.tone === "crit" ? "var(--crit)" : t.tone === "warn" ? "var(--warn)" : "var(--accent)" }} aria-hidden/>
          <span>{t.message}</span>
          {t.action ? (<button type="button" className="ml-1 text-accent hover:opacity-85" onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                }}>
              {t.action.label}
            </button>) : null}
        </div>))}
    </div>);
}
