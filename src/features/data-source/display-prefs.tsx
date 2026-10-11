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
export function DisplayPreferences({ accountCurrency: 悃壍, envCurrency: 署壍 }: {
    accountCurrency: string;
    envCurrency: boolean;
}) {
    const 鹡壍 = useSettings();
    if (鹡壍.error && !鹡壍.data) {
        return (<Card>
        <ErrorState error={鹡壍.error} onRetry={() => void 鹡壍.refetch()}/>
      </Card>);
    }
    if (!鹡壍.data)
        return <Skeleton height={460} className="rounded-card"/>;
    return <Cmp43 key={JSON.stringify(鹡壍.data)} settings={鹡壍.data} accountCurrency={悃壍} envCurrency={署壍}/>;
}
function Cmp43({ settings: 訿壍, accountCurrency: 圮壍, envCurrency: 瘝壍 }: {
    settings: AppSettings;
    accountCurrency: string;
    envCurrency: boolean;
}) {
    const 锌壍 = useMe().data?.workspace.name ?? "current";
    const 懻壍 = useMemo(() => prefsToForm(訿壍), [訿壍]);
    const [胪壍, 鿙壍] = useState<PrefsForm>(懻壍);
    const [泈壍, 讷壍] = useState<ReturnType<typeof prefsPatch>["errors"]>({});
    const 墦壍 = useUpdateSettings();
    const 瞕壍 = JSON.stringify(胪壍) !== JSON.stringify(懻壍);
    const 隄壍 = (捳壍: Partial<PrefsForm>) => 鿙壍((艢壍) => ({ ...艢壍, ...捳壍 }));
    const 佑壍 = !!胪壍.currency && 胪壍.currency !== 圮壍;
    const 湀壍 = 胪壍.currency || 圮壍;
    const 贯壍 = () => {
        const { patch: 娞壍, errors: 礍壍 } = prefsPatch(胪壍, 訿壍, 圮壍);
        讷壍(礍壍);
        if (!娞壍)
            return;
        墦壍.mutate(娞壍, { onSuccess: () => toast("Preferences saved"), onError: (韼壍) => toast(韼壍.message || "Saving failed", { tone: "crit" }) });
    };
    return (<Card className="flex flex-col gap-5">
      <CardHeader title="Display preferences" sub={`Stored on the server · shared by everyone in the ${锌壍} workspace`} action={瞕壍 ? <Pill tone="muted">Unsaved</Pill> : null}/>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Display currency" hint={瘝壍 ? "DASHBOARD_CURRENCY in .env takes precedence." : `Account currency: ${圮壍}`}>
          {(擫壍) => (<Select id={擫壍} value={胪壍.currency || 圮壍} onChange={(菚壍) => 隄壍({ currency: 菚壍.target.value === 圮壍 ? "" : 菚壍.target.value, fxRate: 菚壍.target.value === 圮壍 ? "" : String(訿壍.fxRates[菚壍.target.value] ?? "") })}>
              {currencyOptions(訿壍, 圮壍).map((僉壍) => (<option key={僉壍} value={僉壍}>
                  {僉壍 === 圮壍 ? `${僉壍} (account)` : 僉壍}
                </option>))}
            </Select>)}
        </Field>
        <Field label={`FX rate · 1 ${圮壍} =`} error={泈壍.fxRate} hint={佑壍 ? `${湀壍} per ${圮壍}, applied to every amount` : "Only needed for a different display currency"}>
          {(澸壍) => <Input id={澸壍} variant="field" inputMode="decimal" disabled={!佑壍} value={佑壍 ? 胪壍.fxRate : ""} placeholder={佑壍 ? "e.g. 0.92" : "—"} onChange={(躧壍) => 隄壍({ fxRate: 躧壍.target.value })} className="disabled:opacity-50"/>}
        </Field>
        <Field label="Auto-refresh" hint="Monitoring views re-query on this interval">
          {(宖壍) => (<Select id={宖壍} value={胪壍.refreshSeconds} onChange={(窅壍) => 隄壍({ refreshSeconds: Number(窅壍.target.value) })}>
              {[...new Set([...REFRESH_OPTIONS, 胪壍.refreshSeconds])].map((饴壍) => (<option key={饴壍} value={饴壍}>
                  {formatInterval(饴壍)}
                </option>))}
            </Select>)}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Brand terms" hint="Comma-separated — splits brand vs non-brand search terms">
          {(晣壍) => <Input id={晣壍} variant="field" value={胪壍.brandTerms} placeholder="acme, acme running" onChange={(蕒壍) => 隄壍({ brandTerms: 蕒壍.target.value })}/>}
        </Field>
        <Field label="Competitor terms" hint="Comma-separated — flags competitor queries">
          {(剁壍) => <Input id={剁壍} variant="field" value={胪壍.competitorTerms} placeholder="stridemax, peakpace" onChange={(焰壍) => 隄壍({ competitorTerms: 焰壍.target.value })}/>}
        </Field>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="label-mono">Goals</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 wide:grid-cols-4">
          <Field label="Monthly conversions" error={泈壍.monthlyConversions}>
            {(速壍) => <Input id={速壍} variant="field" inputMode="decimal" value={胪壍.monthlyConversions} placeholder="—" onChange={(崎壍) => 隄壍({ monthlyConversions: 崎壍.target.value })}/>}
          </Field>
          <Field label={`Monthly revenue · ${圮壍}`} error={泈壍.monthlyRevenue}>
            {(篽壍) => <Input id={篽壍} variant="field" inputMode="decimal" value={胪壍.monthlyRevenue} placeholder="—" onChange={(髬壍) => 隄壍({ monthlyRevenue: 髬壍.target.value })}/>}
          </Field>
          <Field label={`Target CPA · ${圮壍}`} error={泈壍.targetCpa}>
            {(柛壍) => <Input id={柛壍} variant="field" inputMode="decimal" value={胪壍.targetCpa} placeholder="—" onChange={(蛊壍) => 隄壍({ targetCpa: 蛊壍.target.value })}/>}
          </Field>
          <Field label="Target ROAS · x" error={泈壍.targetRoas}>
            {(厹壍) => <Input id={厹壍} variant="field" inputMode="decimal" value={胪壍.targetRoas} placeholder="—" onChange={(犨壍) => 隄壍({ targetRoas: 犨壍.target.value })}/>}
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <Button variant="ghost" disabled={!瞕壍 || 墦壍.isPending} onClick={() => {
            鿙壍(懻壍);
            讷壍({});
        }}>
          Reset
        </Button>
        <Button variant="accent" onClick={贯壍} loading={墦壍.isPending} disabled={!瞕壍}>
          Save preferences
        </Button>
      </div>
    </Card>);
}
