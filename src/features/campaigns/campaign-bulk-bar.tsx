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
const 闄壍 = [-20, -10, 10, 20];
const 抳壍 = (膢壍: number) => `${膢壍 > 0 ? "+" : 膢壍 < 0 ? "−" : ""}${Math.abs(膢壍)}%`;
interface BulkBarProps {
    rows: readonly CampaignListRow[];
    money: MoneyFmt;
    busy: string | null;
    onClear: () => void;
    onStatus: (云壍: string[], 涀壍: TargetStatus) => void;
    onBudget: (豯壍: number, 奞壍: readonly CampaignListRow[]) => Promise<unknown>;
    onExport: () => void;
}
export function CampaignBulkBar({ rows: 硍壍, money: 霼壍, busy: 搫壍, onClear: 茚壍, onStatus: 倉壍, onBudget: 滸壍, onExport: 跧壍 }: BulkBarProps) {
    const 嫖壍 = 硍壍.filter((秅壍) => 秅壍.status === "Enabled");
    const 颴壍 = 硍壍.filter((斣壍) => 斣壍.status === "Paused");
    return (<div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2.5 rounded-card border border-teal/30 bg-surface px-4 py-3 shadow-pop animate-fade-up-fast">
      <span className="text-[13px] font-semibold tabular">{`${硍壍.length} selected`}</span>
      <button type="button" onClick={茚壍} className="text-xs text-muted-3 hover:text-fg">
        Clear
      </button>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden/>
      <LiveGuard>
        <Button size="xs" variant="outline" disabled={!嫖壍.length || !!搫壍} loading={搫壍 === "pause"} onClick={() => 倉壍(嫖壍.map((蒒壍) => 蒒壍.id), "Paused")}>
          {`Pause${嫖壍.length ? ` ${嫖壍.length}` : ""}`}
        </Button>
      </LiveGuard>
      <LiveGuard>
        <Button size="xs" variant="outline" disabled={!颴壍.length || !!搫壍} loading={搫壍 === "enable"} onClick={() => 倉壍(颴壍.map((冁壍) => 冁壍.id), "Enabled")}>
          {`Enable${颴壍.length ? ` ${颴壍.length}` : ""}`}
        </Button>
      </LiveGuard>
      <LiveGuard>
        <Cmp23 rows={硍壍} money={霼壍} busy={搫壍 === "budget"} disabled={!!搫壍} onApply={滸壍}/>
      </LiveGuard>
      <span className="text-xs text-muted-3">{READ_ONLY_COPY}</span>
      <span className="flex-1"/>
      <Button size="xs" variant="ghost" onClick={跧壍}>
        Export CSV
      </Button>
      {硍壍.length === 1 && 硍壍[0] ? (<GoogleAdsLink href={硍壍[0].deepLink} variant="link" className="text-xs"/>) : (<Menu trigger={<Button size="xs" variant="ghost">
              Open in Google Ads <span aria-hidden>↗</span>
            </Button>} items={硍壍.slice(0, 12).map((灰壍) => ({ label: 灰壍.name, hint: "↗", onSelect: () => void window.open(灰壍.deepLink, "_blank", "noopener,noreferrer") }))}/>)}
    </div>);
}
function Cmp23({ rows: 屎壍, money: 笽壍, busy: 騬壍, disabled: 望壍, onApply: 蘊壍 }: {
    rows: readonly CampaignListRow[];
    money: MoneyFmt;
    busy: boolean;
    disabled: boolean;
    onApply: BulkBarProps["onBudget"];
}) {
    const [勹壍, 燨壍] = useState(false);
    const [郗壍, 巆壍] = useState(10);
    const 粵壍 = 屎壍.filter((鮤壍) => 鮤壍.dailyBudget !== null && 鮤壍.dailyBudget > 0);
    const 梓壍 = 粵壍.reduce((螂壍, 呱壍) => 螂壍 + (呱壍.dailyBudget ?? 0), 0);
    const 獠壍 = 粵壍.reduce((鉏壍, 弾壍) => 鉏壍 + adjustBudget(弾壍.dailyBudget ?? 0, 郗壍), 0);
    const 縭壍 = Number.isFinite(郗壍) && 郗壍 !== 0 && 郗壍 >= -90 && 郗壍 <= 500 && 粵壍.length > 0;
    return (<Popover open={勹壍} onOpenChange={燨壍} align="start" trigger={<Button size="xs" variant="outline" disabled={望壍} loading={騬壍}>
          Budget ±% <span aria-hidden>▾</span>
        </Button>}>
      <div className="flex w-[280px] flex-col gap-3 p-2.5">
        <span className="label-mono">Change daily budgets</span>
        <div className="flex flex-wrap gap-1.5">
          {闄壍.map((鴜壍) => (<Chip key={鴜壍} active={郗壍 === 鴜壍} onClick={() => 巆壍(鴜壍)}>
              {抳壍(鴜壍)}
            </Chip>))}
        </div>
        <Field label="Custom change (%)" hint="Between −90% and +500%">
          {(樋壍) => <Input id={樋壍} variant="field" type="number" inputMode="decimal" min={-90} max={500} step={1} value={Number.isFinite(郗壍) ? 郗壍 : ""} onChange={(裺壍) => 巆壍(裺壍.target.value === "" ? Number.NaN : Number(裺壍.target.value))}/>}
        </Field>
        <div className="text-xs leading-normal text-muted-3 tabular">
          {粵壍.length
            ? `${粵壍.length} campaign${粵壍.length === 1 ? "" : "s"} · ${money(梓壍, 笽壍, undefined, false)}/day → ${縭壍 ? money(獠壍, 笽壍, undefined, false) : "—"}/day`
            : "None of the selected campaigns has its own daily budget."}
          {粵壍.length < 屎壍.length && 粵壍.length ? ` · ${屎壍.length - 粵壍.length} without a budget skipped` : ""}
        </div>
        <Button variant="accent" size="sm" className="justify-center" disabled={!縭壍 || 騬壍} loading={騬壍} onClick={() => {
            void 蘊壍(郗壍, 粵壍).then(() => 燨壍(false));
        }}>
          {`Apply ${Number.isFinite(郗壍) ? 抳壍(郗壍) : ""}`}
        </Button>
      </div>
    </Popover>);
}
