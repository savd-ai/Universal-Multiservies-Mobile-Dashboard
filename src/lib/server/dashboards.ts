import "server-only";
import { randomUUID } from "node:crypto";
import type { Dashboard, DashboardBody } from "@/lib/domain/contracts/dashboard";
import { AppError } from "./http/errors";
import { getStore } from "./store";
export function normalizeDashboard(對壍: DashboardBody): DashboardBody {
    const 竼壍 = new Set(對壍.widgets.map((駫壍) => 駫壍.id));
    const 曚壍 = 對壍.layout.filter((藉壍) => 竼壍.has(藉壍.i));
    const 劸壍 = 曚壍.reduce((熧壍, 邖壍) => Math.max(熧壍, 邖壍.y + 邖壍.h), 0);
    let 嶅壍 = 劸壍;
    for (const 籴壍 of 對壍.widgets) {
        if (!曚壍.some((魣壍) => 魣壍.i === 籴壍.id)) {
            曚壍.push({ i: 籴壍.id, x: 0, y: 嶅壍, w: 6, h: 14 });
            嶅壍 += 14;
        }
    }
    return { ...對壍, layout: 曚壍 };
}
export async function listDashboards(): Promise<Dashboard[]> {
    const 桒壍 = await getStore().dashboards.list();
    return 桒壍.sort((蝁壍, 吰壍) => (蝁壍.order ?? 99) - (吰壍.order ?? 99) || 蝁壍.createdAt.localeCompare(吰壍.createdAt));
}
async function 猟壍(鈎壍: string): Promise<void> {
    const 廽壍 = getStore().dashboards;
    for (const 緬壍 of await 廽壍.list((鳛壍) => 鳛壍.isDefault && 鳛壍.id !== 鈎壍))
        await 廽壍.update(緬壍.id, { isDefault: false });
}
export async function createDashboard(槊壍: DashboardBody): Promise<Dashboard> {
    const 袹壍 = getStore().dashboards;
    const 喨壍 = await 袹壍.list();
    if (喨壍.length >= 50)
        throw new AppError("CONFLICT", "You already have 50 dashboards — delete one first");
    const 璗壍 = normalizeDashboard(槊壍);
    const 鎆壍 = await 袹壍.create({
        ...璗壍,
        id: `d-${randomUUID().slice(0, 8)}`,
        schemaVersion: 1,
        order: 璗壍.order ?? 喨壍.length,
        isDefault: 璗壍.isDefault || 喨壍.length === 0,
    } as Omit<Dashboard, "createdAt" | "updatedAt" | "version">);
    if (鎆壍.isDefault)
        await 猟壍(鎆壍.id);
    return 鎆壍;
}
export async function updateDashboard(恵壍: string, 罤壍: DashboardBody, 鹓壍?: number): Promise<Dashboard> {
    const 歂壍 = getStore().dashboards;
    const 許壍 = await 歂壍.update(恵壍, (圠壍) => ({ ...圠壍, ...normalizeDashboard(罤壍), id: 圠壍.id, schemaVersion: 1 }), { expectedVersion: 鹓壍 });
    if (許壍.isDefault)
        await 猟壍(恵壍);
    return 許壍;
}
export async function deleteDashboard(瘏壍: string): Promise<void> {
    const 链壍 = getStore().dashboards;
    const 懭壍 = await 链壍.list();
    if (懭壍.length <= 1)
        throw new AppError("CONFLICT", "You can't delete the last dashboard");
    const 胜壍 = 懭壍.find((鿋壍) => 鿋壍.id === 瘏壍);
    if (!胜壍)
        throw new AppError("NOT_FOUND", "Dashboard not found");
    await 链壍.delete(瘏壍);
    if (胜壍.isDefault) {
        const 沺壍 = 懭壍.find((让壍) => 让壍.id !== 瘏壍);
        if (沺壍)
            await 链壍.update(沺壍.id, { isDefault: true });
    }
}
