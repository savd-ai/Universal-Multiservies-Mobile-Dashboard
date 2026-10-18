import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { syncInbox } from "./notifications";
import { loadPrefs, loadSession } from "./storage";

/**
 * Background inbox sync. The OS decides when it runs (Android WorkManager: ≥15 min; iOS BGTaskScheduler: when the
 * system sees fit, often less often), so it complements, not replaces, remote push for urgent alerts.
 * `defineTask` must run at module load, so the root layout imports this file.
 */
export const INBOX_TASK = "savd-inbox-sync";

TaskManager.defineTask(INBOX_TASK, async () => {
  try {
    const [session, prefs] = await Promise.all([loadSession(), loadPrefs()]);
    if (session && prefs.enabled && Date.parse(session.expiresAt) > Date.now()) await syncInbox(session, { prefs });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function enableBackgroundSync(): Promise<boolean> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(INBOX_TASK))) await BackgroundTask.registerTaskAsync(INBOX_TASK, { minimumInterval: 15 });
    return true;
  } catch {
    return false;
  }
}

export async function disableBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(INBOX_TASK)) await BackgroundTask.unregisterTaskAsync(INBOX_TASK);
  } catch {
    // nothing registered
  }
}

export async function backgroundStatus(): Promise<"available" | "restricted"> {
  try {
    return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available ? "available" : "restricted";
  } catch {
    return "restricted";
  }
}
