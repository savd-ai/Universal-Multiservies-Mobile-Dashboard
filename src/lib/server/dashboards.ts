import "server-only";
import { randomUUID } from "node:crypto";
import type { Dashboard, DashboardBody } from "@/lib/domain/contracts/dashboard";
import { AppError } from "./http/errors";
import { getStore } from "./store";
export function normalizeDashboard(body: DashboardBody): DashboardBody {
    const ids = new Set(body.widgets.map((w) => w.id));
    const layout = body.layout.filter((l) => ids.has(l.i));
    const bottom = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    let y = bottom;
    for (const w of body.widgets) {
        if (!layout.some((l) => l.i === w.id)) {
            layout.push({ i: w.id, x: 0, y, w: 6, h: 14 });
            y += 14;
        }
    }
    return { ...body, layout };
}
export async function listDashboards(): Promise<Dashboard[]> {
    const all = await getStore().dashboards.list();
    return all.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.createdAt.localeCompare(b.createdAt));
}
async function clearOtherDefaults(keepId: string): Promise<void> {
    const store = getStore().dashboards;
    for (const d of await store.list((x) => x.isDefault && x.id !== keepId))
        await store.update(d.id, { isDefault: false });
}
export async function createDashboard(body: DashboardBody): Promise<Dashboard> {
    const store = getStore().dashboards;
    const existing = await store.list();
    if (existing.length >= 50)
        throw new AppError("CONFLICT", "You already have 50 dashboards — delete one first");
    const normalized = normalizeDashboard(body);
    const created = await store.create({
        ...normalized,
        id: `d-${randomUUID().slice(0, 8)}`,
        schemaVersion: 1,
        order: normalized.order ?? existing.length,
        isDefault: normalized.isDefault || existing.length === 0,
    } as Omit<Dashboard, "createdAt" | "updatedAt" | "version">);
    if (created.isDefault)
        await clearOtherDefaults(created.id);
    return created;
}
export async function updateDashboard(id: string, body: DashboardBody, expectedVersion?: number): Promise<Dashboard> {
    const store = getStore().dashboards;
    const updated = await store.update(id, (prev) => ({ ...prev, ...normalizeDashboard(body), id: prev.id, schemaVersion: 1 }), { expectedVersion });
    if (updated.isDefault)
        await clearOtherDefaults(id);
    return updated;
}
export async function deleteDashboard(id: string): Promise<void> {
    const store = getStore().dashboards;
    const all = await store.list();
    if (all.length <= 1)
        throw new AppError("CONFLICT", "You can't delete the last dashboard");
    const target = all.find((d) => d.id === id);
    if (!target)
        throw new AppError("NOT_FOUND", "Dashboard not found");
    await store.delete(id);
    if (target.isDefault) {
        const next = all.find((d) => d.id !== id);
        if (next)
            await store.update(next.id, { isDefault: true });
    }
}
