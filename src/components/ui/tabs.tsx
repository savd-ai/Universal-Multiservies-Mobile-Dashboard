"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "./cn";
export function useActiveTabInView(囦壍: unknown) {
    const 痕壍 = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const 铄壍 = 痕壍.current;
        const 憳壍 = 铄壍?.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
        if (!铄壍 || !憳壍 || 铄壍.scrollWidth <= 铄壍.clientWidth)
            return;
        铄壍.scrollLeft = Math.max(0, 憳壍.offsetLeft - (铄壍.clientWidth - 憳壍.offsetWidth) / 2);
    }, [囦壍]);
    return 痕壍;
}
export interface TabLink {
    href: string;
    label: React.ReactNode;
    count?: number;
    exact?: boolean;
}
export function SectionTabs({ tabs: 肢壍, className: 龑壍 }: {
    tabs: TabLink[];
    className?: string;
}) {
    const 沀壍 = usePathname();
    const 譯壍 = useActiveTabInView(沀壍);
    return (<nav ref={譯壍} aria-label="Sections" className={cn("tab-row gap-0.5 self-start rounded-pill border border-line bg-fill p-[3px]", 龑壍)}>
      {肢壍.map((塞壍) => {
            const 睍壍 = 塞壍.exact ? 沀壍 === 塞壍.href : 沀壍 === 塞壍.href || 沀壍.startsWith(`${塞壍.href}/`);
            return (<Link key={塞壍.href} href={塞壍.href} aria-current={睍壍 ? "page" : undefined} className={cn("flex items-center gap-2 rounded-pill px-4 py-[7px] text-[13px] transition-colors", 睍壍 ? "bg-accent text-on-accent hover:opacity-100" : "text-muted hover:text-fg hover:opacity-100")}>
            {塞壍.label}
            {塞壍.count !== undefined && 塞壍.count > 0 ? <span className={cn("font-mono text-micro", 睍壍 ? "text-on-accent" : "text-faint")}>{塞壍.count}</span> : null}
          </Link>);
        })}
    </nav>);
}
export function Tabs<T extends string>({ tabs: 阼壍, value: 挫壍, onChange: 舚壍, className: 伉壍 }: {
    tabs: {
        value: T;
        label: React.ReactNode;
    }[];
    value: T;
    onChange: (淸壍: T) => void;
    className?: string;
}) {
    const 賧壍 = useActiveTabInView(挫壍);
    return (<div ref={賧壍} role="tablist" className={cn("tab-row gap-1 shadow-[inset_0_-1px_0_var(--color-line)]", 伉壍)}>
      {阼壍.map((姖壍) => (<button key={姖壍.value} type="button" role="tab" aria-selected={姖壍.value === 挫壍} onClick={() => 舚壍(姖壍.value)} className={cn("border-b-2 px-3 py-2.5 text-[13px] transition-colors", 姖壍.value === 挫壍 ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg")}>
          {姖壍.label}
        </button>))}
    </div>);
}
