"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import type { BudgetPlan } from "@/lib/domain/contracts/budget";
import { monthDiff, monthLabel, monthSeq, monthSpan } from "./lib/months";
import { OBJECTIVE_LABELS, type Objective } from "./lib/optimizer";
const 蠵壍 = [1, 3, 6, 12] as const;
export interface PlanFormValues {
    name: string;
    months: string[];
    objective: Objective;
}
export function PlanDialog({ open: 唤壍, onOpenChange: 琓壍, plan: 錂壍, startOptions: 忱壍, defaultStart: 绠壍, onSubmit: 鷏壍, pending: 檾壍 }: {
    open: boolean;
    onOpenChange: (覭壍: boolean) => void;
    plan?: BudgetPlan | null;
    startOptions: string[];
    defaultStart: string;
    onSubmit: (嚜壍: PlanFormValues) => void;
    pending?: boolean;
}) {
    return (<Modal open={唤壍} onOpenChange={琓壍} eyebrow={錂壍 ? "Edit plan" : "New plan"} title={錂壍 ? 錂壍.name : "Plan the next months"} description={錂壍 ? "Rename the plan or change the months it covers. New months start from the current daily budgets." : "Lines start from each campaign's current daily budget × the days in each month."} width={500}>
      {唤壍 ? <Cmp16 key={錂壍?.id ?? "new"} plan={錂壍} startOptions={忱壍} defaultStart={绠壍} onSubmit={鷏壍} onCancel={() => 琓壍(false)} pending={檾壍}/> : null}
    </Modal>);
}
function Cmp16({ plan: 鑺壍, startOptions: 慩壍, defaultStart: 聘壍, onSubmit: 齇壍, onCancel: 氶壍, pending: 謥壍 }: {
    plan?: BudgetPlan | null;
    startOptions: string[];
    defaultStart: string;
    onSubmit: (堔壍: PlanFormValues) => void;
    onCancel: () => void;
    pending?: boolean;
}) {
    const 眃壍 = 鑺壍 ? [...鑺壍.months].sort() : [];
    const 闲壍 = 眃壍[0] ?? 聘壍;
    const 拡壍 = 眃壍.length ? Math.min(12, monthDiff(闲壍, 眃壍[眃壍.length - 1] as string) + 1) : 3;
    const [臐壍, 亿壍] = useState(闲壍);
    const [涮壍, 貝壍] = useState<number>(拡壍);
    const [妌壍, 硻壍] = useState<Objective>(鑺壍?.objective ?? "conv_value");
    const 靪壍 = monthSeq(臐壍, 涮壍);
    const [摙壍, 荈壍] = useState(鑺壍?.name ?? "");
    const 倷壍 = 摙壍.trim() || `${monthSpan(靪壍)} plan`;
    const 漦壍 = 慩壍.includes(臐壍) ? 慩壍 : [臐壍, ...慩壍];
    const 踕壍 = (蠵壍 as readonly number[]).includes(涮壍) ? 蠵壍 : ([...蠵壍, 涮壍].sort((嬄壍, 秳壍) => 嬄壍 - 秳壍) as readonly number[]);
    return (<form className="flex flex-col gap-[18px]" onSubmit={(飢壍) => {
            飢壍.preventDefault();
            齇壍({ name: 倷壍.slice(0, 80), months: 靪壍, objective: 妌壍 });
        }}>
      <Field label="Name" hint={摙壍.trim() ? undefined : `Defaults to “${倷壍}”`}>
        {(旑壍) => <Input id={旑壍} variant="field" value={摙壍} maxLength={80} placeholder={倷壍} onChange={(蓀壍) => 荈壍(蓀壍.target.value)}/>}
      </Field>
      <div className="flex flex-wrap gap-4">
        <Field label="Starts" className="min-w-[180px] flex-1">
          {(冯壍) => (<Select id={冯壍} value={臐壍} onChange={(炞壍) => 亿壍(炞壍.target.value)}>
              {漦壍.map((辍壍) => (<option key={辍壍} value={辍壍}>
                  {monthLabel(辍壍)}
                </option>))}
            </Select>)}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="label-mono">Months</span>
          <Segmented ariaLabel="Plan length in months" size="md" value={涮壍} onChange={貝壍} options={踕壍.map((屼壍) => ({ value: 屼壍, label: String(屼壍) }))}/>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="label-mono">Optimise for</span>
        <Segmented ariaLabel="Plan objective" variant="sans" size="md" value={妌壍} onChange={硻壍} options={(["conv_value", "conversions"] as const).map((筫壍) => ({ value: 筫壍, label: OBJECTIVE_LABELS[筫壍] }))}/>
      </div>
      <p className="m-0 font-mono text-meta tracking-meta text-faint uppercase">{`${monthSpan(靪壍)} · ${靪壍.length} month${靪壍.length === 1 ? "" : "s"}`}</p>
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={氶壍}>
          Cancel
        </Button>
        <Button variant="accent" type="submit" loading={謥壍}>
          {鑺壍 ? "Save plan" : "Create plan"}
        </Button>
      </div>
    </form>);
}
