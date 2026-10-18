import { Tabs } from "expo-router";
import { Text } from "react-native";
import { usePalette } from "../../lib/theme";

/** Typographic glyphs instead of an icon library, like the web dashboard. */
const glyph = (char: string) =>
  function TabGlyph({ color }: { color: string }) {
    return <Text style={{ color, fontSize: 18, lineHeight: 22 }}>{char}</Text>;
  };

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.faint,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: glyph("◎") }} />
      <Tabs.Screen name="signals" options={{ title: "Signals", tabBarIcon: glyph("◆") }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: glyph("▤") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: glyph("⚙") }} />
    </Tabs>
  );
}
