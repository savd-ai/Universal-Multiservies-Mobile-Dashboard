import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { enableBackgroundSync } from "../lib/background";
import { ensureChannels, markOpened, syncInbox, type SignalNotificationData } from "../lib/notifications";
import { useSession } from "../lib/session";
import { loadPrefs } from "../lib/storage";

const FOREGROUND_EVERY_MS = 60000;

/**
 * Keeps the inbox in sync while signed in: right away, every minute while the app is open, whenever it comes back
 * to the foreground, and in the background through the registered task. Tapping a notification opens the signal
 * (switching to its account) and tells the server it was opened.
 */
export function InboxSync() {
  const { session, setAccount } = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const sync = async () => {
      const current = sessionRef.current;
      if (!current || cancelled) return;
      await syncInbox(current).catch(() => undefined);
    };
    void (async () => {
      await ensureChannels().catch(() => undefined);
      if ((await loadPrefs()).enabled) await enableBackgroundSync();
      await sync();
    })();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void sync();
    }, FOREGROUND_EVERY_MS);
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void Notifications.setBadgeCountAsync(0).catch(() => undefined);
      void sync();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      appState.remove();
    };
    // Keyed on the token: re-run when the signed-in person or server changes, not on account switches.
  }, [session?.token]);

  useEffect(() => {
    const open = async (response: Notifications.NotificationResponse | null) => {
      const current = sessionRef.current;
      if (!response || !current) return;
      const data = response.notification.request.content.data as Partial<SignalNotificationData>;
      await markOpened(current, data.notificationIds ?? []);
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      if (data.kind === "signal" && data.signalId) {
        if (data.accountId && data.accountId !== current.accountId) await setAccount(data.accountId);
        router.push({ pathname: "/signal/[id]", params: { id: data.signalId } });
      } else if (data.kind === "summary") {
        router.push("/signals");
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => void open(response));
    return () => subscription.remove();
  }, [setAccount]);

  return null;
}
