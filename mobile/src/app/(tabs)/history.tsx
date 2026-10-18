import { useState } from "react";
import { Text, View } from "react-native";
import { MonthBars } from "../../components/charts";
import { Banner, Card, CardTitle, Dot, Empty, ErrorView, Headline, Loading, Meta, Row, Screen, Segmented, severityTone } from "../../components/ui";
import { hours, monthLabel, percent, SEVERITY_LABEL, timeAgo } from "../../lib/format";
import { usePalette } from "../../lib/theme";
import type { HistorySignal, HistorySummary } from "../../lib/types";
import { useApi } from "../../lib/use-api";

type Months = "3" | "6" | "12";

/** Long-term analysis from the server's SQLite history: what kept going wrong, how fast it was fixed, who saw it. */
export default function HistoryScreen() {
  const p = usePalette();
  const [months, setMonths] = useState<Months>("6");
  const summary = useApi<HistorySummary>(`/api/history/summary?months=${months}&scope=all`);
  const recent = useApi<{ signals: HistorySignal[] }>("/api/history/signals?limit=15");
  const data = summary.data;

  return (
    <Screen refreshing={summary.refreshing} onRefresh={() => {
      void summary.refresh();
      void recent.refresh();
    }}>
      <Headline eyebrow="03 · History" title="What keeps *recurring*" />
      <Segmented label="Months" options={[{ value: "3", label: "3M" }, { value: "6", label: "6M" }, { value: "12", label: "12M" }]} value={months} onChange={setMonths} />
      {data?.mode === "demo" ? <Banner title="Demo data" text="These records come from evaluations of the generated demo accounts. Live and demo history are kept apart." /> : null}
      {data && !data.available ? <Banner title="History off" tone="warn" text={data.note ?? "The server keeps no history database."} /> : null}
      {summary.error && !data ? <ErrorView message={summary.error.message} onRetry={summary.reload} /> : null}
      {!data && !summary.error ? <Loading /> : null}
      {data ? (
        <>
          <Card>
            <CardTitle title="Signals raised" sub={`${data.runs.count} evaluations · last ${timeAgo(data.runs.lastRunAt)}`} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[
                ["Total", data.totals.signals, p.text],
                ["Critical", data.totals.critical, p.crit],
                ["Warning", data.totals.warning, p.warn],
                ["Opportunity", data.totals.opportunity, p.accent],
              ].map(([label, value, color]) => (
                <View key={String(label)} style={{ gap: 2 }}>
                  <Meta>{String(label).toUpperCase()}</Meta>
                  <Text style={{ color: String(color), fontSize: 22, fontWeight: "700" }}>{String(value)}</Text>
                </View>
              ))}
            </View>
            <MonthBars months={data.byMonth} label={`Signals per month, ${data.byMonth.length} months, stacked by severity`} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {data.byMonth.map((month) => (
                <Text key={month.month} style={{ color: p.faint, fontSize: 10, flex: 1, textAlign: "center" }}>
                  {monthLabel(month.month)}
                </Text>
              ))}
            </View>
          </Card>

          <Card>
            <CardTitle title="Time to resolve" sub={`${data.timeToResolveHours.resolved} resolved · ${data.totals.open} still open`} />
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ gap: 2 }}>
                <Meta>MEDIAN</Meta>
                <Text style={{ color: p.text, fontSize: 22, fontWeight: "700" }}>{hours(data.timeToResolveHours.median)}</Text>
              </View>
              <View style={{ gap: 2 }}>
                <Meta>SLOWEST 10%</Meta>
                <Text style={{ color: p.text, fontSize: 22, fontWeight: "700" }}>{hours(data.timeToResolveHours.p90)}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <CardTitle title="Phone notifications" sub="Delivered = fetched by a phone · opened = tapped" />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[
                ["Created", String(data.notifications.created)],
                ["Delivered", String(data.notifications.delivered)],
                ["Opened", String(data.notifications.opened)],
                ["Open rate", data.notifications.openRate === null ? "—" : percent(data.notifications.openRate, 0)],
              ].map(([label, value]) => (
                <View key={label} style={{ gap: 2 }}>
                  <Meta>{label!.toUpperCase()}</Meta>
                  <Text style={{ color: p.text, fontSize: 18, fontWeight: "700" }}>{value}</Text>
                </View>
              ))}
            </View>
            {data.notifications.medianMinutesToOpen !== null ? <Text style={{ color: p.muted }}>{`Half of the opened alerts were read within ${hours(data.notifications.medianMinutesToOpen / 60)}.`}</Text> : null}
          </Card>

          <Card style={{ gap: 0 }}>
            <CardTitle title="Recurring campaigns" sub="Most signals in the period" />
            {data.topEntities.length ? (
              data.topEntities.map((entity) => (
                <Row key={`${entity.accountName}-${entity.entityId}`}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: p.text, fontWeight: "600" }} numberOfLines={1} ellipsizeMode="middle">{entity.entityName}</Text>
                    <Text style={{ color: p.faint, fontSize: 12 }}>{entity.accountName}</Text>
                  </View>
                  <Text style={{ color: entity.critical ? p.crit : p.muted, fontWeight: "700" }}>{`${entity.signals}${entity.critical ? ` · ${entity.critical} crit` : ""}`}</Text>
                </Row>
              ))
            ) : (
              <Empty text="Nothing recorded yet. Signals are stored each time the server evaluates anomalies (scheduler, cron or “Evaluate now”)." />
            )}
          </Card>

          <Card style={{ gap: 0 }}>
            <CardTitle title="Latest stored signals" sub="Active account" />
            {(recent.data?.signals ?? []).map((signal) => (
              <Row key={signal.signalId}>
                <Dot tone={severityTone(signal.peakSeverity, signal.polarity)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: p.text }} numberOfLines={1}>{signal.title}</Text>
                  <Text style={{ color: p.faint, fontSize: 12 }} numberOfLines={1} ellipsizeMode="middle">{`${signal.entityName} · ${SEVERITY_LABEL[signal.peakSeverity]} at peak`}</Text>
                </View>
                <Text style={{ color: signal.resolvedAt ? p.accent : p.faint, fontSize: 12 }}>{signal.resolvedAt ? "resolved" : timeAgo(signal.firstSeenAt)}</Text>
              </Row>
            ))}
            {recent.data && !recent.data.signals.length ? <Empty text="No stored signals for this account yet." /> : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
