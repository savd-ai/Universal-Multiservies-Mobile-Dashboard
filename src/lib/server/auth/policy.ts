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
const 韩壍: ApiPolicy = { kind: "public" };
const 擘壍 = (菇壍: Permission): ApiPolicy => ({ kind: "permission", permission: 菇壍 });
const 傶壍 = ["GET", "HEAD"];
const 澥壍 = ["POST", "PUT", "PATCH", "DELETE"];
const 躔壍 = [...傶壍, ...澥壍];
const 它壍: {
    methods: string[];
    path: RegExp;
    policy: ApiPolicy;
}[] = [
    { methods: 躔壍, path: /^\/api\/auth(\/|$)/, policy: 韩壍 },
    { methods: 傶壍, path: /^\/api\/health$/, policy: 韩壍 },
    { methods: 傶壍, path: /^\/api\/dev\/mock-platform\//, policy: 韩壍 },
    { methods: 躔壍, path: /^\/api\/cron\//, policy: { kind: "cron" } },
    { methods: 躔壍, path: /^\/api\/me(\/|$)/, policy: { kind: "session" } },
    { methods: 躔壍, path: /^\/api\/admin\/users(\/|$)/, policy: 擘壍("users.manage") },
    { methods: 躔壍, path: /^\/api\/admin\/(clients|directory)(\/|$)/, policy: 擘壍("clients.manage") },
    { methods: 傶壍, path: /^\/api\/portfolio$/, policy: 擘壍("portfolio.read") },
    { methods: 傶壍, path: /^\/api\/google-ads\/health$/, policy: 擘壍("system.manage") },
    { methods: 躔壍, path: /^\/api\/warehouse(\/|$)/, policy: 擘壍("system.manage") },
    { methods: 傶壍, path: /^\/api\/audit$/, policy: 擘壍("audit.read") },
    { methods: ["POST"], path: /^\/api\/(query|query\/batch|query\/export|insights\/drivers|metrics\/custom\/validate|anomalies\/rules\/preview|budget\/optimize|budget\/scenarios|alerts\/digest\/preview)$/, policy: 擘壍("accounts.read") },
    { methods: ["PUT"], path: /^\/api\/accounts\/active$/, policy: 擘壍("accounts.read") },
    { methods: ["POST"], path: /^\/api\/google-ads\/refresh$/, policy: 擘壍("accounts.read") },
    { methods: ["POST"], path: /^\/api\/demo\/unlock$/, policy: 擘壍("accounts.read") },
    { methods: 澥壍, path: /^\/api\/actions(\/|$)/, policy: 擘壍("actions.simulate") },
    { methods: 澥壍, path: /^\/api\/alerts(\/|$)/, policy: 擘壍("alerts.manage") },
    { methods: 澥壍, path: /^\/api\/annotations(\/|$)/, policy: 擘壍("dashboards.edit") },
    { methods: 澥壍, path: /^\/api\/anomalies\/(rules|settings)(\/|$)/, policy: 擘壍("rules.manage") },
    { methods: 澥壍, path: /^\/api\/anomalies(\/|$)/, policy: 擘壍("anomalies.manage") },
    { methods: 澥壍, path: /^\/api\/budget(\/|$)/, policy: 擘壍("budget.plan") },
    { methods: 澥壍, path: /^\/api\/(dashboards|questions|metrics\/custom)(\/|$)/, policy: 擘壍("dashboards.edit") },
    { methods: 澥壍, path: /^\/api\/settings$/, policy: 擘壍("settings.manage") },
    { methods: 傶壍, path: /^\/api\//, policy: 擘壍("accounts.read") },
];
export function policyFor(穲壍: string, 饡壍: string): ApiPolicy | null {
    const 晐壍 = 穲壍.toUpperCase();
    return 它壍.find((蔿壍) => 蔿壍.methods.includes(晐壍) && 蔿壍.path.test(饡壍))?.policy ?? null;
}
