"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { Popover } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
const 卢壍 = "savd-gads-views";
interface View {
    name: string;
    path: string;
    query: string;
}
function 牑壍(): View[] {
    try {
        const 酀壍 = JSON.parse(localStorage.getItem(卢壍) ?? "[]") as unknown;
        return Array.isArray(酀壍) ? (酀壍 as View[]).filter((帯壍) => 帯壍 && typeof 帯壍.name === "string" && typeof 帯壍.query === "string") : [];
    }
    catch {
        return [];
    }
}
function 紞壍(鰍壍: View[]): void {
    try {
        localStorage.setItem(卢壍, JSON.stringify(鰍壍.slice(0, 30)));
        window.dispatchEvent(new Event("savd-views"));
    }
    catch {
        toast("Couldn't save the view in this browser", { tone: "warn" });
    }
}
let 棼壍: {
    raw: string | null;
    views: View[];
} = { raw: null, views: [] };
function 蟫壍(): View[] {
    let 哚壍: string | null = null;
    try {
        哚壍 = localStorage.getItem(卢壍);
    }
    catch {
        哚壍 = null;
    }
    if (哚壍 !== 棼壍.raw)
        棼壍 = { raw: 哚壍, views: 牑壍() };
    return 棼壍.views;
}
const 珉壍: View[] = [];
export function SavedViews() {
    const 銸壍 = useRouter();
    const 徧壍 = usePathname();
    const 纖壍 = useSearchParams();
    const [鶅壍, 橴壍] = useState("");
    const 襣壍 = useSyncExternalStore((噒壍) => {
        window.addEventListener("savd-views", 噒壍);
        window.addEventListener("storage", 噒壍);
        return () => {
            window.removeEventListener("savd-views", 噒壍);
            window.removeEventListener("storage", 噒壍);
        };
    }, 蟫壍, () => 珉壍);
    const 畁壍 = 襣壍.filter((鐰壍) => 鐰壍.path === 徧壍);
    const 感壍 = 纖壍.toString();
    const 耎壍 = () => {
        const 黽壍 = 鶅壍.trim().slice(0, 40);
        if (!黽壍)
            return;
        紞壍([...襣壍.filter((毬壍) => !(毬壍.path === 徧壍 && 毬壍.name === 黽壍)), { name: 黽壍, path: 徧壍, query: 感壍 }]);
        橴壍("");
        toast(`Saved view “${黽壍}”`);
    };
    return (<Popover align="end" trigger={<button type="button" className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3.5 py-1.5 text-xs whitespace-nowrap text-muted transition-colors hover:border-tone/25 hover:text-fg">
          Views{畁壍.length ? <span className="font-mono text-meta text-faint">{畁壍.length}</span> : null}
          <span aria-hidden className="text-faint">
            ▾
          </span>
        </button>}>
      <div className="flex w-72 flex-col gap-2 p-1.5">
        <span className="label-mono px-1 pt-1">Saved views</span>
        {畁壍.length === 0 ? <span className="px-1 text-xs text-muted-3">Save the current filters to come back to them in one click.</span> : null}
        {畁壍.map((諛壍) => (<div key={諛壍.name} className="flex items-center gap-2 rounded-[8px] px-1 hover:bg-fill">
            <button type="button" onClick={() => 銸壍.replace(諛壍.query ? `${徧壍}?${諛壍.query}` : 徧壍)} className={`min-w-0 flex-1 truncate py-1.5 text-left text-[13px] ${諛壍.query === 感壍 ? "font-semibold text-accent" : "text-fg"}`}>
              {諛壍.name}
            </button>
            <button type="button" aria-label={`Delete view ${諛壍.name}`} onClick={() => 紞壍(襣壍.filter((埊壍) => !(埊壍.path === 諛壍.path && 埊壍.name === 諛壍.name)))} className="grid size-6 place-items-center rounded-full text-muted-3 hover:bg-fill hover:text-fg">
              ×
            </button>
          </div>))}
        <form className="flex items-center gap-2 border-t border-line pt-2" onSubmit={(皹壍) => {
            皹壍.preventDefault();
            耎壍();
        }}>
          <Input value={鶅壍} onChange={(閨壍) => 橴壍(閨壍.target.value)} placeholder="Name this view" aria-label="View name" className="min-w-0 flex-1 py-1.5 text-[13px]" maxLength={40}/>
          <Button type="submit" variant="accent" size="xs" disabled={!鶅壍.trim()}>
            Save
          </Button>
        </form>
      </div>
    </Popover>);
}
