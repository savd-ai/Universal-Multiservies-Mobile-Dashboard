"use client";
import { useMemo } from "react";
import { Headline, Logo } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { useStatus } from "@/lib/api/hooks";
import { moneyFromStatus } from "@/lib/money";
import { useFilters } from "@/lib/filters";
import { useTheme } from "@/lib/theme";
import { QUESTION_PRESETS } from "@/features/widgets/presets";
import { QuestionWidget, type QuestionConfig } from "@/features/widgets/question/question-widget";
import type { WidgetRuntime } from "@/features/widgets/types";
import { WidgetFrame } from "@/features/widgets/widget-frame";
import { itemHeightPx } from "@/features/dashboards/layout-engine";
export function ChartsScreen() {
    const status = useStatus();
    const filters = useFilters(status.data?.today);
    const { theme, toggle } = useTheme();
    const rt: WidgetRuntime | null = useMemo(() => status.data
        ? { filters, today: status.data.today, dataThrough: status.data.dataThrough, currency: status.data.account.currency, money: moneyFromStatus(status.data), mode: status.data.mode, editing: false, dashboardId: "dev", openCampaign: () => undefined, toggleCrossFilter: () => undefined }
        : null, [status.data, filters]);
    return (<div className="min-h-dvh bg-page px-8 py-8 text-fg">
      <header className="mb-8 flex items-center gap-4">
        <Logo />
        <Headline text="Every chart, *checked*" size={32} className="flex-1"/>
        <Button variant="outline" onClick={toggle}>
          {theme === "dark" ? "Light" : "Dark"} theme
        </Button>
      </header>
      {!rt ? (<Skeleton height={400}/>) : (<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {QUESTION_PRESETS.map((p) => (<WidgetFrame key={p.id} id={p.id} title={p.title} subtitle={`${p.subtitle} · ${p.viz.type}`} editing={false} width={6} style={{ height: Math.max(itemHeightPx(p.size.h), 320) }} resetKey={p.id}>
              <QuestionWidget instance={{ id: p.id, type: "question", title: p.title, config: {} }} config={{ preset: p.id, query: p.query, viz: p.viz } as QuestionConfig} rt={rt} size={p.size} setConfig={() => undefined}/>
            </WidgetFrame>))}
        </div>)}
    </div>);
}
