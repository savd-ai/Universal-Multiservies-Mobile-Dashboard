"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/inputs";
import { LiveGuard, READ_ONLY_COPY } from "@/components/ui/live-guard";
import { Menu, Popover } from "@/components/ui/overlays";
import type { CampaignListRow } from "@/lib/domain/contracts/actions";
import { GoogleAdsLink } from "./campaign-bits";
import { adjustBudget, money, type MoneyFmt } from "./campaign-utils";
import type { TargetStatus } from "./use-campaign-writes";
const STEPS = [-20, -10, 10, 20];
const signed = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)}%`;
interface BulkBarProps {
    rows: readonly CampaignListRow[];
    money: MoneyFmt;
    busy: string | null;
    onClear: () => void;
    onStatus: (ids: string[], status: TargetStatus) => void;
    onBudget: (pct: number, rows: readonly CampaignListRow[]) => Promise<unknown>;
    onExport: () => void;
}
export function CampaignBulkBar({ rows, money: m, busy, onClear, onStatus, onBudget, onExport }: BulkBarProps) {
    const enabled = rows.filter((r) => r.status === "Enabled");
    const paused = rows.filter((r) => r.status === "Paused");
    return (<div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2.5 rounded-card border border-teal/30 bg-surface px-4 py-3 shadow-pop animate-fade-up-fast">
      <span className="text-[13px] font-semibold tabular">{`${rows.length} selected`}</span>
      <button type="button" onClick={onClear} className="text-xs text-muted-3 hover:text-fg">
        Clear
      </button>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden/>
      <LiveGuard>
        <Button size="xs" variant="outline" disabled={!enabled.length || !!busy} loading={busy === "pause"} onClick={() => onStatus(enabled.map((r) => r.id), "Paused")}>
          {`Pause${enabled.length ? ` ${enabled.length}` : ""}`}
        </Button>
      </LiveGuard>
      <LiveGuard>
        <Button size="xs" variant="outline" disabled={!paused.length || !!busy} loading={busy === "enable"} onClick={() => onStatus(paused.map((r) => r.id), "Enabled")}>
          {`Enable${paused.length ? ` ${paused.length}` : ""}`}
        </Button>
      </LiveGuard>
      <LiveGuard>
        <BudgetStepPopover rows={rows} money={m} busy={busy === "budget"} disabled={!!busy} onApply={onBudget}/>
      </LiveGuard>
      <span className="text-xs text-muted-3">{READ_ONLY_COPY}</span>
      <span className="flex-1"/>
      <Button size="xs" variant="ghost" onClick={onExport}>
        Export CSV
      </Button>
      {rows.length === 1 && rows[0] ? (<GoogleAdsLink href={rows[0].deepLink} variant="link" className="text-xs"/>) : (<Menu trigger={<Button size="xs" variant="ghost">
              Open in Google Ads <span aria-hidden>↗</span>
            </Button>} items={rows.slice(0, 12).map((r) => ({ label: r.name, hint: "↗", onSelect: () => void window.open(r.deepLink, "_blank", "noopener,noreferrer") }))}/>)}
    </div>);
}
function BudgetStepPopover({ rows, money: m, busy, disabled, onApply }: {
    rows: readonly CampaignListRow[];
    money: MoneyFmt;
    busy: boolean;
    disabled: boolean;
    onApply: BulkBarProps["onBudget"];
}) {
    const [open, setOpen] = useState(false);
    const [pct, setPct] = useState(10);
    const withBudget = rows.filter((r) => r.dailyBudget !== null && r.dailyBudget > 0);
    const before = withBudget.reduce((s, r) => s + (r.dailyBudget ?? 0), 0);
    const after = withBudget.reduce((s, r) => s + adjustBudget(r.dailyBudget ?? 0, pct), 0);
    const valid = Number.isFinite(pct) && pct !== 0 && pct >= -90 && pct <= 500 && withBudget.length > 0;
    return (<Popover open={open} onOpenChange={setOpen} align="start" trigger={<Button size="xs" variant="outline" disabled={disabled} loading={busy}>
          Budget ±% <span aria-hidden>▾</span>
        </Button>}>
      <div className="flex w-[280px] flex-col gap-3 p-2.5">
        <span className="label-mono">Change daily budgets</span>
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((p) => (<Chip key={p} active={pct === p} onClick={() => setPct(p)}>
              {signed(p)}
            </Chip>))}
        </div>
        <Field label="Custom change (%)" hint="Between −90% and +500%">
          {(id) => <Input id={id} variant="field" type="number" inputMode="decimal" min={-90} max={500} step={1} value={Number.isFinite(pct) ? pct : ""} onChange={(e) => setPct(e.target.value === "" ? Number.NaN : Number(e.target.value))}/>}
        </Field>
        <div className="text-xs leading-normal text-muted-3 tabular">
          {withBudget.length
            ? `${withBudget.length} campaign${withBudget.length === 1 ? "" : "s"} · ${money(before, m, undefined, false)}/day → ${valid ? money(after, m, undefined, false) : "—"}/day`
            : "None of the selected campaigns has its own daily budget."}
          {withBudget.length < rows.length && withBudget.length ? ` · ${rows.length - withBudget.length} without a budget skipped` : ""}
        </div>
        <Button variant="accent" size="sm" className="justify-center" disabled={!valid || busy} loading={busy} onClick={() => {
            void onApply(pct, withBudget).then(() => setOpen(false));
        }}>
          {`Apply ${Number.isFinite(pct) ? signed(pct) : ""}`}
        </Button>
      </div>
    </Popover>);
}
