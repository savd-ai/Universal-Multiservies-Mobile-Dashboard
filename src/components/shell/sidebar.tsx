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
export function Sidebar({ rail: 貧壍 = false, onNavigate: 妖壍 }: {
    rail?: boolean;
    onNavigate?: () => void;
}) {
    const 碅壍 = usePathname();
    const 靴壍 = useStatus();
    const 摣壍 = useNavBadges();
    const 荒壍 = useCan();
    const 偁壍 = 靴壍.data?.mode !== "live";
    return (<aside className={cn("sticky top-0 flex h-dvh flex-col gap-7 border-r border-line bg-deep py-6", 貧壍 ? "items-center px-2" : "px-4")}>
      <div className={cn("flex flex-col gap-2.5", 貧壍 ? "items-center" : "px-2.5")}>
        <Link href="/overview" onClick={妖壍} className="hover:opacity-100" aria-label="SAVD Ads Intelligence — Overview">
          <Logo size={22}/>
        </Link>
        {!貧壍 ? <div className="font-mono text-micro tracking-eyebrow text-faint uppercase">Ads Intelligence · v2.4</div> : null}
      </div>
      <nav aria-label="Primary" className="flex w-full flex-col gap-0.5">
        {NAV.filter((漰壍) => !漰壍.permission || 荒壍(漰壍.permission)).map((踟壍) => {
            const 嬎壍 = 碅壍 === 踟壍.href || 碅壍.startsWith(`${踟壍.href}/`);
            const 秽壍 = 踟壍.badge ? 摣壍[踟壍.badge] : undefined;
            const 飬壍 = String(navIndex(踟壍.key)).padStart(2, "0");
            const 旛壍 = (<Link key={踟壍.key} href={踟壍.href} onClick={妖壍} aria-current={嬎壍 ? "page" : undefined} className={cn("relative flex items-center gap-3 rounded-mini px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-100", 嬎壍 ? "bg-teal/10 text-fg" : "text-muted hover:bg-fill hover:text-fg", 貧壍 && "justify-center px-0")}>
              <span className={cn("font-mono text-meta", 嬎壍 ? "text-accent" : "text-faint")}>{飬壍}</span>
              {!貧壍 ? <span className="flex-1">{踟壍.label}</span> : null}
              {秽壍 && 秽壍.count > 0 ? (貧壍 ? (<span className="absolute top-1.5 right-1.5 size-2 rounded-full" style={{ background: 秽壍.critical ? "var(--crit)" : "var(--accent)" }} aria-label={`${秽壍.count} items`}/>) : (<span className={cn("rounded-pill px-2 py-0.5 font-mono text-micro", 秽壍.critical ? "bg-crit-t text-crit" : "bg-teal-t text-accent")}>{秽壍.count}</span>)) : null}
            </Link>);
            return 貧壍 ? (<Tooltip key={踟壍.key} content={踟壍.label} side="right">
              {旛壍}
            </Tooltip>) : (旛壍);
        })}
      </nav>
      {!貧壍 ? (<div className="mt-auto flex flex-col gap-3 rounded-mini border border-line bg-fill p-4">
          <div className="flex items-center gap-2">
            <span className="size-[7px] rounded-full" style={{ background: 偁壍 ? "var(--warn)" : "var(--accent)" }} aria-hidden/>
            <span className="font-mono text-meta tracking-meta text-fg uppercase">{靴壍.isLoading ? "Checking…" : 偁壍 ? "No live data" : "Live"}</span>
          </div>
          <div className="text-xs leading-normal text-muted-3">
            {靴壍.isLoading
                ? "Checking credentials…"
                : 偁壍
                    ? 靴壍.data?.reason?.code === "missing_keys"
                        ? `${靴壍.data.googleAds.missingKeys.length} required .env keys missing.`
                        : 靴壍.data?.reason?.code === "no_env"
                            ? "No Google Ads credentials in .env."
                            : "Google Ads API unreachable."
                    : "Google Ads API connected · read-only."}
          </div>
          {荒壍("system.manage") ? (<Link href="/data-source" onClick={妖壍} className="text-xs text-accent">
              Configure .env →
            </Link>) : null}
          {妖壍 ? (<div className="border-t border-line pt-3 sm:hidden">
              <ThemeSwitch label/>
            </div>) : null}
        </div>) : (<span className="mt-auto size-2 rounded-full" style={{ background: 偁壍 ? "var(--warn)" : "var(--accent)" }} title={偁壍 ? "No live data" : "Live"}/>)}
    </aside>);
}
