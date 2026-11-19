import "server-only";
import type { Permission } from "@/lib/domain/auth/roles";

// Access policy for every API route, in one reviewable table (first match wins). Reads default to
// "accounts.read"; a write that matches no rule is refused — tests/unit/auth/policy.test.ts walks src/app/api and
// fails the build if a route has no policy, so a new write route can't ship unprotected by accident.

export type ApiPolicy = { kind: "public" } | { kind: "cron" } | { kind: "session" } | { kind: "permission"; permission: Permission };

const PUBLIC: ApiPolicy = { kind: "public" };
const P = (permission: Permission): ApiPolicy => ({ kind: "permission", permission });
const READ = ["GET", "HEAD"];
const WRITE = ["POST", "PUT", "PATCH", "DELETE"];
const ANY = [...READ, ...WRITE];

const RULES: { methods: string[]; path: RegExp; policy: ApiPolicy }[] = [
  // no session: sign-in flows, health check, dev mock platform (404s in production), cron (bearer token)
  { methods: ANY, path: /^\/api\/auth(\/|$)/, policy: PUBLIC },
  { methods: READ, path: /^\/api\/health$/, policy: PUBLIC },
  { methods: READ, path: /^\/api\/dev\/mock-platform\//, policy: PUBLIC },
  { methods: ANY, path: /^\/api\/cron\//, policy: { kind: "cron" } },
  // any signed-in user: their own profile, password, 2FA and sessions
  { methods: ANY, path: /^\/api\/me(\/|$)/, policy: { kind: "session" } },

  // administration
  { methods: ANY, path: /^\/api\/admin\/users(\/|$)/, policy: P("users.manage") },
  { methods: ANY, path: /^\/api\/admin\/(clients|directory)(\/|$)/, policy: P("clients.manage") },
  { methods: READ, path: /^\/api\/portfolio$/, policy: P("portfolio.read") },
  { methods: READ, path: /^\/api\/google-ads\/health$/, policy: P("system.manage") },
  { methods: ANY, path: /^\/api\/warehouse(\/|$)/, policy: P("system.manage") },
  { methods: READ, path: /^\/api\/audit$/, policy: P("audit.read") },
  { methods: READ, path: /^\/api\/plugins\/custom(\/|$)/, policy: P("plugins.manage") },

  // computations that use POST but change nothing
  { methods: ["POST"], path: /^\/api\/(query|query\/batch|query\/export|insights\/drivers|metrics\/custom\/validate|anomalies\/rules\/preview|budget\/optimize|budget\/scenarios|alerts\/digest\/preview)$/, policy: P("accounts.read") },
  { methods: ["POST"], path: /^\/api\/ai\/(ideas|blueprint|ad-copy|narrative|negatives|chat)$/, policy: P("ai.use") },
  { methods: ["POST"], path: /^\/api\/anomalies\/[^/]+\/explain$/, policy: P("ai.use") },
  { methods: ["PUT"], path: /^\/api\/accounts\/active$/, policy: P("accounts.read") },
  { methods: ["POST"], path: /^\/api\/google-ads\/refresh$/, policy: P("accounts.read") },

  // writes
  { methods: WRITE, path: /^\/api\/actions(\/|$)/, policy: P("actions.simulate") },
  { methods: WRITE, path: /^\/api\/ai\/idea-sets\/[^/]+$/, policy: P("budget.plan") },
  { methods: WRITE, path: /^\/api\/alerts(\/|$)/, policy: P("alerts.manage") },
  { methods: WRITE, path: /^\/api\/annotations(\/|$)/, policy: P("dashboards.edit") },
  { methods: WRITE, path: /^\/api\/anomalies\/(rules|settings)(\/|$)/, policy: P("rules.manage") },
  { methods: WRITE, path: /^\/api\/anomalies(\/|$)/, policy: P("anomalies.manage") },
  { methods: WRITE, path: /^\/api\/budget(\/|$)/, policy: P("budget.plan") },
  { methods: WRITE, path: /^\/api\/(dashboards|questions|metrics\/custom)(\/|$)/, policy: P("dashboards.edit") },
  { methods: WRITE, path: /^\/api\/plugins(\/|$)/, policy: P("plugins.manage") },
  { methods: WRITE, path: /^\/api\/settings$/, policy: P("settings.manage") },

  // everything else that only reads
  { methods: READ, path: /^\/api\//, policy: P("accounts.read") },
];

export function policyFor(method: string, pathname: string): ApiPolicy | null {
  const m = method.toUpperCase();
  return RULES.find((r) => r.methods.includes(m) && r.path.test(pathname))?.policy ?? null;
}
