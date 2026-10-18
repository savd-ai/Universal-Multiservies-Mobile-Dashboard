import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "./api";
import { useSession } from "./session";

interface ApiState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  refreshing: boolean;
}

/**
 * Loads `path` with the signed-in session whenever the screen gains focus (and when the path or account changes),
 * keeps the last good data while refreshing, and signs out on 401. `null` path = don't load.
 */
export function useApi<T>(path: string | null) {
  const { session, signOut } = useSession();
  const [state, setState] = useState<ApiState<T>>({ data: undefined, error: null, loading: !!path, refreshing: false });
  const latest = useRef(0);
  const credentials = session ? { server: session.server, token: session.token, accountId: session.accountId } : null;
  const key = credentials && path ? `${credentials.server}|${credentials.accountId ?? ""}|${path}` : null;

  const load = useCallback(
    async (mode: "load" | "refresh") => {
      if (!credentials || !path) return;
      const ticket = ++latest.current;
      setState((previous) => ({ ...previous, loading: mode === "load" && previous.data === undefined, refreshing: mode === "refresh", error: null }));
      try {
        const data = await apiRequest<T>(credentials, path);
        if (ticket === latest.current) setState({ data, error: null, loading: false, refreshing: false });
      } catch (error) {
        const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN", String(error));
        if (apiError.status === 401) void signOut({ remote: false });
        if (ticket === latest.current) setState((previous) => ({ ...previous, error: apiError, loading: false, refreshing: false }));
      }
    },
    // `key` stands for server, account and path, so the callback changes exactly when they do
    [key, signOut],
  );

  useEffect(() => {
    setState({ data: undefined, error: null, loading: !!key, refreshing: false });
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      void load("load");
    }, [load]),
  );

  return { ...state, refresh: () => load("refresh"), reload: () => load("load") };
}
