"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SkeletonLines } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/inputs";
import { useAcceptInvite, useInviteInfo } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/navigation";
import { PASSWORD_MIN } from "@/lib/domain/contracts/auth";
import { AuthLayout, FormError } from "./auth-layout";
export function InviteScreen({ token }: {
    token: string;
}) {
    const info = useInviteInfo(token);
    const accept = useAcceptInvite();
    const [name, setName] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [local, setLocal] = useState<string | null>(null);
    const reset = info.data?.kind === "reset";
    if (info.isPending) {
        return (<AuthLayout eyebrow="Invitation" headline="Just a *moment*">
        <SkeletonLines lines={3}/>
      </AuthLayout>);
    }
    if (info.error || !info.data) {
        return (<AuthLayout eyebrow="Invitation" headline="Link *expired*">
        <FormError message={info.error instanceof ApiError ? info.error.message : "This link is invalid or has expired."}/>
        <a href="/login" className="text-[13px]">
          Go to sign in →
        </a>
      </AuthLayout>);
    }
    return (<AuthLayout eyebrow={reset ? "Password reset" : "Invitation"} headline={reset ? "Choose a new *password*" : "Set your *password*"}>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            if (password !== confirm)
                return setLocal("The passwords don't match");
            setLocal(null);
            accept.mutate({ token, password, name: reset ? undefined : (name ?? info.data.name) }, { onSuccess: (r) => hardNavigate(r.next) });
        }}>
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          {reset ? "Choose a new password for " : "You've been invited to SAVD Ads Intelligence as "}
          <strong className="text-fg">{info.data.email}</strong>.
        </p>
        {reset ? null : <Field label="Your name">{(id) => <Input id={id} variant="field" value={name ?? info.data.name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required/>}</Field>}
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(id) => <Input id={id} variant="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={PASSWORD_MIN} autoFocus required/>}
        </Field>
        <Field label="Repeat password">{(id) => <Input id={id} variant="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required/>}</Field>
        <FormError message={local ?? (accept.error instanceof ApiError ? accept.error.message : accept.error ? "That didn't work. Try again." : null)}/>
        <Button type="submit" variant="brand" loading={accept.isPending} className="justify-center">
          {reset ? "Save and sign in" : "Create account and sign in"}
        </Button>
      </form>
    </AuthLayout>);
}
