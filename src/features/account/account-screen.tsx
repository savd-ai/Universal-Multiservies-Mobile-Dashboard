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
const errText = (e: unknown) => (e instanceof ApiError ? e.message : e ? "Something went wrong" : null);
function Profile() {
    const me = useMe();
    const save = useUpdateProfile();
    const user = me.data?.user;
    const [name, setName] = useState<string | null>(null);
    if (!user)
        return null;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Profile" sub={`${ROLE_LABELS[user.role]}${user.clientName ? ` · ${user.clientName}` : " · all clients"}`}/>
      <p className="m-0 text-xs text-muted-3">{ROLE_DESCRIPTIONS[user.role]}</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
            e.preventDefault();
            save.mutate(name ?? user.name, { onSuccess: () => (toast("Saved"), setName(null)) });
        }}>
        <Field label="Name" className="min-w-[220px] flex-1">
          {(id) => <Input id={id} variant="field" value={name ?? user.name} onChange={(e) => setName(e.target.value)} maxLength={80} required/>}
        </Field>
        <Field label="Email" className="min-w-[220px] flex-1">
          {(id) => <Input id={id} variant="field" value={user.email} disabled/>}
        </Field>
        <Button type="submit" variant="outline" loading={save.isPending} disabled={name === null || name === user.name}>
          Save
        </Button>
      </form>
    </Card>);
}
function Password() {
    const change = useChangePassword();
    const [f, setF] = useState({ current: "", next: "", confirm: "" });
    const [local, setLocal] = useState<string | null>(null);
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Password" sub="Changing it signs you out on every other device"/>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={(e) => {
            e.preventDefault();
            if (f.next !== f.confirm)
                return setLocal("The new passwords don't match");
            setLocal(null);
            change.mutate({ current: f.current, next: f.next }, { onSuccess: () => (toast("Password changed"), setF({ current: "", next: "", confirm: "" })) });
        }}>
        <Field label="Current password">{(id) => <Input id={id} variant="field" type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" required/>}</Field>
        <Field label="New password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(id) => <Input id={id} variant="field" type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" minLength={PASSWORD_MIN} required/>}
        </Field>
        <Field label="Repeat new password">{(id) => <Input id={id} variant="field" type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" required/>}</Field>
        <div className="flex items-center gap-3 sm:col-span-3">
          <Button type="submit" variant="outline" loading={change.isPending}>
            Change password
          </Button>
          {local || change.error ? <span className="text-[13px] text-crit">{local ?? errText(change.error)}</span> : null}
        </div>
      </form>
    </Card>);
}
function TwoFactor({ required }: {
    required: boolean;
}) {
    const me = useMe();
    const setup = useMfaSetup();
    const enable = useMfaEnable();
    const disable = useMfaDisable();
    const [pending, setPending] = useState<MfaSetupResponse | null>(null);
    const [code, setCode] = useState("");
    const [codes, setCodes] = useState<string[] | null>(null);
    const [password, setPassword] = useState("");
    const on = !!me.data?.user?.mfaEnabled;
    return (<Card className="flex flex-col gap-4" accent={required && !on}>
      <CardHeader title="Two-factor authentication" sub="A 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy…) at every sign-in" action={on ? <Pill tone="accent">On</Pill> : <Pill tone="muted">Off</Pill>}/>
      {required && !on ? <p className="m-0 text-[13px] text-fg">Your role requires two-factor authentication. Set it up to continue using the dashboard.</p> : null}
      {codes ? (<div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] text-fg">Two-factor authentication is on. Save these one-time recovery codes somewhere safe — each one signs you in once if you lose your phone. They won&apos;t be shown again.</p>
          <CodeBlock>{codes.join("\n")}</CodeBlock>
          <Button variant="outline" className="self-start" onClick={() => void navigator.clipboard.writeText(codes.join("\n")).then(() => toast("Recovery codes copied"))}>
            Copy codes
          </Button>
          {required ? (<Button variant="link" className="self-start text-[13px]" onClick={() => hardNavigate("/overview")}>
              Continue to the dashboard →
            </Button>) : null}
        </div>) : on ? (<form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
                e.preventDefault();
                disable.mutate(password, { onSuccess: () => (toast("Two-factor authentication turned off"), setPassword("")) });
            }}>
          <Field label="Password to turn it off" className="min-w-[240px]">
            {(id) => <Input id={id} variant="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/>}
          </Field>
          <Button type="submit" variant="danger" loading={disable.isPending}>
            Turn off
          </Button>
          {disable.error ? <span className="text-[13px] text-crit">{errText(disable.error)}</span> : null}
        </form>) : pending ? (<form className="flex flex-col gap-3" onSubmit={(e) => {
                e.preventDefault();
                enable.mutate(code.trim(), { onSuccess: (r) => (setCodes(r.recoveryCodes), setPending(null), setCode("")) });
            }}>
          <p className="m-0 text-[13px] leading-[1.6] text-muted">
            In your authenticator app choose <em>Add account → Enter a setup key</em> and paste this key (time-based), or open the link on your phone. Then type the 6-digit code it shows.
          </p>
          <CodeBlock className="text-[13px] tracking-[0.12em]">{pending.secret.replace(/(.{4})/g, "$1 ").trim()}</CodeBlock>
          <a href={pending.otpauthUri} className="self-start text-[13px]">
            Open in authenticator app ↗
          </a>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="6-digit code" className="w-40">
              {(id) => <Input id={id} variant="field" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus/>}
            </Field>
            <Button type="submit" variant="accent" loading={enable.isPending}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
          {enable.error ? <span className="text-[13px] text-crit">{errText(enable.error)}</span> : null}
        </form>) : (<div className="flex flex-wrap items-center gap-3">
          <Button variant="accent" loading={setup.isPending} onClick={() => setup.mutate(undefined, { onSuccess: setPending })}>
            Set up two-factor authentication
          </Button>
          {setup.error ? <span className="text-[13px] text-crit">{errText(setup.error)}</span> : null}
        </div>)}
    </Card>);
}
function Sessions() {
    const q = useSessions();
    const revoke = useRevokeSession();
    return (<Card className="flex flex-col gap-3">
      <CardHeader title="Signed-in devices" sub="Sessions end after inactivity or at their expiry"/>
      {q.error ? <ErrorState error={q.error} compact/> : null}
      {!q.data && !q.error ? <Skeleton height={80}/> : null}
      <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
        {q.data?.sessions.map((s) => (<li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-fg" title={s.userAgent}>
              {s.userAgent || "Unknown browser"}
            </span>
            <span className="font-mono text-micro text-faint">
              {s.method} · {s.ip} · last seen {formatWhen(s.lastSeenAt)}
            </span>
            {s.current ? (<Pill tone="accent">This device</Pill>) : (<Button variant="ghost" size="xs" onClick={() => revoke.mutate(s.id, { onSuccess: () => toast("Signed out that device") })}>
                Sign out
              </Button>)}
          </li>))}
      </ul>
    </Card>);
}
export function AccountScreen() {
    const me = useMe();
    const params = useSearchParams();
    const required = params.get("setup") === "2fa" || !!me.data?.mfaSetupRequired;
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex min-w-[280px] flex-1 flex-col gap-3">
          <Eyebrow>Account</Eyebrow>
          <Headline text="Your *account*"/>
        </div>
        {me.data?.user ? (<Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>) : null}
      </div>
      {me.data && !me.data.user ? <Card className="text-[13px] text-muted">Access control is off (AUTH_MODE=off), so there is no personal account.</Card> : null}
      {me.data?.user ? (<>
          <Profile />
          <TwoFactor required={required}/>
          {me.data.user.hasPassword ? <Password /> : null}
          <Sessions />
        </>) : null}
      {!me.data ? <Skeleton height={260}/> : null}
    </div>);
}
