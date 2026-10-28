"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { Popover } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
const KEY = "savd-gads-views";
interface View {
    name: string;
    path: string;
    query: string;
}
function read(): View[] {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
        return Array.isArray(v) ? (v as View[]).filter((x) => x && typeof x.name === "string" && typeof x.query === "string") : [];
    }
    catch {
        return [];
    }
}
function write(views: View[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(views.slice(0, 30)));
        window.dispatchEvent(new Event("savd-views"));
    }
    catch {
        toast("Couldn't save the view in this browser", { tone: "warn" });
    }
}
let cache: {
    raw: string | null;
    views: View[];
} = { raw: null, views: [] };
function snapshot(): View[] {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(KEY);
    }
    catch {
        raw = null;
    }
    if (raw !== cache.raw)
        cache = { raw, views: read() };
    return cache.views;
}
const EMPTY: View[] = [];
export function SavedViews() {
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();
    const [name, setName] = useState("");
    const views = useSyncExternalStore((cb) => {
        window.addEventListener("savd-views", cb);
        window.addEventListener("storage", cb);
        return () => {
            window.removeEventListener("savd-views", cb);
            window.removeEventListener("storage", cb);
        };
    }, snapshot, () => EMPTY);
    const here = views.filter((v) => v.path === pathname);
    const query = search.toString();
    const save = () => {
        const n = name.trim().slice(0, 40);
        if (!n)
            return;
        write([...views.filter((v) => !(v.path === pathname && v.name === n)), { name: n, path: pathname, query }]);
        setName("");
        toast(`Saved view “${n}”`);
    };
    return (<Popover align="end" trigger={<button type="button" className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3.5 py-1.5 text-xs whitespace-nowrap text-muted transition-colors hover:border-tone/25 hover:text-fg">
          Views{here.length ? <span className="font-mono text-meta text-faint">{here.length}</span> : null}
          <span aria-hidden className="text-faint">
            ▾
          </span>
        </button>}>
      <div className="flex w-72 flex-col gap-2 p-1.5">
        <span className="label-mono px-1 pt-1">Saved views</span>
        {here.length === 0 ? <span className="px-1 text-xs text-muted-3">Save the current filters to come back to them in one click.</span> : null}
        {here.map((v) => (<div key={v.name} className="flex items-center gap-2 rounded-[8px] px-1 hover:bg-fill">
            <button type="button" onClick={() => router.replace(v.query ? `${pathname}?${v.query}` : pathname)} className={`min-w-0 flex-1 truncate py-1.5 text-left text-[13px] ${v.query === query ? "font-semibold text-accent" : "text-fg"}`}>
              {v.name}
            </button>
            <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => write(views.filter((x) => !(x.path === v.path && x.name === v.name)))} className="grid size-6 place-items-center rounded-full text-muted-3 hover:bg-fill hover:text-fg">
              ×
            </button>
          </div>))}
        <form className="flex items-center gap-2 border-t border-line pt-2" onSubmit={(e) => {
            e.preventDefault();
            save();
        }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this view" aria-label="View name" className="min-w-0 flex-1 py-1.5 text-[13px]" maxLength={40}/>
          <Button type="submit" variant="accent" size="xs" disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </div>
    </Popover>);
}
