/** Thin JSON client for the dashboard API: bearer token, optional account header, timeouts, typed errors. */
export interface Credentials {
  server: string;
  token: string;
  accountId?: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function normalizeServer(input: string): string {
  let value = input.trim().replace(/\/+$/, "");
  if (value && !/^https?:\/\//i.test(value)) value = `https://${value}`;
  return value;
}

export async function apiRequest<T>(credentials: Pick<Credentials, "server"> & Partial<Credentials>, path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20000);
  const method = init.method ?? (init.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (credentials.token) headers.Authorization = `Bearer ${credentials.token}`;
  if (credentials.accountId) headers["x-savd-account"] = credentials.accountId;
  // The server's CSRF check wants JSON on every write, even an empty one.
  if (method !== "GET") headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${credentials.server}${path}`, { method, headers, body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}), signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiError(0, aborted ? "TIMEOUT" : "NETWORK", aborted ? "The server took too long to answer." : `Can't reach ${credentials.server}. Check the address and your connection.`);
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    if (response.status === 401 && /^basic/i.test(response.headers.get("www-authenticate") ?? "")) {
      throw new ApiError(401, "BASIC_AUTH", "This server is behind DASHBOARD_BASIC_AUTH, which the app can't pass. Turn it off for servers the app uses; the dashboard has its own sign-in.");
    }
    const error = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? `HTTP_${response.status}`, error?.message ?? `The server answered ${response.status}.`, error?.details);
  }
  return json as T;
}
