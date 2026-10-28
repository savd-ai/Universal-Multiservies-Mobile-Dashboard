"use client";
import { SystemDiagram } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { useQuestions, type Catalog } from "@/lib/api/hooks";
import type { SavedQuestion } from "@/lib/domain/contracts/dashboard";
import type { ExploreVizType } from "./codec";
import { sourceLabel } from "./describe";
import type { ExploreState } from "./notebook-state";
import { SavedQuestionList } from "./saved-questions";
import { STARTERS } from "./starters";
import { VIZ_META } from "./viz-suggest";
interface StartProps {
    catalog?: Catalog;
    onStart: (state: ExploreState) => void;
    onScratch: () => void;
    onOpenSaved: (q: SavedQuestion) => void;
    onAllSaved: () => void;
}
export function ExploreStart({ catalog: pluginNames, onStart, onScratch, onOpenSaved, onAllSaved }: StartProps) {
    const questions = useQuestions();
    const count = questions.data?.length ?? 0;
    return (<div className="flex flex-col gap-8 animate-fade-up">
      <SystemDiagram nodes={[
            { num: "01", title: "Data", caption: "Google Ads, blended, or one connected platform" },
            { num: "02", title: "Metrics", caption: "Spend, ROAS, CPA… or your own formula" },
            { num: "03", title: "Group by", caption: "Up to three breakdowns: time, entity, category" },
            { num: "04", title: "Filter", caption: "Rows before, conditions after aggregation" },
        ]} result={{ title: "Visualize", caption: "Chart, table or spec — save it or pin it to a dashboard" }}/>

      <section className="flex flex-col gap-4" aria-labelledby="starters-title">
        <div className="flex flex-col gap-1">
          <h2 id="starters-title" className="m-0 font-display text-base font-semibold tracking-title">
            Start with a question
          </h2>
          <span className="meta">Each one opens in the notebook — change anything</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {STARTERS.map((s) => (<button key={s.id} type="button" onClick={() => onStart(s.state)} className="group flex flex-col gap-3 rounded-card border border-line bg-card p-5 text-left shadow-card transition-colors hover:border-teal/40">
              <span className="flex items-center justify-between gap-3 font-mono text-micro tracking-label uppercase">
                <span className="text-accent">{VIZ_META[(s.state.viz?.type ?? "table") as ExploreVizType].label}</span>
                <span className="text-faint">{sourceLabel(s.state.spec.source)}</span>
              </span>
              <span className="font-display text-[17px] leading-snug font-semibold">{s.title}</span>
              <span className="flex-1 text-[13px] leading-relaxed text-muted-3">{s.caption}</span>
              <span className="text-[13px] text-accent transition-transform group-hover:translate-x-0.5">Open in the notebook →</span>
            </button>))}
          <button type="button" onClick={onScratch} className="grid min-h-[160px] place-items-center rounded-card border border-dashed border-tone/14 p-5 text-center text-[13px] text-muted-3 transition-colors hover:border-teal/40 hover:text-accent">
            <span className="flex flex-col items-center gap-2">
              <span className="font-display text-[17px] font-semibold text-fg">Start from scratch</span>
              <span>Spend and conversions by day — then make it yours</span>
            </span>
          </button>
        </div>
      </section>

      {count ? (<section className="flex flex-col gap-3 rounded-card border border-line bg-card p-[22px] shadow-card" aria-labelledby="recent-title">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id="recent-title" className="m-0 font-display text-base font-semibold tracking-title">
                Saved questions
              </h2>
              <span className="meta">{`${count} saved · most recent first`}</span>
            </div>
            {count > 5 ? (<Button variant="link" className="text-xs" onClick={onAllSaved}>
                All {count} →
              </Button>) : null}
          </div>
          <SavedQuestionList catalog={pluginNames} onOpen={onOpenSaved} limit={5} compact/>
        </section>) : null}
    </div>);
}
