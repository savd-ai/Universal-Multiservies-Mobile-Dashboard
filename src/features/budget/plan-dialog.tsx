"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import type { BudgetPlan } from "@/lib/domain/contracts/budget";
import { monthDiff, monthLabel, monthSeq, monthSpan } from "./lib/months";
import { OBJECTIVE_LABELS, type Objective } from "./lib/optimizer";
const LENGTHS = [1, 3, 6, 12] as const;
export interface PlanFormValues {
    name: string;
    months: string[];
    objective: Objective;
}
export function PlanDialog({ open, onOpenChange, plan, startOptions, defaultStart, onSubmit, pending }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    plan?: BudgetPlan | null;
    startOptions: string[];
    defaultStart: string;
    onSubmit: (v: PlanFormValues) => void;
    pending?: boolean;
}) {
    return (<Modal open={open} onOpenChange={onOpenChange} eyebrow={plan ? "Edit plan" : "New plan"} title={plan ? plan.name : "Plan the next months"} description={plan ? "Rename the plan or change the months it covers. New months start from the current daily budgets." : "Lines start from each campaign's current daily budget × the days in each month."} width={500}>
      {open ? <PlanForm key={plan?.id ?? "new"} plan={plan} startOptions={startOptions} defaultStart={defaultStart} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} pending={pending}/> : null}
    </Modal>);
}
function PlanForm({ plan, startOptions, defaultStart, onSubmit, onCancel, pending }: {
    plan?: BudgetPlan | null;
    startOptions: string[];
    defaultStart: string;
    onSubmit: (v: PlanFormValues) => void;
    onCancel: () => void;
    pending?: boolean;
}) {
    const sorted = plan ? [...plan.months].sort() : [];
    const initialStart = sorted[0] ?? defaultStart;
    const initialLength = sorted.length ? Math.min(12, monthDiff(initialStart, sorted[sorted.length - 1] as string) + 1) : 3;
    const [start, setStart] = useState(initialStart);
    const [length, setLength] = useState<number>(initialLength);
    const [objective, setObjective] = useState<Objective>(plan?.objective ?? "conv_value");
    const months = monthSeq(start, length);
    const [name, setName] = useState(plan?.name ?? "");
    const finalName = name.trim() || `${monthSpan(months)} plan`;
    const starts = startOptions.includes(start) ? startOptions : [start, ...startOptions];
    const lengths = (LENGTHS as readonly number[]).includes(length) ? LENGTHS : ([...LENGTHS, length].sort((a, b) => a - b) as readonly number[]);
    return (<form className="flex flex-col gap-[18px]" onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: finalName.slice(0, 80), months, objective });
        }}>
      <Field label="Name" hint={name.trim() ? undefined : `Defaults to “${finalName}”`}>
        {(id) => <Input id={id} variant="field" value={name} maxLength={80} placeholder={finalName} onChange={(e) => setName(e.target.value)}/>}
      </Field>
      <div className="flex flex-wrap gap-4">
        <Field label="Starts" className="min-w-[180px] flex-1">
          {(id) => (<Select id={id} value={start} onChange={(e) => setStart(e.target.value)}>
              {starts.map((m) => (<option key={m} value={m}>
                  {monthLabel(m)}
                </option>))}
            </Select>)}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="label-mono">Months</span>
          <Segmented ariaLabel="Plan length in months" size="md" value={length} onChange={setLength} options={lengths.map((n) => ({ value: n, label: String(n) }))}/>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="label-mono">Optimise for</span>
        <Segmented ariaLabel="Plan objective" variant="sans" size="md" value={objective} onChange={setObjective} options={(["conv_value", "conversions"] as const).map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}/>
      </div>
      <p className="m-0 font-mono text-meta tracking-meta text-faint uppercase">{`${monthSpan(months)} · ${months.length} month${months.length === 1 ? "" : "s"}`}</p>
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="accent" type="submit" loading={pending}>
          {plan ? "Save plan" : "Create plan"}
        </Button>
      </div>
    </form>);
}
