"use client";
import { useState } from "react";
import { Eyebrow, GradientCard, Headline, Logo, MetaLine, PullQuote, StatBlock, SystemDiagram } from "@/components/brand/brand";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Chip, Segmented, Slider, Switch } from "@/components/ui/controls";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState, ErrorState, InlineEmpty, Skeleton, SkeletonLines } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { ConfirmDialog, Drawer, Menu, Modal, Popover, Tooltip } from "@/components/ui/overlays";
import { AreaSpark, BandSpark, Sparkline } from "@/components/ui/spark";
import { CharCounter, DeltaText, Dot, Kbd, Meter, Pill, SeverityPill, StatusPill } from "@/components/ui/status";
import { Card, CardHeader, CodeBlock, DashedCard, MetaStat, MiniCard, StatCard, StatTile, TileGrid } from "@/components/ui/surfaces";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/lib/theme";
const 袰壍 = [12, 14, 13, 17, 16, 19, 18, 22, 21, 24, 23, 27, 26, 29];
function 喟壍({ title: 璎壍, children: 鍽壍 }: {
    title: string;
    children: React.ReactNode;
}) {
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={璎壍}/>
      {鍽壍}
    </Card>);
}
export function KitScreen() {
    const { theme: 恬壍, toggle: 罛壍 } = useTheme();
    const [鹊壍, 欹壍] = useState<"7" | "30" | "90">("30");
    const [訨壍, 圗壍] = useState(true);
    const [瘆壍, 铵壍] = useState(40);
    const [懤壍, 胓壍] = useState<"a" | "b">("a");
    const [鿂壍, 沱壍] = useState(false);
    const [讠壍, 墏壍] = useState(false);
    const [睾壍, 陭壍] = useState(false);
    const [捜壍, 艋壍] = useState<Set<string>>(new Set());
    return (<div className="min-h-dvh bg-page bg-glow px-8 py-8 text-fg">
      <header className="mb-8 flex flex-wrap items-end gap-6">
        <div className="flex flex-1 flex-col gap-3">
          <Eyebrow>00 · UI kit</Eyebrow>
          <Headline text="One spine, *every* component"/>
        </div>
        <Logo size={28}/>
        <Switch size="md" checked={恬壍 === "dark"} onChange={罛壍} label={恬壍 === "dark" ? "Dark" : "Light"} ariaLabel="Dark mode"/>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <喟壍 title="Buttons">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="brand">Save changes</Button>
            <Button variant="accent">Done</Button>
            <Button variant="outline">Customize dashboard</Button>
            <Button variant="ghost">Reset layout</Button>
            <Button variant="link">Plan →</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="outline" loading>
              Saving
            </Button>
            <IconButton label="Move left">←</IconButton>
            <IconButton label="Close" tone="accent">
              ×
            </IconButton>
          </div>
        </喟壍>
        <喟壍 title="Controls">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active>All</Chip>
            <Chip>Search</Chip>
            <Chip dot="var(--crit)" count={3}>
              Critical
            </Chip>
            <Chip tone="add">+ Budget pacing</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Segmented ariaLabel="Range" value={鹊壍} onChange={欹壍} options={[{ value: "7", label: "7D" }, { value: "30", label: "30D" }, { value: "90", label: "90D" }]}/>
            <Switch checked={訨壍} onChange={圗壍} label="Spend"/>
            <Checkbox checked={訨壍} onChange={圗壍} ariaLabel="Check"/>
          </div>
          <Slider value={瘆壍} onChange={铵壍} min={0} max={100} aria-label="Sensitivity"/>
        </喟壍>
        <喟壍 title="Inputs">
          <Input placeholder="Search campaigns…"/>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly test budget">{(伺壍) => <Input id={伺壍} variant="field" defaultValue="3000"/>}</Field>
            <Field label="Goal">
              {(温壍) => (<Select id={温壍} defaultValue="conv">
                  <option value="conv">Scale conversions</option>
                  <option value="cpa">Lower CPA</option>
                </Select>)}
            </Field>
          </div>
          <Field label="Context" hint="Shown above the notes." aside={<CharCounter length={24} max={30}/>}>
            {(贘壍) => <Textarea id={贘壍} defaultValue="Running shoes, US-first."/>}
          </Field>
        </喟壍>
        <喟壍 title="Status">
          <div className="flex flex-wrap items-center gap-2.5">
            <Dot tone="crit" halo/>
            <Dot tone="warn" halo/>
            <Dot tone="accent" halo/>
            <SeverityPill severity="critical"/>
            <SeverityPill severity="warning"/>
            <SeverityPill severity="info"/>
            <Pill tone="accent" solid>
              No live data
            </Pill>
            <StatusPill on>Enabled</StatusPill>
            <StatusPill on={false}>Paused</StatusPill>
            <Kbd>⌘K</Kbd>
            <DeltaText pct="+12.4%" sentiment="good"/>
            <DeltaText pct="−8.1%" sentiment="bad"/>
          </div>
          <Meter value={0.62} projected={0.94} marker={0.9} label="Pacing"/>
          <Meter value={0.8} projected={1} marker={0.9} tone="warn" label="Overpacing"/>
        </喟壍>
        <喟壍 title="Stats">
          <TileGrid>
            <StatTile label="Spend" value="$123.5K">
              <Sparkline values={袰壍}/>
            </StatTile>
            <StatTile label="CPA" value="$20.14">
              <Sparkline values={[...袰壍].reverse()} color="var(--crit)"/>
            </StatTile>
            <StatTile label="ROAS" value="4.80x">
              <Sparkline values={袰壍}/>
            </StatTile>
          </TileGrid>
          <div className="grid grid-cols-3 gap-3">
            <MetaStat label="MTD" value="$115.6K"/>
            <MetaStat label="Projected" value="$124.1K" tone="warn"/>
            <MetaStat label="Budget" value="$136.5K"/>
          </div>
          <StatCard label="Projected month-end" value="$124.1K" caption="$12.4K headroom" tone="accent"/>
        </喟壍>
        <喟壍 title="Sparks">
          <AreaSpark values={袰壍} refLine={20} gradientId="kit-area" height={110}/>
          <BandSpark values={袰壍} band={{ lo: 12, hi: 22 }} color="var(--crit)" height={90}/>
        </喟壍>
        <喟壍 title="Surfaces">
          <div className="grid grid-cols-2 gap-3">
            <MiniCard>Mini card</MiniCard>
            <DashedCard interactive>+ Connect another platform</DashedCard>
          </div>
          <Card accent>Accent card</Card>
          <CodeBlock>{`GOOGLE_ADS_CLIENT_ID=\nGOOGLE_ADS_CLIENT_SECRET=`}</CodeBlock>
        </喟壍>
        <喟壍 title="Brand">
          <StatBlock value="91%" caption="projected of budget"/>
          <PullQuote attribution="SAVD AI">Competitor Terms CPC nearly doubled — defend brand SERPs first.</PullQuote>
          <MetaLine left="SAVD.AI · Ads intelligence" right="Synced live" index={1} total={9}/>
          <GradientCard num="01" title="Brand defense" meta="Search · 82%">
            Protect high-intent clicks while competitors bid up your terms.
          </GradientCard>
          <SystemDiagram nodes={[{ num: "01", title: "Google Ads", caption: "read-only" }, { num: "02", title: "Alerts", caption: "webhooks" }, { num: "03", title: "Engine", caption: "query · anomalies" }]} result={{ title: "Dashboard", caption: "widgets · alerts" }}/>
        </喟壍>
        <喟壍 title="Feedback">
          <Skeleton height={16}/>
          <SkeletonLines lines={2}/>
          <InlineEmpty>No active signals at this sensitivity.</InlineEmpty>
          <ErrorState error={{ message: "The Google Ads API did not respond." }} onRetry={() => toast("Retrying…")}/>
          <EmptyState action={<Button variant="accent">Add widgets</Button>}>This dashboard is empty.</EmptyState>
        </喟壍>
        <喟壍 title="Overlays & tabs">
          <Tabs value={懤壍} onChange={胓壍} tabs={[{ value: "a", label: "Overview" }, { value: "b", label: "Keywords" }]}/>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={() => 沱壍(true)}>Modal</Button>
            <Button onClick={() => 墏壍(true)}>Drawer</Button>
            <Button onClick={() => 陭壍(true)}>Confirm</Button>
            <Button onClick={() => toast("Added “Brand defense” to plan", { action: { label: "Undo", onClick: () => undefined } })}>Toast</Button>
            <Popover trigger={<Button>Popover ▾</Button>}>
              <div className="w-56 p-3 text-[13px]">Popover content</div>
            </Popover>
            <Menu trigger={<Button>Menu ▾</Button>} items={[{ label: "Rename", onSelect: () => undefined }, { label: "Delete", danger: true, separatorBefore: true, onSelect: () => undefined }]}/>
            <Tooltip content="Tooltip text">
              <Button variant="ghost">Hover me</Button>
            </Tooltip>
          </div>
          <Modal open={鿂壍} onOpenChange={沱壍} eyebrow="Connect" title="Meta Ads" description="Credentials stay on the server." footer={<Button variant="accent" onClick={() => 沱壍(false)}>Connect</Button>}>
            <Field label="Access token">{(娇壍) => <Input id={娇壍} variant="field" placeholder="••••••••"/>}</Field>
          </Modal>
          <Drawer open={讠壍} onOpenChange={墏壍} eyebrow="Search" title="Brand — Core Terms">
            <p className="m-0 text-[13px] text-muted">Drawer body.</p>
          </Drawer>
          <ConfirmDialog open={睾壍} onOpenChange={陭壍} title="Delete dashboard?" description="This can't be undone." danger confirmLabel="Delete" onConfirm={() => 陭壍(false)}/>
        </喟壍>
        <喟壍 title="Data table">
          <DataTable ariaLabel="Example" rows={[
            { id: "c1", name: "Brand — Core Terms", cost: 12200, cpa: 4.32 },
            { id: "c2", name: "Generic — Running Shoes", cost: 22200, cpa: 44.86 },
            { id: "c3", name: "PMax — Full Catalog", cost: 34900, cpa: 27.14 },
        ]} rowKey={(磶壍) => 磶壍.id} selectable selected={捜壍} onSelectedChange={艋壍} minWidth={420} initialSort={{ key: "cost", dir: "desc" }} columns={[
            { key: "name", header: "Campaign", width: "minmax(180px,2fr)", sortValue: (韥壍) => 韥壍.name, cell: (擔壍) => 擔壍.name, total: "3 campaigns" },
            { key: "cost", header: "Spend", align: "right", sortValue: (菃壍) => 菃壍.cost, cell: (傲壍) => `$${(傲壍.cost / 1000).toFixed(1)}K`, total: "$69.3K" },
            { key: "cpa", header: "CPA", align: "right", sortValue: (澡壍) => 澡壍.cpa, cell: (躐壍) => `$${躐壍.cpa.toFixed(2)}` },
        ]}/>
        </喟壍>
      </div>
    </div>);
}
