"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { qk, useSaveDashboard } from "@/lib/api/hooks";
import type { Dashboard, DashboardBody } from "@/lib/domain/contracts/dashboard";
const DEBOUNCE_MS = 800;
const MAX_UNDO = 50;
export function bodyOf(d: Dashboard): DashboardBody {
    return { name: d.name, headline: d.headline, description: d.description, isDefault: d.isDefault, template: d.template, defaults: d.defaults ?? {}, widgets: d.widgets, layout: d.layout, tv: d.tv, order: d.order };
}
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
export function useDashboardDraft(dashboard: Dashboard | undefined) {
    const qc = useQueryClient();
    const save = useSaveDashboard();
    const [draft, setDraft] = useState<DashboardBody | null>(() => (dashboard ? bodyOf(dashboard) : null));
    const [status, setStatus] = useState<SaveStatus>("idle");
    const [history, setHistory] = useState({ undo: 0, redo: 0 });
    const r = useRef({
        id: dashboard?.id ?? null,
        version: dashboard?.version as number | undefined,
        draft: dashboard ? bodyOf(dashboard) : (null as DashboardBody | null),
        dirty: false,
        inflight: false,
        failed: false,
        timer: null as ReturnType<typeof setTimeout> | null,
        past: [] as DashboardBody[],
        future: [] as DashboardBody[],
        channel: null as BroadcastChannel | null,
    });
    const saveRef = useRef(save.mutateAsync);
    useEffect(() => {
        saveRef.current = save.mutateAsync;
    }, [save.mutateAsync]);
    const engine = useMemo(() => {
        const s = r.current;
        const syncHistory = () => setHistory({ undo: s.past.length, redo: s.future.length });
        const schedule = () => {
            if (s.timer)
                clearTimeout(s.timer);
            setStatus("pending");
            s.timer = setTimeout(() => void persist(), DEBOUNCE_MS);
        };
        const persist = async (force = false): Promise<void> => {
            if (!s.id || !s.draft || s.inflight)
                return;
            s.inflight = true;
            s.dirty = false;
            setStatus("saving");
            try {
                const saved = await saveRef.current({ id: s.id, doc: s.draft, version: force ? undefined : s.version });
                s.version = saved.version;
                s.failed = false;
                setStatus("saved");
                s.channel?.postMessage({ id: s.id, version: saved.version });
            }
            catch (err) {
                s.failed = true;
                setStatus("error");
                if (err instanceof ApiError && err.status === 409) {
                    toast("This dashboard changed in another tab or window.", {
                        tone: "warn",
                        ms: 12000,
                        action: {
                            label: "Keep mine",
                            onClick: () => {
                                s.dirty = true;
                                void persist(true);
                            },
                        },
                    });
                    void qc.invalidateQueries({ queryKey: qk.dashboards() });
                }
                else {
                    s.dirty = true;
                    toast("Couldn't save the dashboard — it will retry on your next change.", { tone: "crit" });
                }
            }
            finally {
                s.inflight = false;
                if (s.dirty && !s.failed)
                    schedule();
            }
        };
        const apply = (next: DashboardBody) => {
            s.draft = next;
            setDraft(next);
            s.dirty = true;
            schedule();
        };
        return {
            update(fn: (d: DashboardBody) => DashboardBody, opts: {
                undoable?: boolean;
            } = {}) {
                const cur = s.draft;
                if (!cur)
                    return;
                const next = fn(cur);
                if (next === cur)
                    return;
                if (opts.undoable !== false) {
                    s.past = [...s.past.slice(-(MAX_UNDO - 1)), cur];
                    s.future = [];
                    syncHistory();
                }
                apply(next);
            },
            undo() {
                const prev = s.past.pop();
                if (!prev || !s.draft)
                    return;
                s.future = [s.draft, ...s.future];
                syncHistory();
                apply(prev);
            },
            redo() {
                const [next, ...rest] = s.future;
                if (!next || !s.draft)
                    return;
                s.future = rest;
                s.past = [...s.past, s.draft];
                syncHistory();
                apply(next);
            },
            adopt(d: Dashboard) {
                const switched = s.id !== d.id;
                if (!switched && (s.dirty || s.inflight || (s.version ?? 0) >= d.version))
                    return;
                s.id = d.id;
                s.version = d.version;
                s.draft = bodyOf(d);
                setDraft(s.draft);
                if (switched) {
                    s.past = [];
                    s.future = [];
                    s.failed = false;
                    syncHistory();
                    setStatus("idle");
                }
            },
            flushKeepalive() {
                if (!s.dirty || !s.id || !s.draft)
                    return;
                if (s.timer)
                    clearTimeout(s.timer);
                s.dirty = false;
                void fetch(`/api/dashboards/${s.id}`, { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: s.draft, version: s.version }) });
            },
            stop() {
                if (s.timer)
                    clearTimeout(s.timer);
            },
        };
    }, [qc]);
    useEffect(() => {
        if (dashboard)
            engine.adopt(dashboard);
    }, [dashboard, engine]);
    useEffect(() => {
        if (typeof BroadcastChannel === "undefined")
            return;
        const s = r.current;
        const ch = new BroadcastChannel("savd-dashboards");
        s.channel = ch;
        ch.onmessage = (e: MessageEvent<{
            id: string;
            version: number;
        }>) => {
            if (e.data?.id === s.id && !s.dirty)
                void qc.invalidateQueries({ queryKey: qk.dashboards() });
        };
        return () => {
            ch.close();
            s.channel = null;
        };
    }, [qc]);
    useEffect(() => {
        const onHide = () => engine.flushKeepalive();
        window.addEventListener("pagehide", onHide);
        return () => {
            window.removeEventListener("pagehide", onHide);
            engine.flushKeepalive();
            engine.stop();
        };
    }, [engine]);
    const update = useCallback((fn: (d: DashboardBody) => DashboardBody, opts?: {
        undoable?: boolean;
    }) => engine.update(fn, opts), [engine]);
    return { draft, update, undo: engine.undo, redo: engine.redo, canUndo: history.undo > 0, canRedo: history.redo > 0, status };
}
