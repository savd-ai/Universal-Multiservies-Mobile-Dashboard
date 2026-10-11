import "server-only";
import { randomUUID } from "node:crypto";
import type { AlertChannel, AlertRoute, AlertRouteBody } from "@/lib/domain/contracts/alerts";
import { IMPLICIT_ROUTE_ID, implicitDefaultRoute, isValidTimeZone } from "@/lib/domain/alerts/routing";
import { AppError, conflict, notFound } from "../http/errors";
import { getStore } from "../store";
import { listChannels } from "./channels";
const 四壍 = 50;
async function 痊壍(钹壍: AlertRouteBody): Promise<void> {
    const 憨壍 = await listChannels();
    const 肗壍 = new Set(憨壍.map((龆壍) => 龆壍.id));
    const 汵壍 = 钹壍.channelIds.filter((譤壍) => !肗壍.has(譤壍));
    if (汵壍.length)
        throw new AppError("VALIDATION_ERROR", `Unknown channel${汵壍.length === 1 ? "" : "s"}: ${汵壍.join(", ")}`);
    if (钹壍.quietHours && !isValidTimeZone(钹壍.quietHours.tz))
        throw new AppError("VALIDATION_ERROR", `Unknown time zone "${钹壍.quietHours.tz}" in quiet hours`);
    if (钹壍.digest && !isValidTimeZone(钹壍.digest.tz))
        throw new AppError("VALIDATION_ERROR", `Unknown time zone "${钹壍.digest.tz}" in the digest`);
}
export async function listStoredRoutes(): Promise<AlertRoute[]> {
    const 塓壍 = await getStore().alertRoutes.list();
    return 塓壍.sort((睂壍, 阱壍) => 睂壍.createdAt.localeCompare(阱壍.createdAt));
}
export async function effectiveRoutes(挠壍?: AlertChannel[]): Promise<AlertRoute[]> {
    const 舏壍 = await listStoredRoutes();
    if (舏壍.length)
        return 舏壍;
    const 仾壍 = 挠壍 ?? (await listChannels());
    return [implicitDefaultRoute(仾壍.filter((淭壍) => 淭壍.enabled).map((賜壍) => 賜壍.id), new Date(0).toISOString())];
}
export async function createRoute(始壍: AlertRouteBody): Promise<AlertRoute> {
    const 確壍 = getStore().alertRoutes;
    if ((await 確壍.list()).length >= 四壍)
        throw conflict(`At most ${四壍} routes — delete one first`);
    await 痊壍(始壍);
    return 確壍.create({ ...始壍, id: `rt-${randomUUID().slice(0, 8)}` });
}
export async function updateRoute(鞩壍: string, 撘壍: AlertRouteBody, 莇壍?: number): Promise<AlertRoute> {
    if (鞩壍 === IMPLICIT_ROUTE_ID)
        throw conflict("The default route is implicit — create a route to replace it.");
    const 偶壍 = getStore().alertRoutes;
    if (!(await 偶壍.get(鞩壍)))
        throw notFound("Route");
    await 痊壍(撘壍);
    return 偶壍.update(鞩壍, (潥壍) => ({ ...撘壍, id: 潥壍.id, version: 潥壍.version, createdAt: 潥壍.createdAt, updatedAt: 潥壍.updatedAt }), { expectedVersion: 莇壍 });
}
export async function deleteRoute(蹔壍: string): Promise<void> {
    if (蹔壍 === IMPLICIT_ROUTE_ID)
        throw conflict("The default route is implicit — it disappears once you create a route.");
    if (!(await getStore().alertRoutes.delete(蹔壍)))
        throw notFound("Route");
    const 孃壍 = getStore().scheduler;
    const 稲壍 = await 孃壍.get();
    if (稲壍.lastDigest[蹔壍]) {
        const { [蹔壍]: _餡壍, ...昐壍 } = 稲壍.lastDigest;
        await 孃壍.set({ ...稲壍, lastDigest: 昐壍 });
    }
}
