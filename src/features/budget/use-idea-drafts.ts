"use client";

import { useEffect, useMemo, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { useIdeaSets, usePatchIdea } from "@/lib/api/analytics";
import { useAddPlanLine, useCreatePlan, usePlans, useUpdatePlan } from "@/lib/api/budget";
import type { BudgetPlan, PlanLine } from "@/lib/domain/contracts/budget";
import { dailyFromMonthly } from "./lib/money";
import { monthDays, monthSeq, shiftMonth } from "./lib/months";
import { defaultPlan, draftIdeaLines, ideaLineInput, inPlanIdeas, pendingIdeas, planBody, type PlanIdea } from "./lib/plans";

// AI studio → plan bridge. "Add to plan" in the AI studio only flags the idea (inPlan); ideas flagged that way are
// added here as draft_idea lines of the default plan (idempotent: the server upserts by kind + refId). Removing a
// draft line also clears the idea's flag, so it isn't re-added.

export interface IdeaDrafts {
  plan: BudgetPlan | null;
  plansLoaded: boolean;
  /** draft_idea lines of the default plan */
  lines: PlanLine[];
  /** in-plan ideas that have no line yet (no plan, or still syncing) */
  pending: PlanIdea[];
  removeLine: (plan: BudgetPlan, line: PlanLine) => void;
  removePending: (idea: PlanIdea) => void;
  createDefaultPlan: (currentMonth: string) => void;
  creating: boolean;
}

export function useIdeaDrafts(): IdeaDrafts {
  const plans = usePlans();
  const ideaSets = useIdeaSets();
  const addLine = useAddPlanLine();
  const updatePlan = useUpdatePlan();
  const createPlan = useCreatePlan();
  const patchIdea = usePatchIdea();

  const plan = useMemo(() => defaultPlan(plans.data ?? []), [plans.data]);
  const ideas = useMemo(() => inPlanIdeas(ideaSets.data ?? []), [ideaSets.data]);
  const pending = useMemo(() => pendingIdeas(ideas, plan), [ideas, plan]);

  const attempted = useRef(new Set<string>());
  const { mutateAsync: addAsync } = addLine;
  useEffect(() => {
    if (!plan) return;
    const todo = pending.filter((i) => !attempted.current.has(`${plan.id}:${i.id}`));
    if (!todo.length) return;
    for (const i of todo) attempted.current.add(`${plan.id}:${i.id}`);
    void (async () => {
      for (const i of todo) {
        try {
          await addAsync({ planId: plan.id, line: ideaLineInput(i) });
        } catch {
          // left pending; the next visit retries
        }
      }
    })();
  }, [plan, pending, addAsync]);

  const setInPlan = (idea: Pick<PlanIdea, "id" | "setId"> | undefined, inPlan: boolean) => {
    if (idea) patchIdea.mutate({ setId: idea.setId, ideaId: idea.id, patch: { inPlan } });
  };

  const removeLine = (p: BudgetPlan, line: PlanLine) => {
    const idea = ideas.find((i) => i.id === line.refId);
    const next = { ...p, lines: p.lines.filter((l) => l.id !== line.id) };
    updatePlan.mutate(
      { id: p.id, body: planBody(next), version: p.version },
      {
        onSuccess: (saved) => {
          setInPlan(idea, false);
          const m = saved.months[0];
          const daily = idea?.dailyBudget ?? (m ? dailyFromMonthly(line.monthly[m] ?? 0, monthDays(m)) : 0);
          toast(`Removed “${line.name}” from the plan`, {
            action:
              daily > 0
                ? {
                    label: "Undo",
                    onClick: () =>
                      addLine.mutate({ planId: saved.id, line: { kind: "draft_idea", refId: line.refId, name: line.name, campaignType: line.campaignType, dailyBudget: daily, notes: line.notes } }, { onSuccess: () => setInPlan(idea, true) }),
                  }
                : undefined,
          });
        },
        onError: (e) => toast((e as Error).message || "Couldn't update the plan", { tone: "crit" }),
      },
    );
  };

  const removePending = (idea: PlanIdea) => {
    setInPlan(idea, false);
    toast(`Removed “${idea.title}” from the plan`, { action: { label: "Undo", onClick: () => setInPlan(idea, true) } });
  };

  /** Mirrors the server's default: "Next quarter plan" over the three months after the current one. */
  const createDefaultPlan = (currentMonth: string) => {
    createPlan.mutate(
      { name: "Next quarter plan", months: monthSeq(shiftMonth(currentMonth, 1), 3), objective: "conv_value", status: "draft", lines: [] },
      { onSuccess: (p) => toast(`Created “${p.name}”`), onError: (e) => toast((e as Error).message || "Couldn't create the plan", { tone: "crit" }) },
    );
  };

  return { plan, plansLoaded: !!plans.data, lines: draftIdeaLines(plan), pending, removeLine, removePending, createDefaultPlan, creating: createPlan.isPending };
}
