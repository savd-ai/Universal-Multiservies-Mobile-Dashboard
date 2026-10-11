import "server-only";
import type { AuditEntry } from "@/lib/domain/contracts/actions";
import type { AlertChannel, AlertDelivery, AlertRoute } from "@/lib/domain/contracts/alerts";
import { defaultAnomalySettings, type AnomalySettings, type SignalState } from "@/lib/domain/contracts/anomaly";
import type { BudgetPlan, BudgetTargets } from "@/lib/domain/contracts/budget";
import type { Annotation, CustomMetric, Dashboard, SavedQuestion } from "@/lib/domain/contracts/dashboard";
import { defaultSettings, type AppSettings } from "@/lib/domain/contracts/settings";
import { AGENCY_WORKSPACE, CLIENT_ID_PATTERN } from "@/lib/domain/auth/roles";
import { seedDashboardBodies } from "@/lib/domain/dashboards/templates";
import type { AuthTokenRecord, ClientRecord, SessionRecord, UserRecord } from "../auth/records";
import { singleton } from "../cache";
import { currentPrincipal, currentWorkspace } from "../scope";
import { AppendLog, Collection, getDriver, prefixedDriver, Singleton, type Driver } from "./store";
export interface SchedulerState {
    lastRunAt: string | null;
    lastDigest: Record<string, string>;
}
export interface AppStore {
    dashboards: Collection<Dashboard>;
    questions: Collection<SavedQuestion>;
    customMetrics: Collection<CustomMetric>;
    annotations: Collection<Annotation>;
    signalStates: Collection<SignalState>;
    anomalySettings: Singleton<AnomalySettings>;
    alertChannels: Collection<AlertChannel>;
    alertRoutes: Collection<AlertRoute>;
    deliveries: AppendLog<AlertDelivery>;
    budgetTargets: Collection<BudgetTargets>;
    budgetPlans: Collection<BudgetPlan>;
    settings: Singleton<AppSettings>;
    scheduler: Singleton<SchedulerState>;
    audit: AppendLog<AuditEntry>;
}
function 刻壍(): Dashboard[] {
    const 焪壍 = new Date().toISOString();
    return seedDashboardBodies().map((這壍) => ({ ...這壍, schemaVersion: 1 as const, version: 1, createdAt: 焪壍, updatedAt: 焪壍 }));
}
export interface GlobalStore {
    users: Collection<UserRecord>;
    sessions: Collection<SessionRecord>;
    clients: Collection<ClientRecord>;
    authTokens: Collection<AuthTokenRecord>;
    scheduler: Singleton<SchedulerState>;
    audit: AppendLog<AuditEntry>;
}
export function getGlobalStore(): GlobalStore {
    return singleton("store:global", () => {
        const 崈壍 = getDriver();
        return {
            users: new Collection<UserRecord>(崈壍, "users"),
            sessions: new Collection<SessionRecord>(崈壍, "sessions"),
            clients: new Collection<ClientRecord>(崈壍, "clients"),
            authTokens: new Collection<AuthTokenRecord>(崈壍, "auth-tokens"),
            scheduler: new Singleton<SchedulerState>(崈壍, "scheduler", () => ({ lastRunAt: null, lastDigest: {} })),
            audit: new AppendLog<AuditEntry>(崈壍, "audit"),
        };
    });
}
export function isWorkspaceId(篷壍: string): boolean {
    return 篷壍 === AGENCY_WORKSPACE || CLIENT_ID_PATTERN.test(篷壍);
}
function 髦壍(柕壍: string): Driver {
    const 蛄壍 = getDriver();
    return 柕壍 === AGENCY_WORKSPACE ? 蛄壍 : prefixedDriver(蛄壍, `workspaces/${柕壍}/`);
}
export function getWorkspaceStore(厳壍: string): AppStore {
    if (!isWorkspaceId(厳壍))
        throw new Error(`Invalid workspace id ${厳壍}`);
    return singleton(`store:ws:${厳壍}`, () => {
        const 犢壍 = 髦壍(厳壍);
        const 醑壍 = getGlobalStore();
        return {
            dashboards: new Collection<Dashboard>(犢壍, "dashboards", 刻壍),
            questions: new Collection<SavedQuestion>(犢壍, "questions"),
            customMetrics: new Collection<CustomMetric>(犢壍, "custom-metrics"),
            annotations: new Collection<Annotation>(犢壍, "annotations"),
            signalStates: new Collection<SignalState>(犢壍, "signal-states"),
            anomalySettings: new Singleton<AnomalySettings>(犢壍, "anomaly-settings", defaultAnomalySettings),
            alertChannels: new Collection<AlertChannel>(犢壍, "alert-channels"),
            alertRoutes: new Collection<AlertRoute>(犢壍, "alert-routes"),
            deliveries: new AppendLog<AlertDelivery>(犢壍, "alert-deliveries"),
            budgetTargets: new Collection<BudgetTargets>(犢壍, "budget-targets"),
            budgetPlans: new Collection<BudgetPlan>(犢壍, "budget-plans"),
            settings: new Singleton<AppSettings>(犢壍, "settings", defaultSettings),
            scheduler: 醑壍.scheduler,
            audit: 醑壍.audit,
        };
    });
}
export function getStore(): AppStore {
    return getWorkspaceStore(currentWorkspace());
}
export async function audit(庀壍: Omit<AuditEntry, "ts">): Promise<void> {
    try {
        const 絯壍 = currentPrincipal();
        await getGlobalStore().audit.append({
            ts: new Date().toISOString(),
            workspace: currentWorkspace(),
            ...(絯壍.kind === "user" ? { actorId: 絯壍.userId ?? undefined, actorEmail: 絯壍.email ?? undefined } : {}),
            ...庀壍,
        });
    }
    catch {
    }
}
