import "server-only";
import type { Permission } from "@/lib/domain/auth/roles";
export type ApiPolicy = {
    kind: "public";
} | {
    kind: "cron";
} | {
    kind: "session";
} | {
    kind: "permission";
    permission: Permission;
};
const PUBLIC: ApiPolicy = { kind: "public" };
const P = (permission: Permission): ApiPolicy => ({ kind: "permission", permission });
const READ = ["GET", "HEAD"];
const WRITE = ["POST", "PUT", "PATCH", "DELETE"];
const ANY = [...READ, ...WRITE];
const RULES: {
    methods: string[];
    path: RegExp;
    policy: ApiPolicy;
}[] = [
    { methods: ANY, path: /^\/api\/auth(\/|$)/, policy: PUBLIC },
    { methods: READ, path: /^\/api\/health$/, policy: PUBLIC },
    { methods: READ, path: /^\/api\/dev\/mock-platform\//, policy: PUBLIC },
    { methods: ANY, path: /^\/api\/cron\//, policy: { kind: "cron" } },
    { methods: ANY, path: /^\/api\/me(\/|$)/, policy: { kind: "session" } },
    { methods: ANY, path: /^\/api\/admin\/users(\/|$)/, policy: P("users.manage") },
    { methods: ANY, path: /^\/api\/admin\/(clients|directory)(\/|$)/, policy: P("clients.manage") },
    { methods: READ, path: /^\/api\/portfolio$/, policy: P("portfolio.read") },
    { methods: READ, path: /^\/api\/google-ads\/health$/, policy: P("system.manage") },
    { methods: ANY, path: /^\/api\/warehouse(\/|$)/, policy: P("system.manage") },
    { methods: READ, path: /^\/api\/audit$/, policy: P("audit.read") },
    { methods: ANY, path: /^\/api\/mobile\/device$/, policy: { kind: "session" } },
    { methods: ["POST"], path: /^\/api\/mobile\/notifications\/ack$/, policy: P("accounts.read") },
    { methods: READ, path: /^\/api\/history\/status$/, policy: P("system.manage") },
    { methods: ["POST"], path: /^\/api\/(query|query\/batch|query\/export|insights\/drivers|metrics\/custom\/validate|anomalies\/rules\/preview|budget\/optimize|budget\/scenarios|alerts\/digest\/preview)$/, policy: P("accounts.read") },
    { methods: ["PUT"], path: /^\/api\/accounts\/active$/, policy: P("accounts.read") },
    { methods: ["POST"], path: /^\/api\/google-ads\/refresh$/, policy: P("accounts.read") },
    { methods: WRITE, path: /^\/api\/actions(\/|$)/, policy: P("actions.simulate") },
    { methods: WRITE, path: /^\/api\/alerts(\/|$)/, policy: P("alerts.manage") },
    { methods: WRITE, path: /^\/api\/annotations(\/|$)/, policy: P("dashboards.edit") },
    { methods: WRITE, path: /^\/api\/anomalies\/(rules|settings)(\/|$)/, policy: P("rules.manage") },
    { methods: WRITE, path: /^\/api\/anomalies(\/|$)/, policy: P("anomalies.manage") },
    { methods: WRITE, path: /^\/api\/budget(\/|$)/, policy: P("budget.plan") },
    { methods: WRITE, path: /^\/api\/(dashboards|questions|metrics\/custom)(\/|$)/, policy: P("dashboards.edit") },
    { methods: WRITE, path: /^\/api\/settings$/, policy: P("settings.manage") },
    { methods: READ, path: /^\/api\//, policy: P("accounts.read") },
];
export function policyFor(method: string, pathname: string): ApiPolicy | null {
    const m = method.toUpperCase();
    return RULES.find((r) => r.methods.includes(m) && r.path.test(pathname))?.policy ?? null;
}
