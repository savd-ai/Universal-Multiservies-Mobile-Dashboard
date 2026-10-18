import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Card, Dot, Empty, ErrorView, Headline, Loading, Meta, Pill, Row, Screen, Segmented, severityTone } from "../../components/ui";
import { signedPercent, SEVERITY_LABEL, timeAgo } from "../../lib/format";
import { fonts, usePalette } from "../../lib/theme";
import type { AnomalyFeed, Severity } from "../../lib/types";
import { useApi } from "../../lib/use-api";

type StatusFilter = "open" | "all";
type SeverityFilter = "all" | Severity;

export default function SignalsScreen() {
  const p = usePalette();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const feed = useApi<AnomalyFeed>(`/api/anomalies?status=${status}`);
  const signals = useMemo(() => (feed.data?.signals ?? []).filter((signal) => severity === "all" || signal.severity === severity), [feed.data, severity]);

  return (
    <Screen refreshing={feed.refreshing} onRefresh={feed.refresh}>
      <Headline eyebrow="02 · Signals" title="Signal, *before* it becomes cost" />
      <Segmented label="Status" options={[{ value: "open", label: "OPEN" }, { value: "all", label: "ALL" }]} value={status} onChange={setStatus} />
      <Segmented
        label="Severity"
        options={[
          { value: "all", label: `ALL ${feed.data?.counts.all ?? ""}`.trim() },
          { value: "critical", label: `CRIT ${feed.data?.counts.critical ?? ""}`.trim() },
          { value: "warning", label: `WARN ${feed.data?.counts.warning ?? ""}`.trim() },
          { value: "info", label: `OPP ${feed.data?.counts.info ?? ""}`.trim() },
        ]}
        value={severity}
        onChange={setSeverity}
      />
      {feed.error && !feed.data ? <ErrorView message={feed.error.message} onRetry={feed.reload} /> : null}
      {!feed.data && !feed.error ? <Loading /> : null}
      {feed.data ? (
        <Card style={{ gap: 0 }}>
          {signals.length ? (
            signals.map((signal) => (
              <Row key={signal.id} onPress={() => router.push({ pathname: "/signal/[id]", params: { id: signal.id } })} accessibilityLabel={`${SEVERITY_LABEL[signal.severity]}: ${signal.title}, ${signal.entity.name}`}>
                <Dot tone={severityTone(signal.severity, signal.polarity)} size={10} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Meta>{`${SEVERITY_LABEL[signal.severity].toUpperCase()}${signal.status !== "open" ? ` · ${signal.status.toUpperCase()}` : ""}`}</Meta>
                  </View>
                  <Text style={{ color: p.text, fontWeight: "600", fontSize: 15 }}>{signal.title}</Text>
                  <Text style={{ color: p.faint, fontSize: 12 }} numberOfLines={1} ellipsizeMode="middle">{signal.entity.name}</Text>
                  <Text style={{ color: p.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{signal.summary}</Text>
                  <Text style={{ color: p.faint, fontFamily: fonts.mono, fontSize: 11 }}>{`${signedPercent(signal.changePct)} · first seen ${timeAgo(signal.firstSeenAt)}`}</Text>
                </View>
                <Text style={{ color: p.faint }}>›</Text>
              </Row>
            ))
          ) : (
            <Empty text={status === "open" ? "Nothing open at this severity." : "No signals in the current window."} />
          )}
        </Card>
      ) : null}
      {feed.data ? <Pill label={`${signals.length} shown`} /> : null}
    </Screen>
  );
}
