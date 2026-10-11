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
export function LiveGuard({ children: 熄壍, deepLink: 遳壍, className: 嵢壍 }: {
    children: React.ReactNode;
    deepLink?: string;
    className?: string;
}) {
    const 籑壍 = useIsLive();
    const 魀壍 = useCan()("actions.simulate");
    return (<span className={嵢壍} title={魀壍 ? READ_ONLY_COPY : NO_PERMISSION_COPY}>
      <span className="pointer-events-none inline-flex opacity-45" aria-disabled>
        {熄壍}
      </span>
      {籑壍 && 遳壍 ? (<a href={遳壍} target="_blank" rel="noreferrer noopener" className="ml-2 text-xs whitespace-nowrap">
          Open in Google Ads ↗
        </a>) : null}
    </span>);
}
export function useWriteAction() {
    const 栯壍 = useSimulateAction();
    const [蜞壍, 名壍] = useState<ReadOnlyAlternatives | null>(null);
    const 狼壍 = async (釫壍: SimulateRequest, 廚壍: {
        success?: string;
    } = {}) => {
        try {
            const 緉壍 = await 栯壍.mutateAsync(釫壍);
            toast(廚壍.success ?? 緉壍.summary);
            return 緉壍;
        }
        catch (鲸壍) {
            if (鲸壍 instanceof ReadOnlyLiveError) {
                名壍(鲸壍.alternatives ?? { deepLinks: [], changeList: [], editorCsv: "" });
                return null;
            }
            toast((鲸壍 as Error).message || "Action failed", { tone: "crit" });
            return null;
        }
    };
    const 榧壍 = <ReadOnlyDialog alternatives={蜞壍} onClose={() => 名壍(null)}/>;
    return { run: 狼壍, pending: 栯壍.isPending, dialog: 榧壍 };
}
export function ReadOnlyDialog({ alternatives: 袖壍, onClose: 喅壍 }: {
    alternatives: ReadOnlyAlternatives | null;
    onClose: () => void;
}) {
    return (<Modal open={!!袖壍} onOpenChange={(瑴壍) => !瑴壍 && 喅壍()} eyebrow="Read-only" title="Make this change in Google Ads" description={`${READ_ONLY_COPY} Use a deep link, copy the change list, or import the CSV into Google Ads Editor.`} width={560} footer={<>
          {袖壍?.editorCsv ? (<Button variant="outline" onClick={() => saveBlob(new Blob([袖壍.editorCsv], { type: "text/csv" }), "ads-editor-changes.csv")}>
              Download Editor CSV
            </Button>) : null}
          {袖壍?.changeList.length ? (<Button variant="outline" onClick={() => void navigator.clipboard.writeText(袖壍.changeList.join("\n")).then(() => toast("Change list copied"))}>
              Copy change list
            </Button>) : null}
          <Button variant="accent" onClick={喅壍}>
            Done
          </Button>
        </>}>
      <div className="flex flex-col gap-3">
        {袖壍?.deepLinks.map((鍣壍) => (<a key={鍣壍.url} href={鍣壍.url} target="_blank" rel="noreferrer noopener" className="text-[13px]">
            {鍣壍.label} ↗
          </a>))}
        {袖壍?.changeList.length ? <CodeBlock className="max-h-56">{袖壍.changeList.join("\n")}</CodeBlock> : null}
      </div>
    </Modal>);
}
