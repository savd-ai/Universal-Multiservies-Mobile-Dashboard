import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button, Card, CardTitle, Headline, Meta, Pill, Screen, Segmented, ToggleRow } from "../../components/ui";
import { apiRequest } from "../../lib/api";
import { backgroundStatus, disableBackgroundSync, enableBackgroundSync } from "../../lib/background";
import { timeAgo } from "../../lib/format";
import { permissionState, requestPermission, sendTestNotification, syncInbox } from "../../lib/notifications";
import { useSession } from "../../lib/session";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type NotificationPrefs } from "../../lib/storage";
import { usePalette } from "../../lib/theme";

export default function SettingsScreen() {
  const p = usePalette();
  const { session, signOut } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [background, setBackground] = useState<"available" | "restricted">("restricted");
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPrefs(await loadPrefs());
    setPermission(await permissionState());
    setBackground(await backgroundStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Settings live on the phone (instant) and on the server (so remote push can follow the same rules later). */
  const update = async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await savePrefs(next);
    if (patch.enabled === true) await enableBackgroundSync();
    if (patch.enabled === false) await disableBackgroundSync();
    if (session) await apiRequest(session, "/api/mobile/device", { method: "PUT", body: patch }).catch(() => undefined);
  };

  const checkNow = async () => {
    if (!session) return;
    setChecking(true);
    try {
      const result = await syncInbox(session, { prefs });
      setLastCheck(new Date().toISOString());
      setStatus(result.firstRun ? "Inbox connected. New signals from now on will notify this phone." : result.shown ? `${result.shown} notification${result.shown === 1 ? "" : "s"} shown.` : (result.note ?? "Nothing new."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <Headline eyebrow="04 · Settings" title="Alerts that *matter*" />
      <Card>
        <CardTitle title="Notifications" sub="When the dashboard detects an anomaly" right={<Pill label={permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked" : "Not asked"} tone={permission === "granted" ? "accent" : "warn"} />} />
        {permission !== "granted" ? (
          <Button
            label={permission === "denied" ? "Blocked in system settings" : "Allow notifications"}
            disabled={permission === "denied"}
            onPress={async () => {
              await requestPermission();
              await refresh();
            }}
          />
        ) : null}
        <ToggleRow label="Notify this phone" hint="New and escalated signals, plus “back to normal” for resolved problems." value={prefs.enabled} onChange={(enabled) => void update({ enabled })} />
        <View style={{ gap: 8 }}>
          <Meta>MINIMUM SEVERITY</Meta>
          <Segmented
            label="Minimum severity"
            options={[
              { value: "warning", label: "WARNING + CRITICAL" },
              { value: "critical", label: "CRITICAL ONLY" },
            ]}
            value={prefs.minSeverity}
            onChange={(minSeverity) => void update({ minSeverity })}
          />
        </View>
        <ToggleRow label="Opportunities too" hint="Things going better than expected (ROAS up, CPA down)." value={prefs.includeOpportunities} onChange={(includeOpportunities) => void update({ includeOpportunities })} />
        <Text style={{ color: p.faint, fontSize: 12, lineHeight: 17 }}>
          {`Checks every minute while the app is open and in the background when the system allows it (${background === "available" ? "available on this phone" : "not available here"}). Several signals at once arrive as one summary.`}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Check now" variant="ghost" loading={checking} onPress={() => void checkNow()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Test"
              variant="ghost"
              onPress={async () => {
                const ok = await sendTestNotification();
                await refresh();
                if (!ok) Alert.alert("Notifications are off", "Allow notifications for SAVD Ads in the system settings.");
              }}
            />
          </View>
        </View>
        {status ? <Text style={{ color: p.muted, fontSize: 13 }}>{`${status}${lastCheck ? ` · ${timeAgo(lastCheck)}` : ""}`}</Text> : null}
      </Card>

      <Card>
        <CardTitle title="Account" sub="Signed in to the dashboard" />
        <View style={{ gap: 4 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: "600" }}>{session?.user.name}</Text>
          <Text style={{ color: p.muted }}>{session?.user.email}</Text>
          <Meta>{`${session?.user.role.replace(/_/g, " ").toUpperCase()} · ${session?.server.replace(/^https?:\/\//, "")}`}</Meta>
        </View>
        {session ? <Button label="Open the web dashboard ↗" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(session.server)} /> : null}
        <Button
          label="Sign out"
          variant="danger"
          onPress={() =>
            Alert.alert("Sign out?", "This phone stops receiving notifications until you sign in again.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: () => {
                  void disableBackgroundSync();
                  void signOut();
                },
              },
            ])
          }
        />
      </Card>
      <Meta>SAVD ADS · READ-ONLY GOOGLE ADS · SESSION ENDS {session ? new Date(session.expiresAt).toDateString().toUpperCase() : ""}</Meta>
    </Screen>
  );
}
