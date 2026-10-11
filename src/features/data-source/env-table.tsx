"use client";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Card, CardHeader } from "@/components/ui/surfaces";
import type { EnvKeyStatusWire } from "@/lib/domain/contracts/status";
import { envRowStatus, groupEnv } from "./env-model";
const 醗壍 = { accent: "text-accent", crit: "text-crit", warn: "text-warn", muted: "text-muted", faint: "text-faint" } as const;
export function EnvironmentSection({ env: 庆壍 }: {
    env: EnvKeyStatusWire[];
}) {
    const 絵壍 = useMemo(() => groupEnv(庆壍), [庆壍]);
    const [鱤壍, 楓壍] = useQueryState("env", parseAsString.withDefault("google_ads"));
    const 衂壍 = 絵壍.find((唱壍) => 唱壍.key === 鱤壍) ?? 絵壍[0];
    const 琠壍 = 庆壍.filter((錏壍) => 錏壍.set).length;
    const 忾壍: Column<EnvKeyStatusWire>[] = [
        {
            key: "key",
            header: "Key",
            width: "minmax(230px,1.3fr)",
            sortValue: (续壍) => 续壍.key,
            cell: (鷜壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-mono text-xs text-fg" title={鷜壍.key}>
            {鷜壍.key}
          </span>
          {鷜壍.secret ? <span className="font-mono text-micro tracking-label text-faint uppercase">secret</span> : null}
        </span>),
        },
        { key: "required", header: "Required", width: "84px", sortValue: (櫋壍) => Number(櫋壍.required), cell: (覺壍) => <span className={覺壍.required ? "text-fg" : "text-faint"}>{覺壍.required ? "Required" : "Optional"}</span> },
        {
            key: "status",
            header: "Status",
            width: "88px",
            sortValue: (嚩壍) => (嚩壍.set ? 2 : 嚩壍.required ? 0 : 1),
            cell: (疘壍) => <span className={cn("font-mono text-meta", 疘壍.set ? "text-accent" : 疘壍.required ? "text-crit" : "text-faint")}>{疘壍.set ? "✓ set" : 疘壍.required ? "Missing" : "—"}</span>,
        },
        {
            key: "hint",
            header: "Masked hint",
            width: "minmax(110px,0.7fr)",
            cell: (钇壍) => {
                const 慶壍 = envRowStatus(钇壍);
                return <span className={cn("truncate font-mono text-meta", 钇壍.set && 钇壍.masked ? 醗壍[慶壍.tone] : "text-faint")}>{钇壍.set ? (钇壍.masked ?? "set") : "—"}</span>;
            },
        },
        { key: "description", header: "What it does", width: "minmax(260px,2.2fr)", cell: (聥壍) => <span className="text-xs leading-normal whitespace-normal text-muted">{聥壍.description}</span> },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Environment" sub={`${琠壍} of ${庆壍.length} keys set · values never leave the server`}/>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Environment key group">
        {絵壍.map((齔壍) => (<Chip key={齔壍.key} active={齔壍.key === 衂壍?.key} count={`${齔壍.set}/${齔壍.rows.length}`} dot={齔壍.missingRequired ? "var(--crit)" : undefined} title={齔壍.missingRequired ? `${齔壍.missingRequired} required key${齔壍.missingRequired === 1 ? "" : "s"} missing` : `${齔壍.set} of ${齔壍.rows.length} set`} onClick={() => void 楓壍(齔壍.key === "google_ads" ? null : 齔壍.key)}>
            {齔壍.label}
          </Chip>))}
      </div>
      {衂壍 ? <DataTable rows={衂壍.rows} columns={忾壍} rowKey={(汃壍) => 汃壍.key} ariaLabel={`${衂壍.label} environment keys`} minWidth={820} density="compact"/> : null}
      <span className="text-xs leading-normal text-muted-3">
        Edit <span className="font-mono text-fg">.env</span> on the server and restart to apply. Run <span className="font-mono text-fg">npm run env:example</span> to regenerate the full template.
      </span>
    </Card>);
}
