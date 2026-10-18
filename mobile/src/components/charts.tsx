import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { shortDate } from "../lib/format";
import { fonts, usePalette } from "../lib/theme";

/** Charts follow the web dashboard's rules: no dual axes (one metric per chart), a label for every chart. */
function useWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (event) => setWidth(Math.round(event.nativeEvent.layout.width))];
}

function Axis({ first, last, max }: { first?: string; last?: string; max: string }) {
  const p = usePalette();
  const style = { color: p.faint, fontFamily: fonts.mono, fontSize: 10 };
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
      <Text style={style}>{first ? shortDate(first) : ""}</Text>
      <Text style={style}>{`max ${max}`}</Text>
      <Text style={style}>{last ? shortDate(last) : ""}</Text>
    </View>
  );
}

/** Daily bars for one metric. */
export function DailyBars({ points, format, label, height = 120 }: { points: { date: string; value: number }[]; format: (value: number) => string; label: string; height?: number }) {
  const p = usePalette();
  const [width, onLayout] = useWidth();
  const max = Math.max(...points.map((point) => point.value), 0);
  const gap = points.length > 20 ? 1.5 : 3;
  const barWidth = points.length ? Math.max(1, (width - gap * (points.length - 1)) / points.length) : 0;
  return (
    <View accessible accessibilityLabel={`${label}: ${points.length} days, highest ${format(max)}`} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={p.line} strokeWidth={1} />
          {points.map((point, i) => {
            const h = max > 0 ? Math.max(1, (point.value / max) * (height - 6)) : 1;
            const last = i === points.length - 1;
            return <Rect key={point.date} x={i * (barWidth + gap)} y={height - h} width={barWidth} height={h} rx={Math.min(3, barWidth / 2)} fill={last ? p.accent : p.accentLine} opacity={last ? 1 : 0.55} />;
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <Axis first={points[0]?.date} last={points.at(-1)?.date} max={format(max)} />
    </View>
  );
}

/** A signal's metric over time, the expected band shaded, the recent window highlighted. */
export function SignalTrend({ series, band, recentStart, tone, label, height = 140 }: { series: { date: string; value: number | null }[]; band?: { lo: number; hi: number }; recentStart?: string; tone: string; label: string; height?: number }) {
  const p = usePalette();
  const [width, onLayout] = useWidth();
  const values = series.map((point) => point.value).filter((value): value is number => value !== null);
  const lo = Math.min(...values, band?.lo ?? Infinity);
  const hi = Math.max(...values, band?.hi ?? -Infinity);
  const span = hi - lo || 1;
  const pad = 8;
  const x = (i: number) => (series.length > 1 ? (i / (series.length - 1)) * (width - pad * 2) + pad : width / 2);
  const y = (value: number) => height - pad - ((value - lo) / span) * (height - pad * 2);
  let path = "";
  series.forEach((point, i) => {
    if (point.value === null) return;
    path += `${path && series[i - 1]?.value !== null ? "L" : "M"}${x(i).toFixed(1)},${y(point.value).toFixed(1)}`;
  });
  const recentIndex = recentStart ? series.findIndex((point) => point.date >= recentStart) : -1;
  const lastIndex = series.map((point) => point.value !== null).lastIndexOf(true);
  return (
    <View accessible accessibilityLabel={label} onLayout={onLayout}>
      {width > 0 && values.length ? (
        <Svg width={width} height={height}>
          {band ? <Rect x={pad} y={y(band.hi)} width={width - pad * 2} height={Math.max(1, y(band.lo) - y(band.hi))} fill={p.tealTint} /> : null}
          {recentIndex > 0 ? <Rect x={x(recentIndex)} y={0} width={Math.max(2, width - pad - x(recentIndex))} height={height} fill={tone} opacity={0.08} /> : null}
          <Path d={path} stroke={p.accentLine} strokeWidth={2} fill="none" />
          {lastIndex >= 0 ? <Circle cx={x(lastIndex)} cy={y(series[lastIndex]!.value!)} r={4} fill={tone} /> : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ color: p.faint, fontFamily: fonts.mono, fontSize: 10 }}>{series[0] ? shortDate(series[0].date) : ""}</Text>
        {band ? <Text style={{ color: p.faint, fontFamily: fonts.mono, fontSize: 10 }}>shaded = expected range</Text> : null}
        <Text style={{ color: p.faint, fontFamily: fonts.mono, fontSize: 10 }}>{series.at(-1) ? shortDate(series.at(-1)!.date) : ""}</Text>
      </View>
    </View>
  );
}

/** Month pacing: spent to date, projected month end and the budget line. */
export function PacingBar({ spent, projected, target, label }: { spent: number; projected: number; target: number; label: string }) {
  const p = usePalette();
  const [width, onLayout] = useWidth();
  const scale = Math.max(target, projected, spent, 1) * 1.05;
  const over = projected > target * 1.05;
  const h = 14;
  return (
    <View accessible accessibilityLabel={label} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={h + 10}>
          <Rect x={0} y={5} width={width} height={h} rx={h / 2} fill={p.input} />
          <Rect x={0} y={5} width={(projected / scale) * width} height={h} rx={h / 2} fill={over ? p.warn : p.accentLine} opacity={0.35} />
          <Rect x={0} y={5} width={(spent / scale) * width} height={h} rx={h / 2} fill={over ? p.warn : p.accent} />
          <Line x1={(target / scale) * width} x2={(target / scale) * width} y1={0} y2={h + 10} stroke={p.text} strokeWidth={2} />
        </Svg>
      ) : (
        <View style={{ height: h + 10 }} />
      )}
    </View>
  );
}

/** Signals per month, stacked by severity (critical at the bottom), with the count on top. */
export function MonthBars({ months, label, height = 130 }: { months: { month: string; critical: number; warning: number; opportunity: number }[]; label: string; height?: number }) {
  const p = usePalette();
  const [width, onLayout] = useWidth();
  const max = Math.max(1, ...months.map((m) => m.critical + m.warning + m.opportunity));
  const gap = 8;
  const barWidth = months.length ? (width - gap * (months.length - 1)) / months.length : 0;
  return (
    <View accessible accessibilityLabel={label} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {months.map((m, i) => {
            const x = i * (barWidth + gap);
            const unit = (height - 4) / max;
            const segments = [
              { value: m.critical, color: p.crit },
              { value: m.warning, color: p.warn },
              { value: m.opportunity, color: p.accentLine },
            ];
            let top = height;
            return segments.map((segment, j) => {
              const h = segment.value * unit;
              top -= h;
              return h > 0 ? <Rect key={`${m.month}-${j}`} x={x} y={top} width={barWidth} height={h} fill={segment.color} opacity={0.85} /> : null;
            });
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
