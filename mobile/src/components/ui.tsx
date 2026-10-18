import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radius, usePalette, type Palette } from "../lib/theme";
import type { Severity } from "../lib/types";

export function Screen({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const p = usePalette();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.accent} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Eyebrow + headline with exactly one *italic* accent word, as in the web dashboard. */
export function Headline({ eyebrow, title }: { eyebrow: string; title: string }) {
  const p = usePalette();
  const parts = title.split(/(\*[^*]+\*)/);
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      <Text style={[styles.eyebrow, { color: p.accent }]}>{eyebrow.toUpperCase()}</Text>
      <Text style={[styles.headline, { color: p.text }]} accessibilityRole="header">
        {parts.map((part, i) =>
          part.startsWith("*") ? (
            <Text key={i} style={{ fontFamily: fonts.serifItalic, fontStyle: "italic", fontWeight: "400", color: p.accent }}>
              {part.slice(1, -1)}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.card, borderColor: p.cardBorder }, style]}>{children}</View>;
}

export function CardTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
        {sub ? <Text style={[styles.meta, { color: p.faint }]}>{sub.toUpperCase()}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export type Tone = "accent" | "crit" | "warn" | "muted";
const toneColors = (p: Palette, tone: Tone) =>
  tone === "crit" ? { fg: p.crit, bg: p.critTint } : tone === "warn" ? { fg: p.warn, bg: p.warnTint } : tone === "accent" ? { fg: p.accent, bg: p.tealTint } : { fg: p.muted3, bg: p.input };

export function severityTone(severity: Severity, polarity: "bad" | "good" = "bad"): Tone {
  if (polarity === "good" || severity === "info") return "accent";
  return severity === "critical" ? "crit" : "warn";
}

export function Pill({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  const p = usePalette();
  const c = toneColors(p, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Dot({ tone, size = 8 }: { tone: Tone; size?: number }) {
  const p = usePalette();
  return <View style={{ width: size, height: size, borderRadius: size, backgroundColor: toneColors(p, tone).fg }} />;
}

export function Button({ label, onPress, variant = "brand", loading, disabled }: { label: string; onPress: () => void; variant?: "brand" | "ghost" | "danger"; loading?: boolean; disabled?: boolean }) {
  const p = usePalette();
  const colors = variant === "brand" ? { bg: p.accent, fg: p.onAccent, border: p.accent } : variant === "danger" ? { bg: "transparent", fg: p.crit, border: p.crit } : { bg: "transparent", fg: p.text, border: p.line };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.bg, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      {loading ? <ActivityIndicator color={colors.fg} /> : <Text style={{ color: colors.fg, fontWeight: "700", fontSize: 15 }}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.meta, { color: p.muted3 }]}>{label.toUpperCase()}</Text>
      <TextInput placeholderTextColor={p.faint} style={[styles.input, { backgroundColor: p.input, color: p.text }]} {...input} />
      {hint ? <Text style={{ color: p.faint, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: p.input }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} style={[styles.segment, active && { backgroundColor: p.accent }]}>
            <Text style={{ color: active ? p.onAccent : p.muted, fontSize: 12, fontWeight: "700", fontFamily: fonts.mono }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({ title, text, tone = "accent" }: { title: string; text: string; tone?: Tone }) {
  const p = usePalette();
  const c = toneColors(p, tone);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.fg + "40" }]}>
      <Pill label={title} tone={tone} />
      <Text style={{ color: p.muted, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: 48, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color={p.accent} />
      <Text style={{ color: p.faint }}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const p = usePalette();
  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: p.crit, fontWeight: "700" }}>Couldn’t load this</Text>
      <Text style={{ color: p.muted, lineHeight: 20 }}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="ghost" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Empty({ text }: { text: string }) {
  const p = usePalette();
  return <Text style={{ color: p.faint, textAlign: "center", paddingVertical: 24, lineHeight: 20 }}>{text}</Text>;
}

export function Row({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { borderColor: p.line, opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.row, { borderColor: p.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.text, fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: p.faint, fontSize: 12, lineHeight: 17 }}>{hint}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: p.accentLine, false: p.input }} />
    </View>
  );
}

export function Meta({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return <Text style={[styles.meta, { color: p.faint }]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, gap: 16 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6 },
  headline: { fontSize: 30, lineHeight: 35, fontWeight: "700", letterSpacing: -0.6 },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  meta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  pillText: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  input: { minHeight: 48, borderRadius: radius.mini, paddingHorizontal: 14, fontSize: 16 },
  segmented: { flexDirection: "row", borderRadius: radius.pill, padding: 3, alignSelf: "flex-start", gap: 2 },
  segment: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  banner: { borderRadius: radius.mini, borderWidth: 1, padding: 14, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
