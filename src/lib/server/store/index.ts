import "server-only";
import type { AuditEntry, SimulatedAction } from "@/lib/domain/contracts/actions";
import type { IdeaSet } from "@/lib/domain/contracts/ai";
import type { AlertChannel, AlertDelivery, AlertRoute } from "@/lib/domain/contracts/alerts";
import { defaultAnomalySettings, type AnomalySettings, type SignalState } from "@/lib/domain/contracts/anomaly";
import type { BudgetPlan, BudgetTargets } from "@/lib/domain/contracts/budget";
import type { Annotation, CustomMetric, Dashboard, SavedQuestion } from "@/lib/domain/contracts/dashboard";
import type { PluginConnection, PluginManifest } from "@/lib/domain/contracts/plugins";
import { defaultSettings, type AppSettings } from "@/lib/domain/contracts/settings";
import { AGENCY_WORKSPACE, CLIENT_ID_PATTERN } from "@/lib/domain/auth/roles";
import { seedDashboardBodies } from "@/lib/domain/dashboards/templates";
import type { AuthTokenRecord, ClientRecord, SessionRecord, UserRecord } from "../auth/records";
import { singleton } from "../cache";
import { currentPrincipal, currentWorkspace } from "../scope";
import { AppendLog, Collection, getDriver, prefixedDriver, Singleton, type BaseRecord, type Driver } from "./store";

// The application store: every persisted collection in one place, with first-run seeds.
//
// Multi-tenancy: each client has a workspace store under DATA_DIR/workspaces/<clientId>/ (dashboards, rules,
// alerts, plans, settings…); the agency workspace is DATA_DIR itself, so single-tenant installs keep their files.
// getStore() returns the workspace of the current request scope (see ../scope.ts). Users, sessions, clients,
// custom plugin manifests, the scheduler state and the audit log are global (getGlobalStore()).

export type StoredPlugin = PluginManifest & BaseRecord;

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
  plugins: Collection<StoredPlugin>;
  pluginConnections: Collection<PluginConnection>;
  budgetTargets: Collection<BudgetTargets>;
  budgetPlans: Collection<BudgetPlan>;
  ideaSets: Collection<IdeaSet>;
  simulatedActions: Collection<SimulatedAction>;
  settings: Singleton<AppSettings>;
  scheduler: Singleton<SchedulerState>;
  audit: AppendLog<AuditEntry>;
}

/** Plugins connected on first run — the prototype shipped with { meta: true, ga4: true }. */
export const DEFAULT_CONNECTED_PLUGINS = ["meta", "ga4"];

function seedDashboards(): Dashboard[] {
  const nowIso = new Date().toISOString();
  return seedDashboardBodies().map((b) => ({ ...b, schemaVersion: 1 as const, version: 1, createdAt: nowIso, updatedAt: nowIso }));
}

function seedConnections(): PluginConnection[] {
  const nowIso = new Date().toISOString();
  return DEFAULT_CONNECTED_PLUGINS.map((pluginId) => ({
    id: pluginId,
    pluginId,
    enabled: true,
    status: "connected" as const,
    mode: "demo" as const,
    configPlain: {},
    secrets: {},
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

export interface GlobalStore {
  users: Collection<UserRecord>;
  sessions: Collection<SessionRecord>;
  clients: Collection<ClientRecord>;
  authTokens: Collection<AuthTokenRecord>;
  plugins: Collection<StoredPlugin>;
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
      plugins: new Collection<StoredPlugin>(d, "plugins"),
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

/** The store of one workspace ("agency" or a client id). */
export function getWorkspaceStore(workspaceId: string): AppStore {
  if (!isWorkspaceId(workspaceId)) throw new Error(`Invalid workspace id ${workspaceId}`);
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
      plugins: g.plugins,
      pluginConnections: new Collection<PluginConnection>(d, "plugin-connections", seedConnections),
      budgetTargets: new Collection<BudgetTargets>(d, "budget-targets"),
      budgetPlans: new Collection<BudgetPlan>(d, "budget-plans"),
      ideaSets: new Collection<IdeaSet>(d, "idea-sets"),
      simulatedActions: new Collection<SimulatedAction>(d, "simulated-actions"),
      settings: new Singleton<AppSettings>(d, "settings", defaultSettings),
      scheduler: g.scheduler,
      audit: g.audit,
    };
  });
}

/** The store of the current request's workspace. */
export function getStore(): AppStore {
  return getWorkspaceStore(currentWorkspace());
}

/** Append to the global audit log, stamped with the signed-in person and the workspace. */
export async function audit(entry: Omit<AuditEntry, "ts">): Promise<void> {
  try {
    const who = currentPrincipal();
    await getGlobalStore().audit.append({
      ts: new Date().toISOString(),
      workspace: currentWorkspace(),
      ...(who.kind === "user" ? { actorId: who.userId ?? undefined, actorEmail: who.email ?? undefined } : {}),
      ...entry,
    });
  } catch {
    /* audit must never break a request */
  }
}
