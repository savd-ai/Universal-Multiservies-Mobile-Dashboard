"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Popover } from "@/components/ui/overlays";
import { Dot, SEVERITY_META } from "@/components/ui/status";
import { request } from "@/lib/api/client";
import { useAccountId } from "@/lib/api/hooks";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
export function useOpenSignals() {
    const acct = useAccountId();
    return useQuery({
        queryKey: ["acct", acct, "anomalies", "open-list"],
        queryFn: ({ signal }) => request<{
            signals: SignalView[];
        }>("/api/anomalies", { query: { status: "open" }, signal }).then((r) => r.signals ?? []),
        enabled: !!acct,
        staleTime: 60000,
        refetchInterval: 5 * 60000,
        retry: false,
    });
}
export function NotificationsButton() {
    const q = useOpenSignals();
    const [open, setOpen] = useState(false);
    const active = (q.data ?? []).filter((s) => s.status === "open" && s.severity !== "info");
    const critical = active.filter((s) => s.severity === "critical").length;
    const seen = useRef<Set<string>>(new Set());
    const [asked, setAsked] = useState<NotificationPermission | null>(null);
    const current = useSyncExternalStore(() => () => undefined, () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission), () => "default" as const);
    const permission = asked ?? current;
    useEffect(() => {
        if (permission !== "granted" || !q.data)
            return;
        for (const s of q.data) {
            if (s.severity !== "critical" || seen.current.has(s.id))
                continue;
            if (seen.current.size > 0)
                new Notification(`Critical: ${s.title}`, { body: s.entity.name, tag: s.id });
            seen.current.add(s.id);
        }
        if (seen.current.size === 0)
            q.data.forEach((s) => seen.current.add(s.id));
    }, [q.data, permission]);
    return (<Popover open={open} onOpenChange={setOpen} trigger={<button type="button" aria-label={`Alerts: ${active.length} open`} className={cn("flex items-center gap-2 rounded-pill border px-3 py-1.5 font-mono text-meta tracking-[0.08em] transition-colors", critical ? "border-crit/40 text-crit" : "border-line text-muted hover:text-fg")}>
          <span aria-hidden>●</span>
          <span className="hidden 2xl:inline">Alerts</span>
          <span>{active.length}</span>
        </button>}>
      <div className="flex w-[340px] flex-col gap-1 p-1">
        <div className="flex items-center justify-between px-2 pt-1.5 pb-2">
          <span className="label-mono">Open signals</span>
          <Link href="/anomalies" onClick={() => setOpen(false)} className="text-xs">
            All signals →
          </Link>
        </div>
        {active.length === 0 ? <div className="px-2 py-4 text-center text-[13px] text-muted-3">No open signals. Quiet is good.</div> : null}
        {active.slice(0, 6).map((s) => (<Link key={s.id} href={`/anomalies?focus=${encodeURIComponent(s.id)}`} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-[10px] px-2.5 py-2 text-fg hover:bg-fill hover:opacity-100">
            <Dot tone={SEVERITY_META[s.severity].tone} halo className="mt-1.5"/>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{s.title}</span>
              <span className="truncate text-xs text-muted-3">{s.entity.name}</span>
            </span>
          </Link>))}
        {permission !== "unsupported" && permission !== "granted" ? (<div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-2 pt-2.5 pb-1">
            <span className="text-xs text-muted-3">Get a browser notification for new critical signals.</span>
            <Button variant="ghost" size="xs" onClick={() => void Notification.requestPermission().then(setAsked)}>
              Enable
            </Button>
          </div>) : null}
      </div>
    </Popover>);
}
