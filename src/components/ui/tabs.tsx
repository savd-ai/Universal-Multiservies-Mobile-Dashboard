"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "./cn";
export function useActiveTabInView(key: unknown) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const row = ref.current;
        const active = row?.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
        if (!row || !active || row.scrollWidth <= row.clientWidth)
            return;
        row.scrollLeft = Math.max(0, active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2);
    }, [key]);
    return ref;
}
export interface TabLink {
    href: string;
    label: React.ReactNode;
    count?: number;
    exact?: boolean;
}
export function SectionTabs({ tabs, className }: {
    tabs: TabLink[];
    className?: string;
}) {
    const pathname = usePathname();
    const row = useActiveTabInView(pathname);
    return (<nav ref={row} aria-label="Sections" className={cn("tab-row gap-0.5 self-start rounded-pill border border-line bg-fill p-[3px]", className)}>
      {tabs.map((t) => {
            const on = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
            return (<Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cn("flex items-center gap-2 rounded-pill px-4 py-[7px] text-[13px] transition-colors", on ? "bg-accent text-on-accent hover:opacity-100" : "text-muted hover:text-fg hover:opacity-100")}>
            {t.label}
            {t.count !== undefined && t.count > 0 ? <span className={cn("font-mono text-micro", on ? "text-on-accent" : "text-faint")}>{t.count}</span> : null}
          </Link>);
        })}
    </nav>);
}
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
    tabs: {
        value: T;
        label: React.ReactNode;
    }[];
    value: T;
    onChange: (v: T) => void;
    className?: string;
}) {
    const row = useActiveTabInView(value);
    return (<div ref={row} role="tablist" className={cn("tab-row gap-1 shadow-[inset_0_-1px_0_var(--color-line)]", className)}>
      {tabs.map((t) => (<button key={t.value} type="button" role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)} className={cn("border-b-2 px-3 py-2.5 text-[13px] transition-colors", t.value === value ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg")}>
          {t.label}
        </button>))}
    </div>);
}
