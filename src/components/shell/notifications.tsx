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
    const 隁壍 = useAccountId();
    return useQuery({
        queryKey: ["acct", 隁壍, "anomalies", "open-list"],
        queryFn: ({ signal: 捰壍 }) => request<{
            signals: SignalView[];
        }>("/api/anomalies", { query: { status: "open" }, signal: 捰壍 }).then((艟壍) => 艟壍.signals ?? []),
        enabled: !!隁壍,
        staleTime: 60000,
        refetchInterval: 5 * 60000,
        retry: false,
    });
}
export function NotificationsButton() {
    const 低壍 = useOpenSignals();
    const [渽壍, 贬壍] = useState(false);
    const 娛壍 = (低壍.data ?? []).filter((礊壍) => 礊壍.status === "open" && 礊壍.severity !== "info");
    const 韹壍 = 娛壍.filter((擨壍) => 擨壍.severity === "critical").length;
    const 菗壍 = useRef<Set<string>>(new Set());
    const [僆壍, 澵壍] = useState<NotificationPermission | null>(null);
    const 躤壍 = useSyncExternalStore(() => () => undefined, () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission), () => "default" as const);
    const 宓壍 = 僆壍 ?? 躤壍;
    useEffect(() => {
        if (宓壍 !== "granted" || !低壍.data)
            return;
        for (const 窂壍 of 低壍.data) {
            if (窂壍.severity !== "critical" || 菗壍.current.has(窂壍.id))
                continue;
            if (菗壍.current.size > 0)
                new Notification(`Critical: ${窂壍.title}`, { body: 窂壍.entity.name, tag: 窂壍.id });
            菗壍.current.add(窂壍.id);
        }
        if (菗壍.current.size === 0)
            低壍.data.forEach((饱壍) => 菗壍.current.add(饱壍.id));
    }, [低壍.data, 宓壍]);
    return (<Popover open={渽壍} onOpenChange={贬壍} trigger={<button type="button" aria-label={`Alerts: ${娛壍.length} open`} className={cn("flex items-center gap-2 rounded-pill border px-3 py-1.5 font-mono text-meta tracking-[0.08em] transition-colors", 韹壍 ? "border-crit/40 text-crit" : "border-line text-muted hover:text-fg")}>
          <span aria-hidden>●</span>
          <span className="hidden 2xl:inline">Alerts</span>
          <span>{娛壍.length}</span>
        </button>}>
      <div className="flex w-[340px] flex-col gap-1 p-1">
        <div className="flex items-center justify-between px-2 pt-1.5 pb-2">
          <span className="label-mono">Open signals</span>
          <Link href="/anomalies" onClick={() => 贬壍(false)} className="text-xs">
            All signals →
          </Link>
        </div>
        {娛壍.length === 0 ? <div className="px-2 py-4 text-center text-[13px] text-muted-3">No open signals. Quiet is good.</div> : null}
        {娛壍.slice(0, 6).map((晠壍) => (<Link key={晠壍.id} href={`/anomalies?focus=${encodeURIComponent(晠壍.id)}`} onClick={() => 贬壍(false)} className="flex items-start gap-3 rounded-[10px] px-2.5 py-2 text-fg hover:bg-fill hover:opacity-100">
            <Dot tone={SEVERITY_META[晠壍.severity].tone} halo className="mt-1.5"/>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{晠壍.title}</span>
              <span className="truncate text-xs text-muted-3">{晠壍.entity.name}</span>
            </span>
          </Link>))}
        {宓壍 !== "unsupported" && 宓壍 !== "granted" ? (<div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-2 pt-2.5 pb-1">
            <span className="text-xs text-muted-3">Get a browser notification for new critical signals.</span>
            <Button variant="ghost" size="xs" onClick={() => void Notification.requestPermission().then(澵壍)}>
              Enable
            </Button>
          </div>) : null}
      </div>
    </Popover>);
}
