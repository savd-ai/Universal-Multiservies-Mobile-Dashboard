"use client";
import Link from "next/link";
import { ThemeSwitch } from "./top-bar";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";
import { Tooltip } from "@/components/ui/overlays";
import { useCan } from "@/lib/api/auth";
import { useStatus } from "@/lib/api/hooks";
import { useNavBadges } from "./use-nav-badges";
import { NAV, navIndex } from "./nav-config";
export function Sidebar({ rail = false, onNavigate }: {
    rail?: boolean;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const status = useStatus();
    const badges = useNavBadges();
    const can = useCan();
    const demo = status.data?.mode !== "live";
    return (<aside className={cn("sticky top-0 flex h-dvh flex-col gap-7 border-r border-line bg-deep py-6", rail ? "items-center px-2" : "px-4")}>
      <div className={cn("flex flex-col gap-2.5", rail ? "items-center" : "px-2.5")}>
        <Link href="/overview" onClick={onNavigate} className="hover:opacity-100" aria-label="SAVD Ads Intelligence — Overview">
          <Logo size={22}/>
        </Link>
        {!rail ? <div className="font-mono text-micro tracking-eyebrow text-faint uppercase">Ads Intelligence · v2.4</div> : null}
      </div>
      <nav aria-label="Primary" className="flex w-full flex-col gap-0.5">
        {NAV.filter((n) => !n.permission || can(n.permission)).map((n) => {
            const on = pathname === n.href || pathname.startsWith(`${n.href}/`);
            const badge = n.badge ? badges[n.badge] : undefined;
            const idx = String(navIndex(n.key)).padStart(2, "0");
            const item = (<Link key={n.key} href={n.href} onClick={onNavigate} aria-current={on ? "page" : undefined} className={cn("relative flex items-center gap-3 rounded-mini px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-100", on ? "bg-teal/10 text-fg" : "text-muted hover:bg-fill hover:text-fg", rail && "justify-center px-0")}>
              <span className={cn("font-mono text-meta", on ? "text-accent" : "text-faint")}>{idx}</span>
              {!rail ? <span className="flex-1">{n.label}</span> : null}
              {badge && badge.count > 0 ? (rail ? (<span className="absolute top-1.5 right-1.5 size-2 rounded-full" style={{ background: badge.critical ? "var(--crit)" : "var(--accent)" }} aria-label={`${badge.count} items`}/>) : (<span className={cn("rounded-pill px-2 py-0.5 font-mono text-micro", badge.critical ? "bg-crit-t text-crit" : "bg-teal-t text-accent")}>{badge.count}</span>)) : null}
            </Link>);
            return rail ? (<Tooltip key={n.key} content={n.label} side="right">
              {item}
            </Tooltip>) : (item);
        })}
      </nav>
      {!rail ? (<div className="mt-auto flex flex-col gap-3 rounded-mini border border-line bg-fill p-4">
          <div className="flex items-center gap-2">
            <span className="size-[7px] rounded-full" style={{ background: demo ? "var(--warn)" : "var(--accent)" }} aria-hidden/>
            <span className="font-mono text-meta tracking-meta text-fg uppercase">{status.isLoading ? "Checking…" : status.data?.reason?.code === "demo" ? "Demo data" : demo ? "No live data" : "Live"}</span>
          </div>
          <div className="text-xs leading-normal text-muted-3">
            {status.isLoading
                ? "Checking credentials…"
                : demo
                    ? status.data?.reason?.code === "demo"
                        ? "Generated sample accounts · not from Google Ads."
                        : status.data?.reason?.code === "missing_keys"
                        ? `${status.data.googleAds.missingKeys.length} required .env keys missing.`
                        : status.data?.reason?.code === "no_env"
                            ? "No Google Ads credentials in .env."
                            : "Google Ads API unreachable."
                    : "Google Ads API connected · read-only."}
          </div>
          {can("system.manage") ? (<Link href="/data-source" onClick={onNavigate} className="text-xs text-accent">
              Configure .env →
            </Link>) : null}
          {onNavigate ? (<div className="border-t border-line pt-3 sm:hidden">
              <ThemeSwitch label/>
            </div>) : null}
        </div>) : (<span className="mt-auto size-2 rounded-full" style={{ background: demo ? "var(--warn)" : "var(--accent)" }} title={demo ? "No live data" : "Live"}/>)}
    </aside>);
}
