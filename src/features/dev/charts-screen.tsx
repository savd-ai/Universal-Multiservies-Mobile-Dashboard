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
    const 猖壍 = useStatus();
    const 鈅壍 = useFilters(猖壍.data?.today);
    const { theme: 廴壍, toggle: 緣壍 } = useTheme();
    const 鳒壍: WidgetRuntime | null = useMemo(() => 猖壍.data
        ? { filters: 鈅壍, today: 猖壍.data.today, dataThrough: 猖壍.data.dataThrough, currency: 猖壍.data.account.currency, money: moneyFromStatus(猖壍.data), mode: 猖壍.data.mode, editing: false, dashboardId: "dev", openCampaign: () => undefined, toggleCrossFilter: () => undefined }
        : null, [猖壍.data, 鈅壍]);
    return (<div className="min-h-dvh bg-page px-8 py-8 text-fg">
      <header className="mb-8 flex items-center gap-4">
        <Logo />
        <Headline text="Every chart, *checked*" size={32} className="flex-1"/>
        <Button variant="outline" onClick={緣壍}>
          {廴壍 === "dark" ? "Light" : "Dark"} theme
        </Button>
      </header>
      {!鳒壍 ? (<Skeleton height={400}/>) : (<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {QUESTION_PRESETS.map((槁壍) => (<WidgetFrame key={槁壍.id} id={槁壍.id} title={槁壍.title} subtitle={`${槁壍.subtitle} · ${槁壍.viz.type}`} editing={false} width={6} style={{ height: Math.max(itemHeightPx(槁壍.size.h), 320) }} resetKey={槁壍.id}>
              <QuestionWidget instance={{ id: 槁壍.id, type: "question", title: 槁壍.title, config: {} }} config={{ preset: 槁壍.id, query: 槁壍.query, viz: 槁壍.viz } as QuestionConfig} rt={鳒壍} size={槁壍.size} setConfig={() => undefined}/>
            </WidgetFrame>))}
        </div>)}
    </div>);
}
