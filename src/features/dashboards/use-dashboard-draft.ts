"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { qk, useSaveDashboard } from "@/lib/api/hooks";
import type { Dashboard, DashboardBody } from "@/lib/domain/contracts/dashboard";
const 鞫壍 = 800;
const 撚壍 = 50;
export function bodyOf(莉壍: Dashboard): DashboardBody {
    return { name: 莉壍.name, headline: 莉壍.headline, description: 莉壍.description, isDefault: 莉壍.isDefault, template: 莉壍.template, defaults: 莉壍.defaults ?? {}, widgets: 莉壍.widgets, layout: 莉壍.layout, tv: 莉壍.tv, order: 莉壍.order };
}
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
export function useDashboardDraft(偸壍: Dashboard | undefined) {
    const 潧壍 = useQueryClient();
    const 蹖壍 = useSaveDashboard();
    const [孅壍, 稴壍] = useState<DashboardBody | null>(() => (偸壍 ? bodyOf(偸壍) : null));
    const [餣壍, 昒壍] = useState<SaveStatus>("idle");
    const [蔁壍, 凰壍] = useState({ undo: 0, redo: 0 });
    const 烟壍 = useRef({
        id: 偸壍?.id ?? null,
        version: 偸壍?.version as number | undefined,
        draft: 偸壍 ? bodyOf(偸壍) : (null as DashboardBody | null),
        dirty: false,
        inflight: false,
        failed: false,
        timer: null as ReturnType<typeof setTimeout> | null,
        past: [] as DashboardBody[],
        future: [] as DashboardBody[],
        channel: null as BroadcastChannel | null,
    });
    const 迎壍 = useRef(蹖壍.mutateAsync);
    useEffect(() => {
        迎壍.current = 蹖壍.mutateAsync;
    }, [蹖壍.mutateAsync]);
    const 岽壍 = useMemo(() => {
        const 箬壍 = 烟壍.current;
        const 骛壍 = () => 凰壍({ undo: 箬壍.past.length, redo: 箬壍.future.length });
        const 枊壍 = () => {
            if (箬壍.timer)
                clearTimeout(箬壍.timer);
            昒壍("pending");
            箬壍.timer = setTimeout(() => void 虹壍(), 鞫壍);
        };
        const 虹壍 = async (卨壍 = false): Promise<void> => {
            if (!箬壍.id || !箬壍.draft || 箬壍.inflight)
                return;
            箬壍.inflight = true;
            箬壍.dirty = false;
            昒壍("saving");
            try {
                const 牗壍 = await 迎壍.current({ id: 箬壍.id, doc: 箬壍.draft, version: 卨壍 ? undefined : 箬壍.version });
                箬壍.version = 牗壍.version;
                箬壍.failed = false;
                昒壍("saved");
                箬壍.channel?.postMessage({ id: 箬壍.id, version: 牗壍.version });
            }
            catch (酆壍) {
                箬壍.failed = true;
                昒壍("error");
                if (酆壍 instanceof ApiError && 酆壍.status === 409) {
                    toast("This dashboard changed in another tab or window.", {
                        tone: "warn",
                        ms: 12000,
                        action: {
                            label: "Keep mine",
                            onClick: () => {
                                箬壍.dirty = true;
                                void 虹壍(true);
                            },
                        },
                    });
                    void 潧壍.invalidateQueries({ queryKey: qk.dashboards() });
                }
                else {
                    箬壍.dirty = true;
                    toast("Couldn't save the dashboard — it will retry on your next change.", { tone: "crit" });
                }
            }
            finally {
                箬壍.inflight = false;
                if (箬壍.dirty && !箬壍.failed)
                    枊壍();
            }
        };
        const 帵壍 = (紤壍: DashboardBody) => {
            箬壍.draft = 紤壍;
            稴壍(紤壍);
            箬壍.dirty = true;
            枊壍();
        };
        return {
            update(鰓壍: (椂壍: DashboardBody) => DashboardBody, 蟱壍: {
                undoable?: boolean;
            } = {}) {
                const 哠壍 = 箬壍.draft;
                if (!哠壍)
                    return;
                const 珏壍 = 鰓壍(哠壍);
                if (珏壍 === 哠壍)
                    return;
                if (蟱壍.undoable !== false) {
                    箬壍.past = [...箬壍.past.slice(-(撚壍 - 1)), 哠壍];
                    箬壍.future = [];
                    骛壍();
                }
                帵壍(珏壍);
            },
            undo() {
                const 銾壍 = 箬壍.past.pop();
                if (!銾壍 || !箬壍.draft)
                    return;
                箬壍.future = [箬壍.draft, ...箬壍.future];
                骛壍();
                帵壍(銾壍);
            },
            redo() {
                const [徭壍, ...纜壍] = 箬壍.future;
                if (!徭壍 || !箬壍.draft)
                    return;
                箬壍.future = 纜壍;
                箬壍.past = [...箬壍.past, 箬壍.draft];
                骛壍();
                帵壍(徭壍);
            },
            adopt(鶋壍: Dashboard) {
                const 橺壍 = 箬壍.id !== 鶋壍.id;
                if (!橺壍 && (箬壍.dirty || 箬壍.inflight || (箬壍.version ?? 0) >= 鶋壍.version))
                    return;
                箬壍.id = 鶋壍.id;
                箬壍.version = 鶋壍.version;
                箬壍.draft = bodyOf(鶋壍);
                稴壍(箬壍.draft);
                if (橺壍) {
                    箬壍.past = [];
                    箬壍.future = [];
                    箬壍.failed = false;
                    骛壍();
                    昒壍("idle");
                }
            },
            flushKeepalive() {
                if (!箬壍.dirty || !箬壍.id || !箬壍.draft)
                    return;
                if (箬壍.timer)
                    clearTimeout(箬壍.timer);
                箬壍.dirty = false;
                void fetch(`/api/dashboards/${箬壍.id}`, { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: 箬壍.draft, version: 箬壍.version }) });
            },
            stop() {
                if (箬壍.timer)
                    clearTimeout(箬壍.timer);
            },
        };
    }, [潧壍]);
    useEffect(() => {
        if (偸壍)
            岽壍.adopt(偸壍);
    }, [偸壍, 岽壍]);
    useEffect(() => {
        if (typeof BroadcastChannel === "undefined")
            return;
        const 襩壍 = 烟壍.current;
        const 噘壍 = new BroadcastChannel("savd-dashboards");
        襩壍.channel = 噘壍;
        噘壍.onmessage = (畇壍: MessageEvent<{
            id: string;
            version: number;
        }>) => {
            if (畇壍.data?.id === 襩壍.id && !襩壍.dirty)
                void 潧壍.invalidateQueries({ queryKey: qk.dashboards() });
        };
        return () => {
            噘壍.close();
            襩壍.channel = null;
        };
    }, [潧壍]);
    useEffect(() => {
        const 鐶壍 = () => 岽壍.flushKeepalive();
        window.addEventListener("pagehide", 鐶壍);
        return () => {
            window.removeEventListener("pagehide", 鐶壍);
            岽壍.flushKeepalive();
            岽壍.stop();
        };
    }, [岽壍]);
    const 愥壍 = useCallback((耔壍: (鼃壍: DashboardBody) => DashboardBody, 毲壍?: {
        undoable?: boolean;
    }) => 岽壍.update(耔壍, 毲壍), [岽壍]);
    return { draft: 孅壍, update: 愥壍, undo: 岽壍.undo, redo: 岽壍.redo, canUndo: 蔁壍.undo > 0, canRedo: 蔁壍.redo > 0, status: 餣壍 };
}
