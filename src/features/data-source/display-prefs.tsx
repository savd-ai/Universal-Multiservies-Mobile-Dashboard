"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/inputs";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useSettings, useUpdateSettings } from "@/lib/api/hooks";
import type { AppSettings } from "@/lib/domain/contracts/settings";
import { formatInterval } from "./format";
import { currencyOptions, prefsPatch, prefsToForm, REFRESH_OPTIONS, type PrefsForm } from "./prefs-model";
import { useMe } from "@/lib/api/auth";
export function DisplayPreferences({ accountCurrency, envCurrency }: {
    accountCurrency: string;
    envCurrency: boolean;
}) {
    const settings = useSettings();
    if (settings.error && !settings.data) {
        return (<Card>
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()}/>
      </Card>);
    }
    if (!settings.data)
        return <Skeleton height={460} className="rounded-card"/>;
    return <PrefsCard key={JSON.stringify(settings.data)} settings={settings.data} accountCurrency={accountCurrency} envCurrency={envCurrency}/>;
}
function PrefsCard({ settings, accountCurrency, envCurrency }: {
    settings: AppSettings;
    accountCurrency: string;
    envCurrency: boolean;
}) {
    const workspace = useMe().data?.workspace.name ?? "current";
    const initial = useMemo(() => prefsToForm(settings), [settings]);
    const [form, setForm] = useState<PrefsForm>(initial);
    const [errors, setErrors] = useState<ReturnType<typeof prefsPatch>["errors"]>({});
    const update = useUpdateSettings();
    const dirty = JSON.stringify(form) !== JSON.stringify(initial);
    const handler = (p: Partial<PrefsForm>) => setForm((f) => ({ ...f, ...p }));
    const foreign = !!form.currency && form.currency !== accountCurrency;
    const shown = form.currency || accountCurrency;
    const save = () => {
        const { patch, errors: e } = prefsPatch(form, settings, accountCurrency);
        setErrors(e);
        if (!patch)
            return;
        update.mutate(patch, { onSuccess: () => toast("Preferences saved"), onError: (err) => toast(err.message || "Saving failed", { tone: "crit" }) });
    };
    return (<Card className="flex flex-col gap-5">
      <CardHeader title="Display preferences" sub={`Stored on the server · shared by everyone in the ${workspace} workspace`} action={dirty ? <Pill tone="muted">Unsaved</Pill> : null}/>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Display currency" hint={envCurrency ? "DASHBOARD_CURRENCY in .env takes precedence." : `Account currency: ${accountCurrency}`}>
          {(id) => (<Select id={id} value={form.currency || accountCurrency} onChange={(e) => handler({ currency: e.target.value === accountCurrency ? "" : e.target.value, fxRate: e.target.value === accountCurrency ? "" : String(settings.fxRates[e.target.value] ?? "") })}>
              {currencyOptions(settings, accountCurrency).map((c) => (<option key={c} value={c}>
                  {c === accountCurrency ? `${c} (account)` : c}
                </option>))}
            </Select>)}
        </Field>
        <Field label={`FX rate · 1 ${accountCurrency} =`} error={errors.fxRate} hint={foreign ? `${shown} per ${accountCurrency}, applied to every amount` : "Only needed for a different display currency"}>
          {(id) => <Input id={id} variant="field" inputMode="decimal" disabled={!foreign} value={foreign ? form.fxRate : ""} placeholder={foreign ? "e.g. 0.92" : "—"} onChange={(e) => handler({ fxRate: e.target.value })} className="disabled:opacity-50"/>}
        </Field>
        <Field label="Auto-refresh" hint="Monitoring views re-query on this interval">
          {(id) => (<Select id={id} value={form.refreshSeconds} onChange={(e) => handler({ refreshSeconds: Number(e.target.value) })}>
              {[...new Set([...REFRESH_OPTIONS, form.refreshSeconds])].map((s) => (<option key={s} value={s}>
                  {formatInterval(s)}
                </option>))}
            </Select>)}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Brand terms" hint="Comma-separated — splits brand vs non-brand search terms">
          {(id) => <Input id={id} variant="field" value={form.brandTerms} placeholder="acme, acme running" onChange={(e) => handler({ brandTerms: e.target.value })}/>}
        </Field>
        <Field label="Competitor terms" hint="Comma-separated — flags competitor queries">
          {(id) => <Input id={id} variant="field" value={form.competitorTerms} placeholder="stridemax, peakpace" onChange={(e) => handler({ competitorTerms: e.target.value })}/>}
        </Field>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="label-mono">Goals</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 wide:grid-cols-4">
          <Field label="Monthly conversions" error={errors.monthlyConversions}>
            {(id) => <Input id={id} variant="field" inputMode="decimal" value={form.monthlyConversions} placeholder="—" onChange={(e) => handler({ monthlyConversions: e.target.value })}/>}
          </Field>
          <Field label={`Monthly revenue · ${accountCurrency}`} error={errors.monthlyRevenue}>
            {(id) => <Input id={id} variant="field" inputMode="decimal" value={form.monthlyRevenue} placeholder="—" onChange={(e) => handler({ monthlyRevenue: e.target.value })}/>}
          </Field>
          <Field label={`Target CPA · ${accountCurrency}`} error={errors.targetCpa}>
            {(id) => <Input id={id} variant="field" inputMode="decimal" value={form.targetCpa} placeholder="—" onChange={(e) => handler({ targetCpa: e.target.value })}/>}
          </Field>
          <Field label="Target ROAS · x" error={errors.targetRoas}>
            {(id) => <Input id={id} variant="field" inputMode="decimal" value={form.targetRoas} placeholder="—" onChange={(e) => handler({ targetRoas: e.target.value })}/>}
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <Button variant="ghost" disabled={!dirty || update.isPending} onClick={() => {
            setForm(initial);
            setErrors({});
        }}>
          Reset
        </Button>
        <Button variant="accent" onClick={save} loading={update.isPending} disabled={!dirty}>
          Save preferences
        </Button>
      </div>
    </Card>);
}
