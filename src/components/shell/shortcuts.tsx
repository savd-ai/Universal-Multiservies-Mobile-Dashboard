"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Modal } from "@/components/ui/overlays";
import { Kbd } from "@/components/ui/status";
import { useCan } from "@/lib/api/auth";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/stores/ui";
import { NAV } from "./nav-config";
const SHORTCUTS: [
    string,
    string
][] = [
    ["⌘ K", "Command palette"],
    ["g 1 … g 9, g 0", "Go to page 01–09, 10"],
    ["e", "Customize the current dashboard"],
    ["r", "Refresh data"],
    ["t", "Toggle light / dark"],
    ["?", "This help"],
    ["Esc", "Close overlay · clear cross-filters"],
];
function isTyping(el: EventTarget | null): boolean {
    const t = el as HTMLElement | null;
    if (!t)
        return false;
    return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.getAttribute("role") === "textbox";
}
export function useGlobalShortcuts(): void {
    const router = useRouter();
    const qc = useQueryClient();
    const { toggle } = useTheme();
    const can = useCan();
    const pendingG = useRef(0);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            const ui = useUi.getState();
            if (mod && e.key.toLowerCase() === "k") {
                e.preventDefault();
                ui.setPalette(!ui.paletteOpen);
                return;
            }
            if (mod || e.altKey || isTyping(e.target))
                return;
            if (pendingG.current && Date.now() - pendingG.current < 1200 && /^[0-9]$/.test(e.key)) {
                const n = NAV[e.key === "0" ? 9 : Number(e.key) - 1];
                pendingG.current = 0;
                if (n && (!n.permission || can(n.permission)))
                    router.push(n.href);
                return;
            }
            pendingG.current = 0;
            if (e.key === "g")
                pendingG.current = Date.now();
            else if (e.key === "?")
                ui.setShortcuts(true);
            else if (e.key === "t")
                toggle();
            else if (e.key === "r")
                void qc.invalidateQueries();
            else if (e.key === "e")
                window.dispatchEvent(new CustomEvent("savd:toggle-edit"));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router, qc, toggle, can]);
}
export function ShortcutsDialog() {
    const open = useUi((s) => s.shortcutsOpen);
    const setOpen = useUi((s) => s.setShortcuts);
    return (<Modal open={open} onOpenChange={setOpen} eyebrow="Keyboard" title="Shortcuts" width={420}>
      <div className="flex flex-col">
        {SHORTCUTS.map(([k, label]) => (<div key={k} className="flex items-center justify-between border-b border-line-soft py-2.5 text-[13px]">
            <span className="text-muted">{label}</span>
            <span className="flex gap-1">
              {k.split(" ").map((p, i) => (<Kbd key={i}>{p}</Kbd>))}
            </span>
          </div>))}
      </div>
    </Modal>);
}
