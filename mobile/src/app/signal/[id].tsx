import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Text, View } from "react-native";
import { SignalTrend } from "../../components/charts";
import { Button, Card, CardTitle, ErrorView, Loading, Meta, Pill, Screen, severityTone } from "../../components/ui";
import { ApiError, apiRequest } from "../../lib/api";
import { SEVERITY_LABEL, shortDate, signedPercent, timeAgo } from "../../lib/format";
import { useSession } from "../../lib/session";
import { usePalette } from "../../lib/theme";
import type { SignalView } from "../../lib/types";
import { useApi } from "../../lib/use-api";

const VERDICT_LABEL: Record<string, string> = {
  expected: "Expected after a change",
  learning: "Smart Bidding is learning",
  likely_cause: "Likely cause found",
  possible_cause: "Possible cause found",
  no_recent_changes: "No account changes",
};

type Action = { action: "acknowledge" } | { action: "snooze"; hours: number } | { action: "resolve" } | { action: "reopen" };

export default function SignalScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const signal = useApi<SignalView>(id ? `/api/anomalies/${encodeURIComponent(id)}` : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const data = signal.data;
  const tone = data ? severityTone(data.severity, data.polarity) : "muted";
  const toneColor = tone === "crit" ? p.crit : tone === "warn" ? p.warn : p.accent;

  const act = async (label: string, body: Action) => {
    if (!session || !id) return;
    setBusy(label);
    setMessage(null);
    try {
      await apiRequest(session, `/api/anomalies/${encodeURIComponent(id)}`, { method: "PATCH", body });
      setMessage(`${label} · saved for everyone on the team.`);
      await signal.reload();
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 403 ? "Your role can only read signals. Ask an admin to change it." : error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen refreshing={signal.refreshing} onRefresh={signal.refresh}>
      {signal.error && !data ? <ErrorView message={signal.error.status === 404 ? "This signal is no longer in the current window. It may have resolved." : signal.error.message} onRetry={signal.reload} /> : null}
      {!data && !signal.error ? <Loading /> : null}
      {data ? (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pill label={data.polarity === "good" ? "Opportunity" : SEVERITY_LABEL[data.severity]} tone={tone} />
              <Pill label={data.status} />
            </View>
            <Text style={{ color: p.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.4 }} accessibilityRole="header">
              {data.title}
            </Text>
            <Text style={{ color: p.muted, fontSize: 15 }}>{data.entity.name}</Text>
          </View>
          <Card>
            <Text style={{ color: p.text, fontSize: 15, lineHeight: 22 }}>{data.summary}</Text>
            <SignalTrend series={data.series} band={data.band} recentStart={data.window.recentStart} tone={toneColor} label={`${data.title}: last ${data.series.length} days, recent window highlighted`} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
              {data.evidence.slice(0, 6).map((item) => (
                <View key={item.label} style={{ width: "50%", gap: 2 }}>
                  <Meta>{item.label.toUpperCase()}</Meta>
                  <Text style={{ color: p.text, fontWeight: "600" }}>{item.value}</Text>
                </View>
              ))}
              <View style={{ width: "50%", gap: 2 }}>
                <Meta>CHANGE</Meta>
                <Text style={{ color: toneColor, fontWeight: "700" }}>{signedPercent(data.changePct)}</Text>
              </View>
            </View>
            <Meta>{`RECENT ${shortDate(data.window.recentStart)} – ${shortDate(data.window.recentEnd)}${data.window.baselineStart ? ` · BASELINE ${shortDate(data.window.baselineStart)} – ${shortDate(data.window.baselineEnd ?? data.window.baselineStart)}` : ""} · FIRST SEEN ${timeAgo(data.firstSeenAt).toUpperCase()}`}</Meta>
          </Card>
          {data.changeContext && VERDICT_LABEL[data.changeContext.verdict] ? (
            <Card>
              <CardTitle title={VERDICT_LABEL[data.changeContext.verdict]!} sub="Change history" />
              <Text style={{ color: p.muted, lineHeight: 20 }}>{data.changeContext.note}</Text>
            </Card>
          ) : null}
          <Card>
            <CardTitle title="Recommended" />
            <Text style={{ color: p.text, lineHeight: 21 }}>{data.recommendation}</Text>
          </Card>
          <Card>
            <CardTitle title="Triage" sub="Shared with the web dashboard" />
            {data.status === "open" ? (
              <View style={{ gap: 10 }}>
                <Button label="Acknowledge" onPress={() => void act("Acknowledged", { action: "acknowledge" })} loading={busy === "Acknowledged"} />
                <Button label="Snooze 24 hours" variant="ghost" onPress={() => void act("Snoozed", { action: "snooze", hours: 24 })} loading={busy === "Snoozed"} />
                <Button label="Resolve" variant="ghost" onPress={() => void act("Resolved", { action: "resolve" })} loading={busy === "Resolved"} />
              </View>
            ) : (
              <Button label="Reopen" variant="ghost" onPress={() => void act("Reopened", { action: "reopen" })} loading={busy === "Reopened"} />
            )}
            {message ? <Text style={{ color: p.muted, fontSize: 13 }}>{message}</Text> : null}
            {session ? <Button label="Open in the web dashboard ↗" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(`${session.server}/anomalies?acct=${encodeURIComponent(data.accountId)}`)} /> : null}
            <Text style={{ color: p.faint, fontSize: 12, lineHeight: 17 }}>Read-only for Google Ads: fixes happen in Google Ads; this only records what the team decided.</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
