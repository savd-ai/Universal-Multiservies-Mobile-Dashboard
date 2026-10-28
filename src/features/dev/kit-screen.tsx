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
const SERIES = [12, 14, 13, 17, 16, 19, 18, 22, 21, 24, 23, 27, 26, 29];
function Section({ title, children }: {
    title: string;
    children: React.ReactNode;
}) {
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={title}/>
      {children}
    </Card>);
}
export function KitScreen() {
    const { theme, toggle } = useTheme();
    const [seg, setSeg] = useState<"7" | "30" | "90">("30");
    const [on, setOn] = useState(true);
    const [val, setVal] = useState(40);
    const [tab, setTab] = useState<"a" | "b">("a");
    const [modal, setModal] = useState(false);
    const [drawer, setDrawer] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [sel, setSel] = useState<Set<string>>(new Set());
    return (<div className="min-h-dvh bg-page bg-glow px-8 py-8 text-fg">
      <header className="mb-8 flex flex-wrap items-end gap-6">
        <div className="flex flex-1 flex-col gap-3">
          <Eyebrow>00 · UI kit</Eyebrow>
          <Headline text="One spine, *every* component"/>
        </div>
        <Logo size={28}/>
        <Switch size="md" checked={theme === "dark"} onChange={toggle} label={theme === "dark" ? "Dark" : "Light"} ariaLabel="Dark mode"/>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Buttons">
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
        </Section>
        <Section title="Controls">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active>All</Chip>
            <Chip>Search</Chip>
            <Chip dot="var(--crit)" count={3}>
              Critical
            </Chip>
            <Chip tone="add">+ Budget pacing</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Segmented ariaLabel="Range" value={seg} onChange={setSeg} options={[{ value: "7", label: "7D" }, { value: "30", label: "30D" }, { value: "90", label: "90D" }]}/>
            <Switch checked={on} onChange={setOn} label="Spend"/>
            <Checkbox checked={on} onChange={setOn} ariaLabel="Check"/>
          </div>
          <Slider value={val} onChange={setVal} min={0} max={100} aria-label="Sensitivity"/>
        </Section>
        <Section title="Inputs">
          <Input placeholder="Search campaigns…"/>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly test budget">{(id) => <Input id={id} variant="field" defaultValue="3000"/>}</Field>
            <Field label="Goal">
              {(id) => (<Select id={id} defaultValue="conv">
                  <option value="conv">Scale conversions</option>
                  <option value="cpa">Lower CPA</option>
                </Select>)}
            </Field>
          </div>
          <Field label="Context" hint="Shown above the notes." aside={<CharCounter length={24} max={30}/>}>
            {(id) => <Textarea id={id} defaultValue="Running shoes, US-first."/>}
          </Field>
        </Section>
        <Section title="Status">
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
        </Section>
        <Section title="Stats">
          <TileGrid>
            <StatTile label="Spend" value="$123.5K">
              <Sparkline values={SERIES}/>
            </StatTile>
            <StatTile label="CPA" value="$20.14">
              <Sparkline values={[...SERIES].reverse()} color="var(--crit)"/>
            </StatTile>
            <StatTile label="ROAS" value="4.80x">
              <Sparkline values={SERIES}/>
            </StatTile>
          </TileGrid>
          <div className="grid grid-cols-3 gap-3">
            <MetaStat label="MTD" value="$115.6K"/>
            <MetaStat label="Projected" value="$124.1K" tone="warn"/>
            <MetaStat label="Budget" value="$136.5K"/>
          </div>
          <StatCard label="Projected month-end" value="$124.1K" caption="$12.4K headroom" tone="accent"/>
        </Section>
        <Section title="Sparks">
          <AreaSpark values={SERIES} refLine={20} gradientId="kit-area" height={110}/>
          <BandSpark values={SERIES} band={{ lo: 12, hi: 22 }} color="var(--crit)" height={90}/>
        </Section>
        <Section title="Surfaces">
          <div className="grid grid-cols-2 gap-3">
            <MiniCard>Mini card</MiniCard>
            <DashedCard interactive>+ Connect another platform</DashedCard>
          </div>
          <Card accent>Accent card</Card>
          <CodeBlock>{`GOOGLE_ADS_CLIENT_ID=\nGOOGLE_ADS_CLIENT_SECRET=`}</CodeBlock>
        </Section>
        <Section title="Brand">
          <StatBlock value="91%" caption="projected of budget"/>
          <PullQuote attribution="SAVD AI">Competitor Terms CPC nearly doubled — defend brand SERPs first.</PullQuote>
          <MetaLine left="SAVD.AI · Ads intelligence" right="Synced live" index={1} total={9}/>
          <GradientCard num="01" title="Brand defense" meta="Search · 82%">
            Protect high-intent clicks while competitors bid up your terms.
          </GradientCard>
          <SystemDiagram nodes={[{ num: "01", title: "Google Ads", caption: "read-only" }, { num: "02", title: "Alerts", caption: "webhooks" }, { num: "03", title: "Engine", caption: "query · anomalies" }]} result={{ title: "Dashboard", caption: "widgets · alerts" }}/>
        </Section>
        <Section title="Feedback">
          <Skeleton height={16}/>
          <SkeletonLines lines={2}/>
          <InlineEmpty>No active signals at this sensitivity.</InlineEmpty>
          <ErrorState error={{ message: "The Google Ads API did not respond." }} onRetry={() => toast("Retrying…")}/>
          <EmptyState action={<Button variant="accent">Add widgets</Button>}>This dashboard is empty.</EmptyState>
        </Section>
        <Section title="Overlays & tabs">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "a", label: "Overview" }, { value: "b", label: "Keywords" }]}/>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={() => setModal(true)}>Modal</Button>
            <Button onClick={() => setDrawer(true)}>Drawer</Button>
            <Button onClick={() => setConfirm(true)}>Confirm</Button>
            <Button onClick={() => toast("Added “Brand defense” to plan", { action: { label: "Undo", onClick: () => undefined } })}>Toast</Button>
            <Popover trigger={<Button>Popover ▾</Button>}>
              <div className="w-56 p-3 text-[13px]">Popover content</div>
            </Popover>
            <Menu trigger={<Button>Menu ▾</Button>} items={[{ label: "Rename", onSelect: () => undefined }, { label: "Delete", danger: true, separatorBefore: true, onSelect: () => undefined }]}/>
            <Tooltip content="Tooltip text">
              <Button variant="ghost">Hover me</Button>
            </Tooltip>
          </div>
          <Modal open={modal} onOpenChange={setModal} eyebrow="Connect" title="Meta Ads" description="Credentials stay on the server." footer={<Button variant="accent" onClick={() => setModal(false)}>Connect</Button>}>
            <Field label="Access token">{(id) => <Input id={id} variant="field" placeholder="••••••••"/>}</Field>
          </Modal>
          <Drawer open={drawer} onOpenChange={setDrawer} eyebrow="Search" title="Brand — Core Terms">
            <p className="m-0 text-[13px] text-muted">Drawer body.</p>
          </Drawer>
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete dashboard?" description="This can't be undone." danger confirmLabel="Delete" onConfirm={() => setConfirm(false)}/>
        </Section>
        <Section title="Data table">
          <DataTable ariaLabel="Example" rows={[
            { id: "c1", name: "Brand — Core Terms", cost: 12200, cpa: 4.32 },
            { id: "c2", name: "Generic — Running Shoes", cost: 22200, cpa: 44.86 },
            { id: "c3", name: "PMax — Full Catalog", cost: 34900, cpa: 27.14 },
        ]} rowKey={(r) => r.id} selectable selected={sel} onSelectedChange={setSel} minWidth={420} initialSort={{ key: "cost", dir: "desc" }} columns={[
            { key: "name", header: "Campaign", width: "minmax(180px,2fr)", sortValue: (r) => r.name, cell: (r) => r.name, total: "3 campaigns" },
            { key: "cost", header: "Spend", align: "right", sortValue: (r) => r.cost, cell: (r) => `$${(r.cost / 1000).toFixed(1)}K`, total: "$69.3K" },
            { key: "cpa", header: "CPA", align: "right", sortValue: (r) => r.cpa, cell: (r) => `$${r.cpa.toFixed(2)}` },
        ]}/>
        </Section>
      </div>
    </div>);
}
