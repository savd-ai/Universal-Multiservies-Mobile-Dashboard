"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/inputs";
import { useSetup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/navigation";
import { PASSWORD_MIN } from "@/lib/domain/contracts/auth";
import { AuthLayout, FormError } from "./auth-layout";

// First run: create the first agency admin with the one-time setup code from the server log (or AUTH_SETUP_TOKEN).
export function SetupScreen() {
  const [form, setForm] = useState({ code: "", name: "", email: "", password: "", confirm: "" });
  const [local, setLocal] = useState<string | null>(null);
  const setup = useSetup();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <AuthLayout eyebrow="First run" headline="Create the first *admin*">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.password !== form.confirm) return setLocal("The passwords don't match");
          setLocal(null);
          setup.mutate({ code: form.code, name: form.name, email: form.email, password: form.password }, { onSuccess: (r) => hardNavigate(r.next) });
        }}
      >
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          Nobody has an account yet. Enter the one-time setup code printed in the server log (or the value of <code className="font-mono text-fg">AUTH_SETUP_TOKEN</code>) to create the first agency admin. You can invite everyone else afterwards.
        </p>
        <Field label="Setup code">{(id) => <Input id={id} variant="field" value={form.code} onChange={set("code")} autoComplete="off" spellCheck={false} className="font-mono" autoFocus required />}</Field>
        <Field label="Your name">{(id) => <Input id={id} variant="field" value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} required />}</Field>
        <Field label="Email">{(id) => <Input id={id} variant="field" type="email" value={form.email} onChange={set("email")} autoComplete="username" required />}</Field>
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(id) => <Input id={id} variant="field" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={PASSWORD_MIN} required />}
        </Field>
        <Field label="Repeat password">{(id) => <Input id={id} variant="field" type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />}</Field>
        <FormError message={local ?? (setup.error instanceof ApiError ? setup.error.message : setup.error ? "Setup failed. Try again." : null)} />
        <Button type="submit" variant="brand" loading={setup.isPending} className="justify-center">
          Create admin and sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
