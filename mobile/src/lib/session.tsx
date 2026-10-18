import Constants from "expo-constants";
import * as Device from "expo-device";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { apiRequest, normalizeServer } from "./api";
import { installId, loadSession, saveCursor, saveLastServer, saveSession, type StoredSession } from "./storage";
import type { LoginResponse } from "./types";

interface SessionContextValue {
  ready: boolean;
  session: StoredSession | null;
  signIn(input: { server: string; email: string; password: string }): Promise<{ mfaChallenge: string | null }>;
  completeMfa(input: { server: string; challenge: string; code: string }): Promise<void>;
  signOut(options?: { remote?: boolean }): Promise<void>;
  setAccount(accountId: string): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function deviceInfo() {
  return {
    platform: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
    name: (Device.deviceName ?? Device.modelName ?? (Platform.OS === "ios" ? "iPhone" : "Android phone")).slice(0, 80),
    appVersion: Constants.expoConfig?.version ?? "1.0.0",
    osVersion: String(Device.osVersion ?? Platform.Version).slice(0, 32),
  };
}

/** Cursor scope for the notification inbox: one per server and person. */
export const cursorScope = (session: Pick<StoredSession, "server" | "user">) => `${session.server}|${session.user.email}`;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    void loadSession().then((stored) => {
      setSession(stored && Date.parse(stored.expiresAt) > Date.now() ? stored : null);
      setReady(true);
    });
  }, []);

  const adopt = useCallback(async (server: string, response: Extract<LoginResponse, { ok: true }>) => {
    const next: StoredSession = { server, token: response.token, expiresAt: response.expiresAt, deviceId: response.deviceId, user: response.user, accountId: null };
    await saveSession(next);
    await saveLastServer(server);
    setSession(next);
  }, []);

  const signIn = useCallback<SessionContextValue["signIn"]>(
    async ({ server, email, password }) => {
      const base = normalizeServer(server);
      const response = await apiRequest<LoginResponse>({ server: base }, "/api/auth/mobile/login", { body: { email, password, device: deviceInfo(), installId: await installId() } });
      if (!response.ok) return { mfaChallenge: response.mfa.challenge };
      await adopt(base, response);
      return { mfaChallenge: null };
    },
    [adopt],
  );

  const completeMfa = useCallback<SessionContextValue["completeMfa"]>(
    async ({ server, challenge, code }) => {
      const base = normalizeServer(server);
      const response = await apiRequest<LoginResponse>({ server: base }, "/api/auth/mobile/mfa", { body: { challenge, code: code.trim(), device: deviceInfo(), installId: await installId() } });
      if (response.ok) await adopt(base, response);
    },
    [adopt],
  );

  const signOut = useCallback<SessionContextValue["signOut"]>(
    async (options) => {
      const current = session;
      setSession(null);
      await saveSession(null);
      if (!current) return;
      await saveCursor(cursorScope(current), null);
      if (options?.remote !== false) await apiRequest(current, "/api/auth/mobile/logout", { body: {} }).catch(() => undefined);
    },
    [session],
  );

  const setAccount = useCallback<SessionContextValue["setAccount"]>(
    async (accountId) => {
      if (!session) return;
      const next = { ...session, accountId };
      setSession(next);
      await saveSession(next);
    },
    [session],
  );

  const value = useMemo(() => ({ ready, session, signIn, completeMfa, signOut, setAccount }), [ready, session, signIn, completeMfa, signOut, setAccount]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
