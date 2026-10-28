"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/inputs";
import { useLogin, useMfaLogin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/navigation";
import { AuthLayout, FormError } from "./auth-layout";
const message = (err: unknown) => (err instanceof ApiError ? err.message : err ? "Something went wrong. Try again." : null);
export function LoginScreen({ next, error, googleSignIn, codeStep = false }: {
    next?: string;
    error?: string;
    googleSignIn: boolean;
    codeStep?: boolean;
}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [challenge, setChallenge] = useState<string | null>(codeStep ? "" : null);
    const [code, setCode] = useState("");
    const login = useLogin();
    const mfa = useMfaLogin();
    const go = (to?: string) => {
        hardNavigate(to || "/overview");
    };
    if (challenge !== null) {
        return (<AuthLayout eyebrow="Two-step verification" headline="One more *step*">
        <form className="flex flex-col gap-4" onSubmit={(e) => {
                e.preventDefault();
                mfa.mutate({ challenge: challenge || undefined, code: code.trim() }, { onSuccess: (r) => go(r.next) });
            }}>
          <p className="m-0 text-[13px] leading-[1.6] text-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
          <Field label="Code">{(id) => <Input id={id} variant="field" value={code} onChange={(e) => setCode(e.target.value)} inputMode="text" autoComplete="one-time-code" autoFocus maxLength={9} required/>}</Field>
          <FormError message={message(mfa.error)}/>
          <Button type="submit" variant="brand" loading={mfa.isPending} className="justify-center">
            Verify
          </Button>
          <Button variant="link" className="self-start text-xs" onClick={() => (setChallenge(null), setCode(""))}>
            ← Use another account
          </Button>
        </form>
      </AuthLayout>);
    }
    return (<AuthLayout eyebrow="Sign in" headline="Welcome *back*">
      <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password, next }, { onSuccess: (r) => (r.mfa ? setChallenge(r.mfa.challenge) : go(r.next)) });
        }}>
        <Field label="Email">{(id) => <Input id={id} variant="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required/>}</Field>
        <Field label="Password">{(id) => <Input id={id} variant="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/>}</Field>
        <FormError message={message(login.error) ?? error ?? null}/>
        <Button type="submit" variant="brand" loading={login.isPending} className="justify-center">
          Sign in
        </Button>
        {googleSignIn ? (<a href={`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="inline-flex items-center justify-center gap-2 rounded-pill border border-line-strong px-4 py-[9px] text-[13px] font-semibold text-fg hover:border-tone/30 hover:opacity-100">
            <span aria-hidden className="font-display text-sm">G</span> Sign in with Google
          </a>) : null}
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          No account yet?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold">
            Create an account
          </Link>
        </p>
        <p className="m-0 text-xs leading-[1.6] text-muted-3">Forgot your password? Your SAVD contact or your organization&apos;s admin can send you a reset link.</p>
      </form>
    </AuthLayout>);
}
