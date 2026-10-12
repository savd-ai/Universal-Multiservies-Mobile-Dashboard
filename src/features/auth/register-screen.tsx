"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/inputs";
import { useRegister } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { PASSWORD_MIN } from "@/lib/domain/contracts/auth";
import { hardNavigate } from "@/lib/navigation";
import { AuthLayout, FormError } from "./auth-layout";

/** Self-service sign-up. No setup code: the first account becomes the agency admin, later ones wait for access. */
export function RegisterScreen({ firstAccount, next }: { firstAccount: boolean; next?: string }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [localError, setLocalError] = useState<string | null>(null);
  const register = useRegister();
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  return (
    <AuthLayout eyebrow={firstAccount ? "First run" : "Register"} headline={firstAccount ? "Create the first *admin*" : "Create your *account*"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.password !== form.confirm) return setLocalError("The passwords don't match");
          setLocalError(null);
          register.mutate({ name: form.name, email: form.email, password: form.password }, { onSuccess: (res) => hardNavigate(next ?? res.next) });
        }}
      >
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          {firstAccount
            ? "Nobody has an account yet. The first account becomes the agency admin; you can invite or approve everyone else afterwards."
            : "New accounts start without access to any client. An admin assigns you to a client (or a team role) before data appears."}
        </p>
        <Field label="Your name">{(id) => <Input id={id} variant="field" value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} autoFocus required />}</Field>
        <Field label="Email">{(id) => <Input id={id} variant="field" type="email" value={form.email} onChange={set("email")} autoComplete="username" required />}</Field>
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters`}>
          {(id) => <Input id={id} variant="field" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={PASSWORD_MIN} required />}
        </Field>
        <Field label="Repeat password">{(id) => <Input id={id} variant="field" type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />}</Field>
        <FormError message={localError ?? (register.error instanceof ApiError ? register.error.message : register.error ? "Registration failed. Try again." : null)} />
        <Button type="submit" variant="brand" loading={register.isPending} className="justify-center">
          {firstAccount ? "Create admin and sign in" : "Create account"}
        </Button>
        {firstAccount ? null : (
          <p className="m-0 text-[13px] leading-[1.6] text-muted">
            Already have an account?{" "}
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold">
              Sign in
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
