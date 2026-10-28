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
function seedDashboards(): Dashboard[] {
    const nowIso = new Date().toISOString();
    return seedDashboardBodies().map((b) => ({ ...b, schemaVersion: 1 as const, version: 1, createdAt: nowIso, updatedAt: nowIso }));
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
        const d = getDriver();
        return {
            users: new Collection<UserRecord>(d, "users"),
            sessions: new Collection<SessionRecord>(d, "sessions"),
            clients: new Collection<ClientRecord>(d, "clients"),
            authTokens: new Collection<AuthTokenRecord>(d, "auth-tokens"),
            scheduler: new Singleton<SchedulerState>(d, "scheduler", () => ({ lastRunAt: null, lastDigest: {} })),
            audit: new AppendLog<AuditEntry>(d, "audit"),
        };
    });
}
export function isWorkspaceId(id: string): boolean {
    return id === AGENCY_WORKSPACE || CLIENT_ID_PATTERN.test(id);
}
function workspaceDriver(workspaceId: string): Driver {
    const base = getDriver();
    return workspaceId === AGENCY_WORKSPACE ? base : prefixedDriver(base, `workspaces/${workspaceId}/`);
}
export function getWorkspaceStore(workspaceId: string): AppStore {
    if (!isWorkspaceId(workspaceId))
        throw new Error(`Invalid workspace id ${workspaceId}`);
    return singleton(`store:ws:${workspaceId}`, () => {
        const d = workspaceDriver(workspaceId);
        const g = getGlobalStore();
        return {
            dashboards: new Collection<Dashboard>(d, "dashboards", seedDashboards),
            questions: new Collection<SavedQuestion>(d, "questions"),
            customMetrics: new Collection<CustomMetric>(d, "custom-metrics"),
            annotations: new Collection<Annotation>(d, "annotations"),
            signalStates: new Collection<SignalState>(d, "signal-states"),
            anomalySettings: new Singleton<AnomalySettings>(d, "anomaly-settings", defaultAnomalySettings),
            alertChannels: new Collection<AlertChannel>(d, "alert-channels"),
            alertRoutes: new Collection<AlertRoute>(d, "alert-routes"),
            deliveries: new AppendLog<AlertDelivery>(d, "alert-deliveries"),
            budgetTargets: new Collection<BudgetTargets>(d, "budget-targets"),
            budgetPlans: new Collection<BudgetPlan>(d, "budget-plans"),
            settings: new Singleton<AppSettings>(d, "settings", defaultSettings),
            scheduler: g.scheduler,
            audit: g.audit,
        };
    });
}
export function getStore(): AppStore {
    return getWorkspaceStore(currentWorkspace());
}
export async function audit(entry: Omit<AuditEntry, "ts">): Promise<void> {
    try {
        const who = currentPrincipal();
        await getGlobalStore().audit.append({
            ts: new Date().toISOString(),
            workspace: currentWorkspace(),
            ...(who.kind === "user" ? { actorId: who.userId ?? undefined, actorEmail: who.email ?? undefined } : {}),
            ...entry,
        });
    }
    catch {
    }
}
