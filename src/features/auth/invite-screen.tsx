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
export function InviteScreen({ token: 畋壍 }: {
    token: string;
}) {
    const 鐺壍 = useInviteInfo(畋壍);
    const 愩壍 = useAcceptInvite();
    const [耘壍, 鼇壍] = useState<string | null>(null);
    const [毶壍, 諥壍] = useState("");
    const [埔壍, 盃壍] = useState("");
    const [閲壍, 抡壍] = useState<string | null>(null);
    const 膐壍 = 鐺壍.data?.kind === "reset";
    if (鐺壍.isPending) {
        return (<AuthLayout eyebrow="Invitation" headline="Just a *moment*">
        <SkeletonLines lines={3}/>
      </AuthLayout>);
    }
    if (鐺壍.error || !鐺壍.data) {
        return (<AuthLayout eyebrow="Invitation" headline="Link *expired*">
        <FormError message={鐺壍.error instanceof ApiError ? 鐺壍.error.message : "This link is invalid or has expired."}/>
        <a href="/login" className="text-[13px]">
          Go to sign in →
        </a>
      </AuthLayout>);
    }
    return (<AuthLayout eyebrow={膐壍 ? "Password reset" : "Invitation"} headline={膐壍 ? "Choose a new *password*" : "Set your *password*"}>
      <form className="flex flex-col gap-4" onSubmit={(乿壍) => {
            乿壍.preventDefault();
            if (毶壍 !== 埔壍)
                return 抡壍("The passwords don't match");
            抡壍(null);
            愩壍.mutate({ token: 畋壍, password: 毶壍, name: 膐壍 ? undefined : (耘壍 ?? 鐺壍.data.name) }, { onSuccess: (浮壍) => hardNavigate(浮壍.next) });
        }}>
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          {膐壍 ? "Choose a new password for " : "You've been invited to SAVD Ads Intelligence as "}
          <strong className="text-fg">{鐺壍.data.email}</strong>.
        </p>
        {膐壍 ? null : <Field label="Your name">{(豝壍) => <Input id={豝壍} variant="field" value={耘壍 ?? 鐺壍.data.name} onChange={(奌壍) => 鼇壍(奌壍.target.value)} autoComplete="name" maxLength={80} required/>}</Field>}
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(砻壍) => <Input id={砻壍} variant="field" type="password" value={毶壍} onChange={(霪壍) => 諥壍(霪壍.target.value)} autoComplete="new-password" minLength={PASSWORD_MIN} autoFocus required/>}
        </Field>
        <Field label="Repeat password">{(搙壍) => <Input id={搙壍} variant="field" type="password" value={埔壍} onChange={(茈壍) => 盃壍(茈壍.target.value)} autoComplete="new-password" required/>}</Field>
        <FormError message={閲壍 ?? (愩壍.error instanceof ApiError ? 愩壍.error.message : 愩壍.error ? "That didn't work. Try again." : null)}/>
        <Button type="submit" variant="brand" loading={愩壍.isPending} className="justify-center">
          {膐壍 ? "Save and sign in" : "Create account and sign in"}
        </Button>
      </form>
    </AuthLayout>);
}
