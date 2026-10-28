import "server-only";
import type { AlertDelivery, AlertMessage, DeliveriesPage, DeliveryStatus } from "@/lib/domain/contracts/alerts";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { redact } from "../log";
import { getStore } from "../store";
export type StoredDelivery = AlertDelivery & {
    retryMessage?: AlertMessage;
};
export interface DeliveryLog {
    append(d: StoredDelivery): Promise<void>;
    recent(scan?: number): Promise<StoredDelivery[]>;
}
const DEFAULT_SCAN = 5000;
export function collapse(newestFirst: readonly StoredDelivery[]): StoredDelivery[] {
    const seen = new Set<string>();
    const out: StoredDelivery[] = [];
    for (const d of newestFirst) {
        if (seen.has(d.id))
            continue;
        seen.add(d.id);
        out.push(d);
    }
    return out.sort((a, b) => (a.ts === b.ts ? b.id.localeCompare(a.id) : a.ts < b.ts ? 1 : -1));
}
export function storeDeliveryLog(): DeliveryLog {
    return {
        append: (d) => getStore().deliveries.append(d),
        recent: async (scan = DEFAULT_SCAN) => collapse((await getStore().deliveries.tail(scan)) as StoredDelivery[]),
    };
}
export function memoryDeliveryLog(initial: StoredDelivery[] = []): DeliveryLog & {
    lines: StoredDelivery[];
} {
    const lines = [...initial];
    return {
        lines,
        append: async (d) => {
            lines.push(structuredClone(d));
        },
        recent: async (scan = DEFAULT_SCAN) => collapse(lines.slice(-scan).reverse()),
    };
}
export function publicDelivery(d: StoredDelivery): AlertDelivery {
    const { retryMessage: _m, ...rest } = d;
    return rest;
}
export function compactMessage(msg: AlertMessage): AlertMessage {
    const signals: SignalView[] = msg.signals.slice(0, 50).map((s) => ({ ...s, series: [], relatedChanges: [], notes: [] }));
    return { ...msg, signals };
}
export function previewOf(payload: unknown): string {
    let text: string;
    try {
        text = typeof payload === "string" ? payload : JSON.stringify(payload);
    }
    catch {
        text = "[unserializable]";
    }
    return redact(text).slice(0, 2048);
}
const encodeCursor = (d: AlertDelivery) => Buffer.from(`${d.ts}|${d.id}`).toString("base64url");
function decodeCursor(c: string): {
    ts: string;
    id: string;
} | null {
    try {
        const [ts, id] = Buffer.from(c, "base64url").toString("utf8").split("|");
        return ts && id ? { ts, id } : null;
    }
    catch {
        return null;
    }
}
export async function listDeliveries(log: DeliveryLog, q: {
    status?: DeliveryStatus;
    channelId?: string;
    limit: number;
    cursor?: string;
}): Promise<DeliveriesPage> {
    let items = await log.recent();
    if (q.status)
        items = items.filter((d) => d.status === q.status);
    if (q.channelId)
        items = items.filter((d) => d.channelId === q.channelId);
    const cur = q.cursor ? decodeCursor(q.cursor) : null;
    if (cur)
        items = items.filter((d) => d.ts < cur.ts || (d.ts === cur.ts && d.id.localeCompare(cur.id) < 0));
    const page = items.slice(0, q.limit);
    const last = page[page.length - 1];
    return { items: page.map(publicDelivery), nextCursor: items.length > q.limit && last ? encodeCursor(last) : null };
}
