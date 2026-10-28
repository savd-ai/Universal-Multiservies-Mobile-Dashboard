"use client";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Card, CardHeader } from "@/components/ui/surfaces";
import type { EnvKeyStatusWire } from "@/lib/domain/contracts/status";
import { envRowStatus, groupEnv } from "./env-model";
const TONE_TEXT = { accent: "text-accent", crit: "text-crit", warn: "text-warn", muted: "text-muted", faint: "text-faint" } as const;
export function EnvironmentSection({ env }: {
    env: EnvKeyStatusWire[];
}) {
    const groups = useMemo(() => groupEnv(env), [env]);
    const [groupKey, setGroupKey] = useQueryState("env", parseAsString.withDefault("google_ads"));
    const group = groups.find((g) => g.key === groupKey) ?? groups[0];
    const setCount = env.filter((e) => e.set).length;
    const columns: Column<EnvKeyStatusWire>[] = [
        {
            key: "key",
            header: "Key",
            width: "minmax(230px,1.3fr)",
            sortValue: (r) => r.key,
            cell: (r) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-mono text-xs text-fg" title={r.key}>
            {r.key}
          </span>
          {r.secret ? <span className="font-mono text-micro tracking-label text-faint uppercase">secret</span> : null}
        </span>),
        },
        { key: "required", header: "Required", width: "84px", sortValue: (r) => Number(r.required), cell: (r) => <span className={r.required ? "text-fg" : "text-faint"}>{r.required ? "Required" : "Optional"}</span> },
        {
            key: "status",
            header: "Status",
            width: "88px",
            sortValue: (r) => (r.set ? 2 : r.required ? 0 : 1),
            cell: (r) => <span className={cn("font-mono text-meta", r.set ? "text-accent" : r.required ? "text-crit" : "text-faint")}>{r.set ? "✓ set" : r.required ? "Missing" : "—"}</span>,
        },
        {
            key: "hint",
            header: "Masked hint",
            width: "minmax(110px,0.7fr)",
            cell: (r) => {
                const s = envRowStatus(r);
                return <span className={cn("truncate font-mono text-meta", r.set && r.masked ? TONE_TEXT[s.tone] : "text-faint")}>{r.set ? (r.masked ?? "set") : "—"}</span>;
            },
        },
        { key: "description", header: "What it does", width: "minmax(260px,2.2fr)", cell: (r) => <span className="text-xs leading-normal whitespace-normal text-muted">{r.description}</span> },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Environment" sub={`${setCount} of ${env.length} keys set · values never leave the server`}/>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Environment key group">
        {groups.map((g) => (<Chip key={g.key} active={g.key === group?.key} count={`${g.set}/${g.rows.length}`} dot={g.missingRequired ? "var(--crit)" : undefined} title={g.missingRequired ? `${g.missingRequired} required key${g.missingRequired === 1 ? "" : "s"} missing` : `${g.set} of ${g.rows.length} set`} onClick={() => void setGroupKey(g.key === "google_ads" ? null : g.key)}>
            {g.label}
          </Chip>))}
      </div>
      {group ? <DataTable rows={group.rows} columns={columns} rowKey={(r) => r.key} ariaLabel={`${group.label} environment keys`} minWidth={820} density="compact"/> : null}
      <span className="text-xs leading-normal text-muted-3">
        Edit <span className="font-mono text-fg">.env</span> on the server and restart to apply. Run <span className="font-mono text-fg">npm run env:example</span> to regenerate the full template.
      </span>
    </Card>);
}
