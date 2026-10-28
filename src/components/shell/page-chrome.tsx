"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eyebrow, Headline, MetaLine } from "@/components/brand/brand";
import { SectionTabs } from "@/components/ui/tabs";
import { useCan } from "@/lib/api/auth";
import { useStatus } from "@/lib/api/hooks";
import { formatLong } from "@/lib/domain/dates";
import { NAV, navFor, navIndex } from "./nav-config";
export function BlankBanner() {
    const status = useStatus();
    const can = useCan();
    if (!status.data || status.data.mode === "live")
        return null;
    return (<div className="no-print mx-4 mt-5 flex flex-wrap items-center gap-3.5 rounded-mini border border-teal/30 bg-teal/6 px-[18px] py-3 sm:mx-9" role="note">
      <span className="rounded-pill bg-accent px-2.5 py-[3px] font-mono text-micro tracking-eyebrow text-on-accent uppercase">{status.data.reason?.code === "demo" ? "Demo data" : "No live data"}</span>
      <span className="min-w-[240px] flex-1 text-[13px] leading-normal text-muted">{status.data.reasonText}</span>
      {can("system.manage") ? (<Link href="/data-source" className="text-[13px]">
          Connect live data →
        </Link>) : null}
    </div>);
}
interface PageHeaderProps {
    headline?: string;
    eyebrow?: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    tabs?: boolean;
    children?: React.ReactNode;
}
export function PageHeader({ headline, eyebrow, description, actions, tabs = true, children }: PageHeaderProps) {
    const pathname = usePathname();
    const can = useCan();
    const nav = navFor(pathname);
    const visibleTabs = nav?.tabs?.filter((t) => !t.permission || can(t.permission));
    const idx = nav ? String(navIndex(nav.key)).padStart(2, "0") : "";
    return (<div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex min-w-[280px] flex-1 flex-col gap-3">
          <Eyebrow>{`${idx} · ${eyebrow ?? nav?.eyebrow ?? ""}`}</Eyebrow>
          <Headline text={headline ?? nav?.headline ?? ""}/>
          {(description ?? nav?.description) ? <p className="m-0 max-w-[60ch] text-[15px] leading-relaxed text-muted">{description ?? nav?.description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
      {tabs && visibleTabs && visibleTabs.length > 1 ? <SectionTabs tabs={visibleTabs}/> : null}
      {children}
    </div>);
}
export function PageFooter() {
    const pathname = usePathname();
    const status = useStatus();
    const nav = navFor(pathname);
    const synced = status.data ? `${status.data.reason?.code === "demo" ? "demo data" : status.data.mode !== "live" ? "no live data" : "live"} · data through ${formatLong(status.data.dataThrough)}` : "…";
    return <MetaLine className="no-print mt-4" left="SAVD.AI · Ads intelligence · read-only" right={`Synced ${synced}`} index={nav ? navIndex(nav.key) : undefined} total={NAV.length}/>;
}
