import * as SecureStore from "expo-secure-store";

/**
 * Everything the app keeps lives in the OS keychain / keystore (expo-secure-store): the session token, the chosen
 * account, notification settings and the inbox cursor. Small values only; reads never throw.
 */
export interface StoredSession {
  server: string;
  token: string;
  expiresAt: string;
  deviceId: string | null;
  user: { name: string; email: string; role: string };
  accountId: string | null;
}

export interface NotificationPrefs {
  enabled: boolean;
  minSeverity: "warning" | "critical";
  includeOpportunities: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = { enabled: true, minSeverity: "warning", includeOpportunities: false };

const KEYS = {
  session: "savd.session",
  server: "savd.lastServer",
  install: "savd.installId",
  prefs: "savd.notificationPrefs",
  cursor: "savd.notificationCursor",
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // keychain unavailable (rare): the app keeps working for this launch
  }
}

export const loadSession = () => readJson<StoredSession>(KEYS.session);
export const saveSession = (session: StoredSession | null) => write(KEYS.session, session ? JSON.stringify(session) : null);

export async function loadLastServer(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.server);
  } catch {
    return null;
  }
}
export const saveLastServer = (server: string) => write(KEYS.server, server);

export async function loadPrefs(): Promise<NotificationPrefs> {
  return { ...DEFAULT_PREFS, ...((await readJson<Partial<NotificationPrefs>>(KEYS.prefs)) ?? {}) };
}
export const savePrefs = (prefs: NotificationPrefs) => write(KEYS.prefs, JSON.stringify(prefs));

/** Highest notification id already handled, per server and user (null = fresh install: don't replay the backlog). */
export async function loadCursor(scope: string): Promise<number | null> {
  const all = (await readJson<Record<string, number>>(KEYS.cursor)) ?? {};
  return typeof all[scope] === "number" ? all[scope]! : null;
}
export async function saveCursor(scope: string, value: number | null): Promise<void> {
  const all = (await readJson<Record<string, number>>(KEYS.cursor)) ?? {};
  if (value === null) delete all[scope];
  else all[scope] = value;
  await write(KEYS.cursor, JSON.stringify(all));
}

/** RFC 4122 v4 id for this install (not a secret: it only lets a new sign-in reuse the device record). */
export async function installId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEYS.install);
    if (existing) return existing;
  } catch {
    // fall through and make one
  }
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const id = `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
  await write(KEYS.install, id);
  return id;
}
