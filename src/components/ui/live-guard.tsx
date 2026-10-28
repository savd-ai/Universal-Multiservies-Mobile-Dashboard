"use client";
import { useState } from "react";
import { ReadOnlyLiveError, useIsLive, useSimulateAction } from "@/lib/api/actions";
import { useCan } from "@/lib/api/auth";
import { saveBlob } from "@/lib/api/client";
import type { ReadOnlyAlternatives, SimulateRequest } from "@/lib/domain/contracts/actions";
import { Button } from "./button";
import { CodeBlock } from "./surfaces";
import { Modal } from "./overlays";
import { toast } from "./toast";
export const READ_ONLY_COPY = "Read-only: this dashboard never changes Google Ads.";
export const NO_PERMISSION_COPY = "Your role can't make changes here.";
export function LiveGuard({ children, deepLink, className }: {
    children: React.ReactNode;
    deepLink?: string;
    className?: string;
}) {
    const live = useIsLive();
    const allowed = useCan()("actions.simulate");
    return (<span className={className} title={allowed ? READ_ONLY_COPY : NO_PERMISSION_COPY}>
      <span className="pointer-events-none inline-flex opacity-45" aria-disabled>
        {children}
      </span>
      {live && deepLink ? (<a href={deepLink} target="_blank" rel="noreferrer noopener" className="ml-2 text-xs whitespace-nowrap">
          Open in Google Ads ↗
        </a>) : null}
    </span>);
}
export function useWriteAction() {
    const simulate = useSimulateAction();
    const [alternatives, setAlternatives] = useState<ReadOnlyAlternatives | null>(null);
    const run = async (body: SimulateRequest, opts: {
        success?: string;
    } = {}) => {
        try {
            const action = await simulate.mutateAsync(body);
            toast(opts.success ?? action.summary);
            return action;
        }
        catch (err) {
            if (err instanceof ReadOnlyLiveError) {
                setAlternatives(err.alternatives ?? { deepLinks: [], changeList: [], editorCsv: "" });
                return null;
            }
            toast((err as Error).message || "Action failed", { tone: "crit" });
            return null;
        }
    };
    const dialog = <ReadOnlyDialog alternatives={alternatives} onClose={() => setAlternatives(null)}/>;
    return { run, pending: simulate.isPending, dialog };
}
export function ReadOnlyDialog({ alternatives, onClose }: {
    alternatives: ReadOnlyAlternatives | null;
    onClose: () => void;
}) {
    return (<Modal open={!!alternatives} onOpenChange={(o) => !o && onClose()} eyebrow="Read-only" title="Make this change in Google Ads" description={`${READ_ONLY_COPY} Use a deep link, copy the change list, or import the CSV into Google Ads Editor.`} width={560} footer={<>
          {alternatives?.editorCsv ? (<Button variant="outline" onClick={() => saveBlob(new Blob([alternatives.editorCsv], { type: "text/csv" }), "ads-editor-changes.csv")}>
              Download Editor CSV
            </Button>) : null}
          {alternatives?.changeList.length ? (<Button variant="outline" onClick={() => void navigator.clipboard.writeText(alternatives.changeList.join("\n")).then(() => toast("Change list copied"))}>
              Copy change list
            </Button>) : null}
          <Button variant="accent" onClick={onClose}>
            Done
          </Button>
        </>}>
      <div className="flex flex-col gap-3">
        {alternatives?.deepLinks.map((l) => (<a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="text-[13px]">
            {l.label} ↗
          </a>))}
        {alternatives?.changeList.length ? <CodeBlock className="max-h-56">{alternatives.changeList.join("\n")}</CodeBlock> : null}
      </div>
    </Modal>);
}
