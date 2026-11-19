"use client";

import Link from "next/link";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useRef, useState } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Dot } from "@/components/ui/status";
import { Card, CardHeader, CodeBlock } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useCustomPluginRecord, useDeleteCustomPlugin, usePluginList } from "@/lib/api/plugins-ui";
import type { PluginView } from "@/lib/domain/contracts/plugins";
import { blankForm, BUILDER_STEPS, formFromBuiltin, KLAVIYO_MOCK_KEY, klaviyoMockForm, manifestToForm, type BuilderForm } from "./builder-model";
import { ConnectModal } from "./connect-modal";
import { errorMessage, PluginCard } from "./plugin-card";
import { FILTER_LABEL, filterCounts, filterPlugins, GALLERY_FILTERS, galleryStats } from "./plugin-meta";
import { RestBuilder, type BuilderSeed } from "./rest-builder";

// Plugins (08): the prototype's gallery (now with category chips, search, Live/Demo, .env detection, Test / Sync),
// its connect modal (?connect=<id>) and the custom-plugin panel grown into a no-code REST builder
// (?build=<preset|plugin id>&step=…), plus the code-plugin scaffold note.

interface BuilderSession {
  n: number;
  source: string;
  imported: BuilderForm | null;
}

export function PluginsScreen() {
  const list = usePluginList();
  const [filter, setFilter] = useQueryState("cat", parseAsStringEnum([...GALLERY_FILTERS]).withDefault("all"));
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [connectId, setConnectId] = useQueryState("connect");
  const [build, setBuild] = useQueryState("build");
  const [step, setStep] = useQueryState("step", parseAsStringEnum([...BUILDER_STEPS]).withDefault("basics"));
  const [session, setSession] = useState<BuilderSession>(() => ({ n: 0, source: build ?? "klaviyo", imported: null }));
  const [deleting, setDeleting] = useState<PluginView | null>(null);
  const del = useDeleteCustomPlugin();
  const builderRef = useRef<HTMLDivElement>(null);

  const plugins = list.data?.plugins ?? [];
  const encryption = list.data?.encryption ?? false;
  const visible = filterPlugins(plugins, filter, query);
  const counts = filterCounts(plugins, query);
  const stats = galleryStats(plugins);
  const connectView = connectId ? (plugins.find((p) => p.manifest.id === connectId) ?? null) : null;

  const scrollToBuilder = () => builderRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const startBuilder = (source: string, imported: BuilderForm | null = null) => {
    setSession((s) => ({ n: s.n + 1, source, imported }));
    void setBuild(source === "klaviyo" || source === "import" ? null : source);
    void setStep("basics");
    scrollToBuilder();
  };

  const confirmDelete = (v: PluginView) =>
    del.mutate(v.manifest.id, {
      onSuccess: () => {
        toast(`${v.manifest.name} removed`);
        if (session.source === v.manifest.id || build === v.manifest.id) startBuilder("klaviyo");
      },
      onError: (e) => toast(errorMessage(e), { tone: "crit" }),
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <Button variant="outline" onClick={scrollToBuilder}>
              Build a custom plugin
            </Button>
            <Link href="/channels" className="text-[13px]">
              Open Channels →
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter plugins by category">
            {GALLERY_FILTERS.filter((f) => f === "all" || f === filter || counts[f] > 0).map((f) => (
              <Chip key={f} active={filter === f} count={counts[f]} onClick={() => void setFilter(f === "all" ? null : f)}>
                {FILTER_LABEL[f]}
              </Chip>
            ))}
          </div>
          <span className="flex-1" />
          <Input type="search" aria-label="Search plugins" placeholder="Search plugins" className="w-full sm:w-64" value={query} onChange={(e) => void setQuery(e.target.value || null)} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="meta">{list.data ? `${stats.total} plugins · ${stats.connected} connected · ${stats.live} live${stats.custom ? ` · ${stats.custom} custom` : ""}` : "Loading plugins…"}</span>
          {list.data && !encryption ? (
            <span role="note" className="flex items-center gap-2 text-xs text-muted-3">
              <Dot tone="muted" size={6} />
              Secrets can only come from .env until APP_ENCRYPTION_KEY is set (<code className="font-mono text-fg">npm run gen:key</code>).
            </span>
          ) : null}
        </div>
      </div>

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(270px, 100%), 1fr))" }} aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={228} className="rounded-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          action={
            <Button
              variant="link"
              onClick={() => {
                void setFilter(null);
                void setQuery(null);
              }}
            >
              Clear filters →
            </Button>
          }
        >
          {query ? `No plugins match “${query}”.` : "No plugins in this category yet."}
        </EmptyState>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(270px, 100%), 1fr))" }}>
          {visible.map((v) => (
            <PluginCard key={v.manifest.id} view={v} onOpenConnect={(id) => void setConnectId(id)} onBuildLive={(p) => startBuilder(p.manifest.id)} onEdit={(id) => startBuilder(id)} onDelete={setDeleting} />
          ))}
        </div>
      )}

      <div ref={builderRef} className="scroll-mt-24">
        <BuilderHost
          session={session}
          plugins={list.data ? plugins : undefined}
          encryption={encryption}
          step={step}
          onStep={(s) => void setStep(s)}
          onStart={(source, imported) => startBuilder(source, imported ?? null)}
          onSaved={(id) => void setBuild(id)}
        />
      </div>

      <CodePluginsNote />

      <ConnectModal view={connectView} encryption={encryption} onClose={() => void setConnectId(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete ${deleting.manifest.name}?` : "Delete plugin?"}
        description="Removes the plugin, its saved credential and its connection; its rows disappear from Channels and dashboards. Export the manifest first to keep a copy."
        confirmLabel="Delete plugin"
        danger
        onConfirm={() => deleting && confirmDelete(deleting)}
      />
    </div>
  );
}

// ── Builder host: turns the session source into a seed (presets, a saved custom plugin, a built-in) ──

interface BuilderHostProps {
  session: BuilderSession;
  plugins: PluginView[] | undefined;
  encryption: boolean;
  step: (typeof BUILDER_STEPS)[number];
  onStep: (s: (typeof BUILDER_STEPS)[number]) => void;
  onStart: (source: string, imported?: BuilderForm) => void;
  onSaved: (id: string) => void;
}

function BuilderHost({ session, plugins, encryption, step, onStep, onStart, onSaved }: BuilderHostProps) {
  const { source } = session;
  const preset = source === "klaviyo" || source === "blank" || source === "import";
  const view = preset ? undefined : plugins?.find((p) => p.manifest.id === source);
  const record = useCustomPluginRecord(view?.custom ? source : null);

  let seed: BuilderSeed | null = null;
  let waiting = false;
  if (source === "blank") seed = { source, form: blankForm(), secret: "", editId: null, savedSecret: null };
  else if (source === "import" && session.imported) seed = { source, form: session.imported, secret: "", editId: null, savedSecret: null };
  else if (!preset && !plugins) waiting = true;
  else if (view?.custom) {
    if (record.data) {
      const saved = record.data.secrets.auth ?? null;
      seed = { source, form: manifestToForm(record.data.manifest, { savedSecret: !!saved?.hasValue }), secret: "", editId: record.data.manifest.id, recordVersion: record.data.recordVersion, savedSecret: saved };
    } else if (!record.error) waiting = true;
  } else if (view) seed = { source, form: formFromBuiltin(view.manifest), secret: "", editId: null, savedSecret: null };
  seed ??= waiting ? null : { source: "klaviyo", form: klaviyoMockForm(), secret: KLAVIYO_MOCK_KEY, editId: null, savedSecret: null };

  if (!seed) return <Skeleton height={620} className="rounded-card" />;
  return <RestBuilder key={`${session.n}:${seed.source}`} seed={seed} encryption={encryption} step={step} onStep={onStep} onStart={onStart} onSaved={onSaved} />;
}

function CodePluginsNote() {
  return (
    <Card flat className="flex flex-col gap-4">
      <CardHeader title="Code plugins" sub="OAuth flows, SDKs or custom logic" />
      <p className="m-0 max-w-[72ch] text-[13px] leading-[1.6] text-muted">
        When an API needs more than a templated request, scaffold a TypeScript plugin with <span className="font-mono text-xs text-fg">definePlugin()</span>. It runs on seeded demo data until you implement{" "}
        <span className="font-mono text-xs text-fg">fetchMetrics</span> (or <span className="font-mono text-xs text-fg">sendAlert</span>) and set <span className="font-mono text-xs text-fg">live: true</span>.
      </p>
      <CodeBlock>{`npm run plugin:new -- acme-ads --category ad_platform --name "Acme Ads"\n# categories: ad_platform | analytics | commerce | alerts`}</CodeBlock>
      <ul className="m-0 flex flex-col gap-1.5 pl-4 text-[13px] leading-normal text-muted marker:text-faint">
        <li>
          writes <span className="font-mono text-xs text-fg">src/plugins/custom/&lt;id&gt;/index.ts</span> and <span className="font-mono text-xs text-fg">tests/unit/plugins/custom-&lt;id&gt;.test.ts</span>
        </li>
        <li>
          registers it in <span className="font-mono text-xs text-fg">src/plugins/custom/index.ts</span> — never overwrites; built-in ids and <span className="font-mono text-xs text-fg">custom-*</span> are reserved
        </li>
        <li>restart the dev server, then connect it here like any built-in</li>
      </ul>
    </Card>
  );
}
