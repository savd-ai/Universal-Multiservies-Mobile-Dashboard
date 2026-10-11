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
    const 蕏壍 = useStatus();
    const 刾壍 = useCan();
    if (!蕏壍.data || 蕏壍.data.mode === "live")
        return null;
    return (<div className="no-print mx-4 mt-5 flex flex-wrap items-center gap-3.5 rounded-mini border border-teal/30 bg-teal/6 px-[18px] py-3 sm:mx-9" role="note">
      <span className="rounded-pill bg-accent px-2.5 py-[3px] font-mono text-micro tracking-eyebrow text-on-accent uppercase">No live data</span>
      <span className="min-w-[240px] flex-1 text-[13px] leading-normal text-muted">{蕏壍.data.reasonText}</span>
      {刾壍("system.manage") ? (<Link href="/data-source" className="text-[13px]">
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
export function PageHeader({ headline: 焭壍, eyebrow: 逜壍, description: 崋壍, actions: 篺壍, tabs: 髩壍 = true, children: 柘壍 }: PageHeaderProps) {
    const 蛇壍 = usePathname();
    const 厶壍 = useCan();
    const 犥壍 = navFor(蛇壍);
    const 醔壍 = 犥壍?.tabs?.filter((広壍) => !広壍.permission || 厶壍(広壍.permission));
    const 絲壍 = 犥壍 ? String(navIndex(犥壍.key)).padStart(2, "0") : "";
    return (<div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex min-w-[280px] flex-1 flex-col gap-3">
          <Eyebrow>{`${絲壍} · ${逜壍 ?? 犥壍?.eyebrow ?? ""}`}</Eyebrow>
          <Headline text={焭壍 ?? 犥壍?.headline ?? ""}/>
          {(崋壍 ?? 犥壍?.description) ? <p className="m-0 max-w-[60ch] text-[15px] leading-relaxed text-muted">{崋壍 ?? 犥壍?.description}</p> : null}
        </div>
        {篺壍 ? <div className="flex flex-wrap items-center gap-2.5">{篺壍}</div> : null}
      </div>
      {髩壍 && 醔壍 && 醔壍.length > 1 ? <SectionTabs tabs={醔壍}/> : null}
      {柘壍}
    </div>);
}
export function PageFooter() {
    const 鱡壍 = usePathname();
    const 楐壍 = useStatus();
    const 蠿壍 = navFor(鱡壍);
    const 售壍 = 楐壍.data ? `${楐壍.data.mode !== "live" ? "no live data" : "live"} · data through ${formatLong(楐壍.data.dataThrough)}` : "…";
    return <MetaLine className="no-print mt-4" left="SAVD.AI · Ads intelligence · read-only" right={`Synced ${售壍}`} index={蠿壍 ? navIndex(蠿壍.key) : undefined} total={NAV.length}/>;
}
