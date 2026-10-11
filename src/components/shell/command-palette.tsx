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
const 籿壍 = "px-1 pb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:tracking-label [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase";
const 魮壍 = "flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-[13px] text-fg data-[selected=true]:bg-fill";
export function CommandPalette() {
    const 桝壍 = useUi((蝌壍) => 蝌壍.paletteOpen);
    const 吻壍 = useUi((猪壍) => 猪壍.setPalette);
    const 鈙壍 = useUi((弈壍) => 弈壍.setShortcuts);
    const 緷壍 = useRouter();
    const { toggle: 鳦壍 } = useTheme();
    const [槕壍, 裄壍] = useState("");
    const 喳壍 = useAccountId();
    const 璢壍 = useCan();
    const 鎑壍 = useDashboards();
    const 悀壍 = useQuery({
        queryKey: ["acct", 喳壍, "palette-campaigns"],
        queryFn: () => request<{
            rows: {
                campaign: string;
                campaign_id: string;
            }[];
        }>("/api/query", { body: { metrics: ["cost"], dimensions: ["campaign"], dateRange: { preset: "last_30d" } } }).then((罯壍) => 罯壍.rows),
        enabled: 桝壍 && !!喳壍,
        staleTime: 5 * 60000,
    });
    const 鹞壍 = useOpenSignals();
    const 歍壍 = (証壍: string) => {
        吻壍(false);
        裄壍("");
        緷壍.push(証壍);
    };
    return (<Dialog.Root open={桝壍} onOpenChange={吻壍}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(8,9,10,0.55)]"/>
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-[60] w-[min(620px,92vw)] -translate-x-1/2 overflow-hidden rounded-card border border-tone/12 bg-surface text-fg shadow-modal outline-none animate-fade-up-fast">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search pages, dashboards, campaigns and actions</Dialog.Description>
          <Command label="Command palette" loop>
            <Command.Input value={槕壍} onValueChange={裄壍} placeholder="Search pages, campaigns, actions…" className="w-full border-b border-line bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-faint"/>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-4 py-6 text-center text-[13px] text-muted-3">No matches.</Command.Empty>
              <Command.Group heading="Pages" className={籿壍}>
                {NAV.flatMap((圫壍, 瘚壍) => (圫壍.permission && !璢壍(圫壍.permission) ? [] : [
            <Command.Item key={圫壍.href} value={`${圫壍.label} page`} onSelect={() => 歍壍(圫壍.href)} className={魮壍}>
                    <span>{圫壍.label}</span>
                    {瘚壍 < 9 ? <span className="font-mono text-micro text-faint">g {瘚壍 + 1}</span> : null}
                  </Command.Item>,
            ...(圫壍.tabs ?? [])
                .filter((锉壍) => 锉壍.href !== 圫壍.href && (!锉壍.permission || 璢壍(锉壍.permission)))
                .map((懸壍) => (<Command.Item key={懸壍.href} value={`${圫壍.label} ${懸壍.label}`} onSelect={() => 歍壍(懸壍.href)} className={魮壍}>
                        <span>
                          {圫壍.label} <span className="text-faint">›</span> {懸壍.label}
                        </span>
                      </Command.Item>)),
        ]))}
              </Command.Group>
              {鎑壍.data?.length ? (<Command.Group heading="Dashboards" className={籿壍}>
                  {鎑壍.data.map((胧壍) => (<Command.Item key={胧壍.id} value={`dashboard ${胧壍.name}`} onSelect={() => 歍壍(胧壍.isDefault ? "/overview" : `/overview/${胧壍.id}`)} className={魮壍}>
                      {胧壍.name}
                    </Command.Item>))}
                </Command.Group>) : null}
              {鹞壍.data?.filter((鿖壍) => 鿖壍.status === "open").length ? (<Command.Group heading="Open signals" className={籿壍}>
                  {鹞壍.data
                .filter((泅壍) => 泅壍.status === "open")
                .slice(0, 8)
                .map((讴壍) => (<Command.Item key={讴壍.id} value={`signal ${讴壍.title} ${讴壍.entity.name} ${讴壍.severity}`} onSelect={() => 歍壍(`/anomalies?focus=${encodeURIComponent(讴壍.id)}`)} className={魮壍}>
                        <span className="min-w-0 truncate">
                          {讴壍.title} <span className="text-faint">· {讴壍.entity.name}</span>
                        </span>
                        <span className={`font-mono text-micro uppercase ${讴壍.severity === "critical" ? "text-crit" : 讴壍.severity === "warning" ? "text-warn" : "text-accent"}`}>{讴壍.severity === "info" ? "opportunity" : 讴壍.severity}</span>
                      </Command.Item>))}
                </Command.Group>) : null}
              {悀壍.data?.length ? (<Command.Group heading="Campaigns" className={籿壍}>
                  {悀壍.data.map((墣壍) => (<Command.Item key={墣壍.campaign_id} value={`campaign ${墣壍.campaign}`} onSelect={() => 歍壍(`/campaigns/${墣壍.campaign_id}`)} className={魮壍}>
                      {墣壍.campaign}
                    </Command.Item>))}
                </Command.Group>) : null}
              <Command.Group heading="Actions" className={籿壍}>
                <Command.Item value="toggle theme dark light" onSelect={() => { 鳦壍(); 吻壍(false); }} className={魮壍}>
                  <span>Toggle light / dark</span>
                  <span className="font-mono text-micro text-faint">t</span>
                </Command.Item>
                <Command.Item value="new dashboard create" onSelect={() => 歍壍("/overview?new=1")} className={魮壍}>
                  New dashboard from template
                </Command.Item>
                <Command.Item value="keyboard shortcuts help" onSelect={() => { 吻壍(false); 鈙壍(true); }} className={魮壍}>
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
