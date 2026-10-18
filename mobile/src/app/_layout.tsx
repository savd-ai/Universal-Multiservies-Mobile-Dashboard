// Registers the background inbox task at load (TaskManager.defineTask must run in module scope).
import "../lib/background";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { InboxSync } from "../components/inbox-sync";
import { SessionProvider, useSession } from "../lib/session";
import { usePalette } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { ready, session } = useSession();
  const p = usePalette();
  if (!ready) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  return (
    <>
      <StatusBar style="auto" />
      {session ? <InboxSync /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="signal/[id]"
            options={{ headerShown: true, title: "Signal", headerBackTitle: "Back", headerTintColor: p.accent, headerStyle: { backgroundColor: p.bg }, headerTitleStyle: { color: p.text }, headerShadowVisible: false }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
