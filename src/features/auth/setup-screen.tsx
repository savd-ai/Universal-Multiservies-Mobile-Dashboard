"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/inputs";
import { useSetup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/navigation";
import { PASSWORD_MIN } from "@/lib/domain/contracts/auth";
import { AuthLayout, FormError } from "./auth-layout";
export function SetupScreen() {
    const [縛壍, 鴊壍] = useState({ code: "", name: "", email: "", password: "", confirm: "" });
    const [槹壍, 裨壍] = useState<string | null>(null);
    const 嗗壍 = useSetup();
    const 瓆壍 = (鎵壍: keyof typeof 縛壍) => (悤壍: React.ChangeEvent<HTMLInputElement>) => 鴊壍((羓壍) => ({ ...羓壍, [鎵壍]: 悤壍.target.value }));
    return (<AuthLayout eyebrow="First run" headline="Create the first *admin*">
      <form className="flex flex-col gap-4" onSubmit={(麂壍) => {
            麂壍.preventDefault();
            if (縛壍.password !== 縛壍.confirm)
                return 裨壍("The passwords don't match");
            裨壍(null);
            嗗壍.mutate({ code: 縛壍.code, name: 縛壍.name, email: 縛壍.email, password: 縛壍.password }, { onSuccess: (歱壍) => hardNavigate(歱壍.next) });
        }}>
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          Nobody has an account yet. Enter the one-time setup code printed in the server log (or the value of <code className="font-mono text-fg">AUTH_SETUP_TOKEN</code>) to create the first agency admin. You can invite everyone else afterwards.
        </p>
        <Field label="Setup code">{(詠壍) => <Input id={詠壍} variant="field" value={縛壍.code} onChange={瓆壍("code")} autoComplete="off" spellCheck={false} className="font-mono" autoFocus required/>}</Field>
        <Field label="Your name">{(坏壍) => <Input id={坏壍} variant="field" value={縛壍.name} onChange={瓆壍("name")} autoComplete="name" maxLength={80} required/>}</Field>
        <Field label="Email">{(瘾壍) => <Input id={瘾壍} variant="field" type="email" value={縛壍.email} onChange={瓆壍("email")} autoComplete="username" required/>}</Field>
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(锭壍) => <Input id={锭壍} variant="field" type="password" value={縛壍.password} onChange={瓆壍("password")} autoComplete="new-password" minLength={PASSWORD_MIN} required/>}
        </Field>
        <Field label="Repeat password">{(戜壍) => <Input id={戜壍} variant="field" type="password" value={縛壍.confirm} onChange={瓆壍("confirm")} autoComplete="new-password" required/>}</Field>
        <FormError message={槹壍 ?? (嗗壍.error instanceof ApiError ? 嗗壍.error.message : 嗗壍.error ? "Setup failed. Try again." : null)}/>
        <Button type="submit" variant="brand" loading={嗗壍.isPending} className="justify-center">
          Create admin and sign in
        </Button>
      </form>
    </AuthLayout>);
}
