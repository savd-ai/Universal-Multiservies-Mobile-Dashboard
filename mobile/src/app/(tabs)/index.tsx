import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { DailyBars, PacingBar } from "../../components/charts";
import { Banner, Card, CardTitle, Dot, Empty, ErrorView, Headline, Loading, Meta, Pill, Row, Screen, Segmented, severityTone } from "../../components/ui";
import { count, decimal, delta, money, percent, ratio, shortDate, signedPercent, SEVERITY_LABEL } from "../../lib/format";
import { useSession } from "../../lib/session";
import { fonts, usePalette } from "../../lib/theme";
import type { Kpis, Overview, RangePreset } from "../../lib/types";
import { useApi } from "../../lib/use-api";

const RANGES: { value: RangePreset; label: string }[] = [
  { value: "last_7d", label: "7D" },
  { value: "last_14d", label: "14D" },
  { value: "last_30d", label: "30D" },
  { value: "mtd", label: "MTD" },
];

/** Which way is good for each KPI (spend has no good direction). */
const KPI_DEFS: { key: keyof Kpis; label: string; better: "up" | "down" | null; format: (value: number | null, currency: string) => string }[] = [
  { key: "cost", label: "Spend", better: null, format: (v, c) => money(v, c) },
  { key: "conversions", label: "Conversions", better: "up", format: (v) => decimal(v) },
  { key: "cpa", label: "CPA", better: "down", format: (v, c) => money(v, c) },
  { key: "roas", label: "ROAS", better: "up", format: (v) => ratio(v) },
  { key: "clicks", label: "Clicks", better: "up", format: (v) => count(v) },
  { key: "ctr", label: "CTR", better: "up", format: (v) => percent(v) },
];

export default function OverviewScreen() {
  const p = usePalette();
  const { session, setAccount } = useSession();
  const [range, setRange] = useState<RangePreset>("last_7d");
  const overview = useApi<Overview>(`/api/mobile/overview?range=${range}`);
  const data = overview.data;

  return (
    <Screen refreshing={overview.refreshing} onRefresh={overview.refresh}>
      <Headline eyebrow="01 · Overview" title="What is *actually* driving growth?" />
      {data && data.accounts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {data.accounts.map((account) => {
            const active = account.id === data.account.id;
            return (
              <Pressable key={account.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => void setAccount(account.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? p.accent : p.line, backgroundColor: active ? p.tealTint : "transparent" }}>
                <Text style={{ color: active ? p.text : p.muted, fontSize: 13, fontWeight: active ? "700" : "500" }}>{account.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <Segmented label="Date range" options={RANGES} value={range} onChange={setRange} />
      {data?.demo ? <Banner title="Demo data" text={data.reasonText ?? "Generated sample accounts, not read from Google Ads."} /> : null}
      {overview.error && !data ? <ErrorView message={overview.error.message} onRetry={overview.reload} /> : null}
      {!data && !overview.error ? <Loading /> : null}
      {data ? (
        <>
          <Card>
            <CardTitle title={data.account.name} sub={`${shortDate(data.range.start)} – ${shortDate(data.range.end)} · vs previous period`} right={<Pill label={data.mode === "live" ? "Live" : "Demo"} tone={data.mode === "live" ? "accent" : "muted"} />} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16 }}>
              {KPI_DEFS.map((kpi) => {
                const value = data.kpis[kpi.key];
                const change = delta(value, data.previous?.[kpi.key]);
                const good = change === null || kpi.better === null ? null : (change > 0) === (kpi.better === "up");
                return (
                  <View key={kpi.key} style={{ width: "50%", gap: 4 }} accessible accessibilityLabel={`${kpi.label} ${kpi.format(value, data.account.currency)}, ${signedPercent(change)} vs previous period`}>
                    <Meta>{kpi.label.toUpperCase()}</Meta>
                    <Text style={{ color: p.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 }}>{kpi.format(value, data.account.currency)}</Text>
                    <Text style={{ color: good === null ? p.faint : good ? p.accent : p.crit, fontFamily: fonts.mono, fontSize: 12 }}>
                      {change === null ? "—" : `${good === null ? "" : good ? "▲ " : "▼ "}${signedPercent(change)}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card>
            <CardTitle title="Spend per day" sub="Today's bar is the darkest" />
            <DailyBars label="Spend per day" points={data.daily.map((day) => ({ date: day.date, value: day.cost }))} format={(v) => money(v, data.account.currency)} />
          </Card>
          <Card>
            <CardTitle title="Conversions per day" />
            <DailyBars label="Conversions per day" points={data.daily.map((day) => ({ date: day.date, value: day.conversions }))} format={decimal} />
          </Card>

          {data.pacing ? (
            <Card>
              <CardTitle title="Budget pacing" sub={`${data.pacing.monthLabel} · month to date`} right={data.pacing.overpacing ? <Pill label={`${data.pacing.overpacing} overpacing`} tone="warn" /> : null} />
              <Text style={{ color: p.text, fontSize: 28, fontWeight: "700" }}>
                {data.pacing.ratio === null ? "—" : `${Math.round(data.pacing.ratio * 100)}%`}
                <Text style={{ color: p.muted, fontSize: 14, fontWeight: "400" }}> projected of budget</Text>
              </Text>
              <PacingBar label={`Spent ${money(data.pacing.mtdSpend, data.account.currency)}, projected ${money(data.pacing.projected, data.account.currency)} of ${money(data.pacing.target, data.account.currency)}`} spent={data.pacing.mtdSpend} projected={data.pacing.projected} target={data.pacing.target} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {[
                  ["MTD", data.pacing.mtdSpend],
                  ["Projected", data.pacing.projected],
                  ["Budget", data.pacing.target],
                ].map(([label, value]) => (
                  <View key={String(label)} style={{ gap: 2 }}>
                    <Meta>{String(label).toUpperCase()}</Meta>
                    <Text style={{ color: p.text, fontWeight: "600" }}>{money(Number(value), data.account.currency)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Signals" sub="Open anomalies · last 3 days vs baseline" right={<Pressable onPress={() => router.push("/signals")}><Text style={{ color: p.accent, fontWeight: "600" }}>All →</Text></Pressable>} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pill label={`${data.signals.critical} critical`} tone="crit" />
              <Pill label={`${data.signals.warning} warning`} tone="warn" />
              <Pill label={`${data.signals.opportunity} opportunity`} tone="accent" />
            </View>
            {data.signals.top.length ? (
              data.signals.top.map((signal) => (
                <Row key={signal.id} onPress={() => router.push({ pathname: "/signal/[id]", params: { id: signal.id } })} accessibilityLabel={`${SEVERITY_LABEL[signal.severity]}: ${signal.title}, ${signal.entityName}`}>
                  <Dot tone={severityTone(signal.severity, signal.polarity)} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: p.text, fontWeight: "600" }}>{signal.title}</Text>
                    <Text style={{ color: p.faint, fontSize: 12 }} numberOfLines={1} ellipsizeMode="middle">{signal.entityName}</Text>
                  </View>
                  <Text style={{ color: p.faint }}>›</Text>
                </Row>
              ))
            ) : (
              <Empty text="No open signals. The account is inside its expected ranges." />
            )}
          </Card>
          <Meta>{`DATA THROUGH ${shortDate(data.dataThrough, true).toUpperCase()} · READ-ONLY · ${session?.server.replace(/^https?:\/\//, "") ?? ""}`}</Meta>
        </>
      ) : null}
    </Screen>
  );
}
