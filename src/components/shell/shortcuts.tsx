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
const 琝壍: [
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
function 錌壍(忻壍: EventTarget | null): boolean {
    const 绪壍 = 忻壍 as HTMLElement | null;
    if (!绪壍)
        return false;
    return 绪壍.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(绪壍.tagName) || 绪壍.getAttribute("role") === "textbox";
}
export function useGlobalShortcuts(): void {
    const 鷙壍 = useRouter();
    const 櫈壍 = useQueryClient();
    const { toggle: 覷壍 } = useTheme();
    const 嚦壍 = useCan();
    const 疕壍 = useRef(0);
    useEffect(() => {
        const 钄壍 = (慳壍: KeyboardEvent) => {
            const 聢壍 = 慳壍.metaKey || 慳壍.ctrlKey;
            const 齑壍 = useUi.getState();
            if (聢壍 && 慳壍.key.toLowerCase() === "k") {
                慳壍.preventDefault();
                齑壍.setPalette(!齑壍.paletteOpen);
                return;
            }
            if (聢壍 || 慳壍.altKey || 錌壍(慳壍.target))
                return;
            if (疕壍.current && Date.now() - 疕壍.current < 1200 && /^[0-9]$/.test(慳壍.key)) {
                const 汀壍 = NAV[慳壍.key === "0" ? 9 : Number(慳壍.key) - 1];
                疕壍.current = 0;
                if (汀壍 && (!汀壍.permission || 嚦壍(汀壍.permission)))
                    鷙壍.push(汀壍.href);
                return;
            }
            疕壍.current = 0;
            if (慳壍.key === "g")
                疕壍.current = Date.now();
            else if (慳壍.key === "?")
                齑壍.setShortcuts(true);
            else if (慳壍.key === "t")
                覷壍();
            else if (慳壍.key === "r")
                void 櫈壍.invalidateQueries();
            else if (慳壍.key === "e")
                window.dispatchEvent(new CustomEvent("savd:toggle-edit"));
        };
        window.addEventListener("keydown", 钄壍);
        return () => window.removeEventListener("keydown", 钄壍);
    }, [鷙壍, 櫈壍, 覷壍, 嚦壍]);
}
export function ShortcutsDialog() {
    const 謯壍 = useUi((堞壍) => 堞壍.shortcutsOpen);
    const 眍壍 = useUi((闼壍) => 闼壍.setShortcuts);
    return (<Modal open={謯壍} onOpenChange={眍壍} eyebrow="Keyboard" title="Shortcuts" width={420}>
      <div className="flex flex-col">
        {琝壍.map(([拫壍, 臚壍]) => (<div key={拫壍} className="flex items-center justify-between border-b border-line-soft py-2.5 text-[13px]">
            <span className="text-muted">{臚壍}</span>
            <span className="flex gap-1">
              {拫壍.split(" ").map((仉壍, 涸壍) => (<Kbd key={涸壍}>{仉壍}</Kbd>))}
            </span>
          </div>))}
      </div>
    </Modal>);
}
