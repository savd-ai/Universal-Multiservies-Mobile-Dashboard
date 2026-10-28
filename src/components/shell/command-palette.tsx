"use client";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/lib/api/auth";
import { request } from "@/lib/api/client";
import { useAccountId, useDashboards } from "@/lib/api/hooks";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/stores/ui";
import { NAV } from "./nav-config";
import { useOpenSignals } from "./notifications";
const groupCls = "px-1 pb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:tracking-label [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase";
const itemCls = "flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-[13px] text-fg data-[selected=true]:bg-fill";
export function CommandPalette() {
    const open = useUi((s) => s.paletteOpen);
    const setOpen = useUi((s) => s.setPalette);
    const setShortcuts = useUi((s) => s.setShortcuts);
    const router = useRouter();
    const { toggle } = useTheme();
    const [search, setSearch] = useState("");
    const acct = useAccountId();
    const can = useCan();
    const dashboards = useDashboards();
    const campaigns = useQuery({
        queryKey: ["acct", acct, "palette-campaigns"],
        queryFn: () => request<{
            rows: {
                campaign: string;
                campaign_id: string;
            }[];
        }>("/api/query", { body: { metrics: ["cost"], dimensions: ["campaign"], dateRange: { preset: "last_30d" } } }).then((r) => r.rows),
        enabled: open && !!acct,
        staleTime: 5 * 60000,
    });
    const signals = useOpenSignals();
    const go = (href: string) => {
        setOpen(false);
        setSearch("");
        router.push(href);
    };
    return (<Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(8,9,10,0.55)]"/>
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-[60] w-[min(620px,92vw)] -translate-x-1/2 overflow-hidden rounded-card border border-tone/12 bg-surface text-fg shadow-modal outline-none animate-fade-up-fast">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search pages, dashboards, campaigns and actions</Dialog.Description>
          <Command label="Command palette" loop>
            <Command.Input value={search} onValueChange={setSearch} placeholder="Search pages, campaigns, actions…" className="w-full border-b border-line bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-faint"/>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-4 py-6 text-center text-[13px] text-muted-3">No matches.</Command.Empty>
              <Command.Group heading="Pages" className={groupCls}>
                {NAV.flatMap((n, i) => (n.permission && !can(n.permission) ? [] : [
            <Command.Item key={n.href} value={`${n.label} page`} onSelect={() => go(n.href)} className={itemCls}>
                    <span>{n.label}</span>
                    {i < 9 ? <span className="font-mono text-micro text-faint">g {i + 1}</span> : null}
                  </Command.Item>,
            ...(n.tabs ?? [])
                .filter((t) => t.href !== n.href && (!t.permission || can(t.permission)))
                .map((t) => (<Command.Item key={t.href} value={`${n.label} ${t.label}`} onSelect={() => go(t.href)} className={itemCls}>
                        <span>
                          {n.label} <span className="text-faint">›</span> {t.label}
                        </span>
                      </Command.Item>)),
        ]))}
              </Command.Group>
              {dashboards.data?.length ? (<Command.Group heading="Dashboards" className={groupCls}>
                  {dashboards.data.map((d) => (<Command.Item key={d.id} value={`dashboard ${d.name}`} onSelect={() => go(d.isDefault ? "/overview" : `/overview/${d.id}`)} className={itemCls}>
                      {d.name}
                    </Command.Item>))}
                </Command.Group>) : null}
              {signals.data?.filter((x) => x.status === "open").length ? (<Command.Group heading="Open signals" className={groupCls}>
                  {signals.data
                .filter((x) => x.status === "open")
                .slice(0, 8)
                .map((x) => (<Command.Item key={x.id} value={`signal ${x.title} ${x.entity.name} ${x.severity}`} onSelect={() => go(`/anomalies?focus=${encodeURIComponent(x.id)}`)} className={itemCls}>
                        <span className="min-w-0 truncate">
                          {x.title} <span className="text-faint">· {x.entity.name}</span>
                        </span>
                        <span className={`font-mono text-micro uppercase ${x.severity === "critical" ? "text-crit" : x.severity === "warning" ? "text-warn" : "text-accent"}`}>{x.severity === "info" ? "opportunity" : x.severity}</span>
                      </Command.Item>))}
                </Command.Group>) : null}
              {campaigns.data?.length ? (<Command.Group heading="Campaigns" className={groupCls}>
                  {campaigns.data.map((c) => (<Command.Item key={c.campaign_id} value={`campaign ${c.campaign}`} onSelect={() => go(`/campaigns/${c.campaign_id}`)} className={itemCls}>
                      {c.campaign}
                    </Command.Item>))}
                </Command.Group>) : null}
              <Command.Group heading="Actions" className={groupCls}>
                <Command.Item value="toggle theme dark light" onSelect={() => { toggle(); setOpen(false); }} className={itemCls}>
                  <span>Toggle light / dark</span>
                  <span className="font-mono text-micro text-faint">t</span>
                </Command.Item>
                <Command.Item value="new dashboard create" onSelect={() => go("/overview?new=1")} className={itemCls}>
                  New dashboard from template
                </Command.Item>
                <Command.Item value="keyboard shortcuts help" onSelect={() => { setOpen(false); setShortcuts(true); }} className={itemCls}>
                  <span>Keyboard shortcuts</span>
                  <span className="font-mono text-micro text-faint">?</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>);
}
