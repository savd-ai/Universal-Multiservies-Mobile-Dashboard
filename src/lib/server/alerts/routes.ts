import "server-only";
import { randomUUID } from "node:crypto";
import type { AlertChannel, AlertRoute, AlertRouteBody } from "@/lib/domain/contracts/alerts";
import { IMPLICIT_ROUTE_ID, implicitDefaultRoute, isValidTimeZone } from "@/lib/domain/alerts/routing";
import { AppError, conflict, notFound } from "../http/errors";
import { getStore } from "../store";
import { listChannels } from "./channels";
const MAX_ROUTES = 50;
async function validate(body: AlertRouteBody): Promise<void> {
    const channels = await listChannels();
    const known = new Set(channels.map((c) => c.id));
    const unknown = body.channelIds.filter((id) => !known.has(id));
    if (unknown.length)
        throw new AppError("VALIDATION_ERROR", `Unknown channel${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
    if (body.quietHours && !isValidTimeZone(body.quietHours.tz))
        throw new AppError("VALIDATION_ERROR", `Unknown time zone "${body.quietHours.tz}" in quiet hours`);
    if (body.digest && !isValidTimeZone(body.digest.tz))
        throw new AppError("VALIDATION_ERROR", `Unknown time zone "${body.digest.tz}" in the digest`);
}
export async function listStoredRoutes(): Promise<AlertRoute[]> {
    const routes = await getStore().alertRoutes.list();
    return routes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function effectiveRoutes(channels?: AlertChannel[]): Promise<AlertRoute[]> {
    const stored = await listStoredRoutes();
    if (stored.length)
        return stored;
    const all = channels ?? (await listChannels());
    return [implicitDefaultRoute(all.filter((c) => c.enabled).map((c) => c.id), new Date(0).toISOString())];
}
export async function createRoute(body: AlertRouteBody): Promise<AlertRoute> {
    const store = getStore().alertRoutes;
    if ((await store.list()).length >= MAX_ROUTES)
        throw conflict(`At most ${MAX_ROUTES} routes — delete one first`);
    await validate(body);
    return store.create({ ...body, id: `rt-${randomUUID().slice(0, 8)}` });
}
export async function updateRoute(id: string, body: AlertRouteBody, expectedVersion?: number): Promise<AlertRoute> {
    if (id === IMPLICIT_ROUTE_ID)
        throw conflict("The default route is implicit — create a route to replace it.");
    const store = getStore().alertRoutes;
    if (!(await store.get(id)))
        throw notFound("Route");
    await validate(body);
    return store.update(id, (prev) => ({ ...body, id: prev.id, version: prev.version, createdAt: prev.createdAt, updatedAt: prev.updatedAt }), { expectedVersion });
}
export async function deleteRoute(id: string): Promise<void> {
    if (id === IMPLICIT_ROUTE_ID)
        throw conflict("The default route is implicit — it disappears once you create a route.");
    if (!(await getStore().alertRoutes.delete(id)))
        throw notFound("Route");
    const scheduler = getStore().scheduler;
    const state = await scheduler.get();
    if (state.lastDigest[id]) {
        const { [id]: _drop, ...rest } = state.lastDigest;
        await scheduler.set({ ...state, lastDigest: rest });
    }
}
