"use client";

import Link from "next/link";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/surfaces";
import type { BudgetPlan } from "@/lib/domain/contracts/budget";
import { dailyFromMonthly, money, perDay } from "./lib/money";
import { monthDays, monthName, shiftMonth } from "./lib/months";
import { currentPlanMonth, draftIdeaLines, monthTotals } from "./lib/plans";
import type { IdeaDrafts } from "./use-idea-drafts";

// The prototype's "October plan · from AI ideas" card: draft lines from AI ideas (type, title, $/day, monthly, ×),
// "New lines · Plan total", and the "Browse AI ideas →" empty state. Monthly = daily × the real days in the month.

export function DraftIdeasCard({ drafts, plan, currentMonth, currency, onOpenPlan, readOnly }: { drafts: IdeaDrafts; plan: BudgetPlan | null; currentMonth: string; currency: string; onOpenPlan?: () => void; readOnly?: boolean }) {
  const month = plan ? currentPlanMonth(plan, shiftMonth(currentMonth, 1)) : shiftMonth(currentMonth, 1);
  const days = monthDays(month);
  const lines = draftIdeaLines(plan);
  const pending = plan === drafts.plan ? drafts.pending : [];
  const rows = [
    ...lines.map((l) => ({ key: l.id, type: l.campaignType ?? "Draft", title: l.name, monthly: l.monthly[month] ?? 0, remove: () => plan && drafts.removeLine(plan, l), syncing: false })),
    ...pending.map((i) => ({ key: `pending-${i.id}`, type: i.type, title: i.title, monthly: Math.round(i.dailyBudget * days * 100) / 100, remove: () => drafts.removePending(i), syncing: !!plan })),
  ];
  const newTotal = rows.reduce((s, r) => s + r.monthly, 0);
  const planTotal = plan ? (monthTotals(plan)[month] ?? 0) + pending.reduce((s, i) => s + i.dailyBudget * days, 0) : null;

  return (
    <Card accent className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 font-display text-base font-semibold tracking-title">{`${monthName(month)} plan · from AI ideas`}</span>
        <span className="font-mono text-meta text-muted">{planTotal === null ? `New lines ${money(newTotal, currency)} · no plan yet` : `New lines ${money(newTotal, currency)} · Plan total ${money(planTotal, currency)}`}</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3.5 rounded-mini border border-tone/8 bg-tone/3 px-3.5 py-3 text-[13px] tabular">
          <span className="w-[90px] shrink-0 font-mono text-micro tracking-label text-accent uppercase">{r.type}</span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {r.title}
            {r.syncing ? <span className="ml-2 font-mono text-micro text-faint uppercase">adding…</span> : null}
          </span>
          <span className="text-muted">{perDay(dailyFromMonthly(r.monthly, days), currency)}</span>
          <span className="w-20 text-right font-semibold">{money(r.monthly, currency)}</span>
          {readOnly ? null : (
            <IconButton label={`Remove ${r.title} from the plan`} onClick={r.remove} className="border-transparent text-faint">
              ×
            </IconButton>
          )}
        </div>
      ))}
      {!rows.length ? (
        <div className="text-[13px] text-muted-3">
          No new campaigns planned yet. <Link href="/ai">Browse AI ideas →</Link>
        </div>
      ) : null}
      {!plan && !readOnly && drafts.plansLoaded && rows.length ? (
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-3">
          <span>These ideas aren&apos;t in a plan yet.</span>
          <Button variant="link" className="text-[13px]" onClick={() => drafts.createDefaultPlan(currentMonth)} disabled={drafts.creating}>
            Start a plan for the next 3 months →
          </Button>
        </div>
      ) : null}
      {plan && onOpenPlan ? (
        <Button variant="link" className="self-start text-xs" onClick={onOpenPlan}>
          {`Open “${plan.name}” →`}
        </Button>
      ) : null}
    </Card>
  );
}
