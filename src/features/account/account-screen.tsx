"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eyebrow, Headline } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/inputs";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, CodeBlock } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { signOut, useChangePassword, useMe, useMfaDisable, useMfaEnable, useMfaSetup, useRevokeSession, useSessions, useUpdateProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/auth/roles";
import { PASSWORD_MIN, type MfaSetupResponse } from "@/lib/domain/contracts/auth";
import { hardNavigate } from "@/lib/navigation";
import { formatWhen } from "../access/format";
const 觠壍 = (囏壍: unknown) => (囏壍 instanceof ApiError ? 囏壍.message : 囏壍 ? "Something went wrong" : null);
function Cmp6() {
    const 钭壍 = useMe();
    const 憜壍 = useUpdateProfile();
    const 肋壍 = 钭壍.data?.user;
    const [齺壍, 汩壍] = useState<string | null>(null);
    if (!肋壍)
        return null;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Profile" sub={`${ROLE_LABELS[肋壍.role]}${肋壍.clientName ? ` · ${肋壍.clientName}` : " · all clients"}`}/>
      <p className="m-0 text-xs text-muted-3">{ROLE_DESCRIPTIONS[肋壍.role]}</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(識壍) => {
            識壍.preventDefault();
            憜壍.mutate(齺壍 ?? 肋壍.name, { onSuccess: () => (toast("Saved"), 汩壍(null)) });
        }}>
        <Field label="Name" className="min-w-[220px] flex-1">
          {(塇壍) => <Input id={塇壍} variant="field" value={齺壍 ?? 肋壍.name} onChange={(眶壍) => 汩壍(眶壍.target.value)} maxLength={80} required/>}
        </Field>
        <Field label="Email" className="min-w-[220px] flex-1">
          {(阥壍) => <Input id={阥壍} variant="field" value={肋壍.email} disabled/>}
        </Field>
        <Button type="submit" variant="outline" loading={憜壍.isPending} disabled={齺壍 === null || 齺壍 === 肋壍.name}>
          Save
        </Button>
      </form>
    </Card>);
}
function Cmp7() {
    const 舃壍 = useChangePassword();
    const [仲壍, 淡壍] = useState({ current: "", next: "", confirm: "" });
    const [賐壍, 妿壍] = useState<string | null>(null);
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Password" sub="Changing it signs you out on every other device"/>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={(碮壍) => {
            碮壍.preventDefault();
            if (仲壍.next !== 仲壍.confirm)
                return 妿壍("The new passwords don't match");
            妿壍(null);
            舃壍.mutate({ current: 仲壍.current, next: 仲壍.next }, { onSuccess: () => (toast("Password changed"), 淡壍({ current: "", next: "", confirm: "" })) });
        }}>
        <Field label="Current password">{(鞝壍) => <Input id={鞝壍} variant="field" type="password" value={仲壍.current} onChange={(撌壍) => 淡壍({ ...仲壍, current: 撌壍.target.value })} autoComplete="current-password" required/>}</Field>
        <Field label="New password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(荻壍) => <Input id={荻壍} variant="field" type="password" value={仲壍.next} onChange={(偪壍) => 淡壍({ ...仲壍, next: 偪壍.target.value })} autoComplete="new-password" minLength={PASSWORD_MIN} required/>}
        </Field>
        <Field label="Repeat new password">{(潙壍) => <Input id={潙壍} variant="field" type="password" value={仲壍.confirm} onChange={(蹈壍) => 淡壍({ ...仲壍, confirm: 蹈壍.target.value })} autoComplete="new-password" required/>}</Field>
        <div className="flex items-center gap-3 sm:col-span-3">
          <Button type="submit" variant="outline" loading={舃壍.isPending}>
            Change password
          </Button>
          {賐壍 || 舃壍.error ? <span className="text-[13px] text-crit">{賐壍 ?? 觠壍(舃壍.error)}</span> : null}
        </div>
      </form>
    </Card>);
}
function Cmp8({ required: 稦壍 }: {
    required: boolean;
}) {
    const 餕壍 = useMe();
    const 昄壍 = useMfaSetup();
    const 蓳壍 = useMfaEnable();
    const 凢壍 = useMfaDisable();
    const [烑壍, 迀壍] = useState<MfaSetupResponse | null>(null);
    const [岯壍, 箞壍] = useState("");
    const [骍壍, 杼壍] = useState<string[] | null>(null);
    const [虫壍, 博壍] = useState("");
    const 牉壍 = !!餕壍.data?.user?.mfaEnabled;
    return (<Card className="flex flex-col gap-4" accent={稦壍 && !牉壍}>
      <CardHeader title="Two-factor authentication" sub="A 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy…) at every sign-in" action={牉壍 ? <Pill tone="accent">On</Pill> : <Pill tone="muted">Off</Pill>}/>
      {稦壍 && !牉壍 ? <p className="m-0 text-[13px] text-fg">Your role requires two-factor authentication. Set it up to continue using the dashboard.</p> : null}
      {骍壍 ? (<div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] text-fg">Two-factor authentication is on. Save these one-time recovery codes somewhere safe — each one signs you in once if you lose your phone. They won&apos;t be shown again.</p>
          <CodeBlock>{骍壍.join("\n")}</CodeBlock>
          <Button variant="outline" className="self-start" onClick={() => void navigator.clipboard.writeText(骍壍.join("\n")).then(() => toast("Recovery codes copied"))}>
            Copy codes
          </Button>
          {稦壍 ? (<Button variant="link" className="self-start text-[13px]" onClick={() => hardNavigate("/overview")}>
              Continue to the dashboard →
            </Button>) : null}
        </div>) : 牉壍 ? (<form className="flex flex-wrap items-end gap-3" onSubmit={(鄸壍) => {
                鄸壍.preventDefault();
                凢壍.mutate(虫壍, { onSuccess: () => (toast("Two-factor authentication turned off"), 博壍("")) });
            }}>
          <Field label="Password to turn it off" className="min-w-[240px]">
            {(帧壍) => <Input id={帧壍} variant="field" type="password" value={虫壍} onChange={(紖壍) => 博壍(紖壍.target.value)} autoComplete="current-password" required/>}
          </Field>
          <Button type="submit" variant="danger" loading={凢壍.isPending}>
            Turn off
          </Button>
          {凢壍.error ? <span className="text-[13px] text-crit">{觠壍(凢壍.error)}</span> : null}
        </form>) : 烑壍 ? (<form className="flex flex-col gap-3" onSubmit={(鰅壍) => {
                鰅壍.preventDefault();
                蓳壍.mutate(岯壍.trim(), { onSuccess: (棴壍) => (杼壍(棴壍.recoveryCodes), 迀壍(null), 箞壍("")) });
            }}>
          <p className="m-0 text-[13px] leading-[1.6] text-muted">
            In your authenticator app choose <em>Add account → Enter a setup key</em> and paste this key (time-based), or open the link on your phone. Then type the 6-digit code it shows.
          </p>
          <CodeBlock className="text-[13px] tracking-[0.12em]">{烑壍.secret.replace(/(.{4})/g, "$1 ").trim()}</CodeBlock>
          <a href={烑壍.otpauthUri} className="self-start text-[13px]">
            Open in authenticator app ↗
          </a>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="6-digit code" className="w-40">
              {(蟣壍) => <Input id={蟣壍} variant="field" value={岯壍} onChange={(哒壍) => 箞壍(哒壍.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus/>}
            </Field>
            <Button type="submit" variant="accent" loading={蓳壍.isPending}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={() => 迀壍(null)}>
              Cancel
            </Button>
          </div>
          {蓳壍.error ? <span className="text-[13px] text-crit">{觠壍(蓳壍.error)}</span> : null}
        </form>) : (<div className="flex flex-wrap items-center gap-3">
          <Button variant="accent" loading={昄壍.isPending} onClick={() => 昄壍.mutate(undefined, { onSuccess: 迀壍 })}>
            Set up two-factor authentication
          </Button>
          {昄壍.error ? <span className="text-[13px] text-crit">{觠壍(昄壍.error)}</span> : null}
        </div>)}
    </Card>);
}
function Cmp9() {
    const 銰壍 = useSessions();
    const 徟壍 = useRevokeSession();
    return (<Card className="flex flex-col gap-3">
      <CardHeader title="Signed-in devices" sub="Sessions end after inactivity or at their expiry"/>
      {銰壍.error ? <ErrorState error={銰壍.error} compact/> : null}
      {!銰壍.data && !銰壍.error ? <Skeleton height={80}/> : null}
      <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
        {銰壍.data?.sessions.map((纎壍) => (<li key={纎壍.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-fg" title={纎壍.userAgent}>
              {纎壍.userAgent || "Unknown browser"}
            </span>
            <span className="font-mono text-micro text-faint">
              {纎壍.method} · {纎壍.ip} · last seen {formatWhen(纎壍.lastSeenAt)}
            </span>
            {纎壍.current ? (<Pill tone="accent">This device</Pill>) : (<Button variant="ghost" size="xs" onClick={() => 徟壍.mutate(纎壍.id, { onSuccess: () => toast("Signed out that device") })}>
                Sign out
              </Button>)}
          </li>))}
      </ul>
    </Card>);
}
export function AccountScreen() {
    const 鵽壍 = useMe();
    const 橬壍 = useSearchParams();
    const 襛壍 = 橬壍.get("setup") === "2fa" || !!鵽壍.data?.mfaSetupRequired;
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex min-w-[280px] flex-1 flex-col gap-3">
          <Eyebrow>Account</Eyebrow>
          <Headline text="Your *account*"/>
        </div>
        {鵽壍.data?.user ? (<Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>) : null}
      </div>
      {鵽壍.data && !鵽壍.data.user ? <Card className="text-[13px] text-muted">Access control is off (AUTH_MODE=off), so there is no personal account.</Card> : null}
      {鵽壍.data?.user ? (<>
          <Cmp6 />
          <Cmp8 required={襛壍}/>
          {鵽壍.data.user.hasPassword ? <Cmp7 /> : null}
          <Cmp9 />
        </>) : null}
      {!鵽壍.data ? <Skeleton height={260}/> : null}
    </div>);
}
