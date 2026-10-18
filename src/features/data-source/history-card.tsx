"use client";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, MetaStat, StatTile, TileGrid } from "@/components/ui/surfaces";
import { useCan } from "@/lib/api/auth";
import { useHistoryStatus, useHistorySummary } from "@/lib/api/history";

const number = (value: number) => value.toLocaleString("en-US");
const size = (bytes: number | null) => (bytes === null ? "In memory" : bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
const hours = (value: number | null) => (value === null ? "—" : value < 48 ? `${value.toFixed(1)} h` : `${(value / 24).toFixed(1)} days`);

/**
 * The history database (src/lib/server/history): every anomaly evaluation, signal and phone notification, kept for
 * long-term analysis. Unlike the warehouse it also records demo mode (tagged demo), so it is never "unavailable"
 * just because Google Ads isn't connected.
 */
export function HistoryCard({ accountId }: { accountId: string }) {
  const can = useCan();
  const admin = can("system.manage");
  const status = useHistoryStatus(admin);
  const summary = useHistorySummary(accountId);
  const data = summary.data;
  const available = status.data?.available ?? data?.available ?? false;
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader
        title="History database"
        sub="SQLite · anomaly evaluations, signals and mobile notifications, kept for long-term analysis"
        action={<Pill tone={available ? "accent" : "warn"}>{available ? (data?.mode === "demo" ? "Recording · demo" : "Recording") : "Off"}</Pill>}
      />
      {!available && (status.data?.reason ?? data?.note) ? <p className="m-0 text-[13px] text-muted">{status.data?.reason ?? data?.note}</p> : null}
      {data ? (
        <TileGrid min={140}>
          <StatTile label="Signals · 6 months" value={number(data.totals.signals)} />
          <StatTile label="Critical" value={number(data.totals.critical)} />
          <StatTile label="Median time to resolve" value={hours(data.timeToResolveHours.median)} />
          <StatTile label="Evaluations" value={number(data.runs.count)} />
          <StatTile label="Phone notifications" value={number(data.notifications.created)} />
          <StatTile label="Opened on a phone" value={data.notifications.openRate === null ? "—" : `${Math.round(data.notifications.openRate * 100)}%`} />
        </TileGrid>
      ) : null}
      {admin && status.data ? (
        <div className="flex flex-wrap gap-6">
          <MetaStat label="File" value={status.data.file} />
          <MetaStat label="Size" value={size(status.data.bytes)} />
          <MetaStat label="Schema" value={`v${status.data.schemaVersion}`} />
          <MetaStat label="SQLite" value={status.data.sqliteVersion ?? "—"} />
          {status.data.counts ? <MetaStat label="Rows" value={number(Object.values(status.data.counts).reduce((sum, rows) => sum + rows, 0))} /> : null}
        </div>
      ) : null}
      <p className="m-0 text-xs leading-relaxed text-muted-3">
        Filled every time anomalies are evaluated (alert scheduler, cron or “Evaluate now”). The phone app reads its notification inbox and the long-term summary from here.
      </p>
    </Card>
  );
}
