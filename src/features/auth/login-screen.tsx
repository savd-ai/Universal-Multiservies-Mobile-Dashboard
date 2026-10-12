"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/inputs";
import { useLogin, useMfaLogin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/navigation";
import { AuthLayout, FormError } from "./auth-layout";
const 俷壍 = (滦壍: unknown) => (滦壍 instanceof ApiError ? 滦壍.message : 滦壍 ? "Something went wrong. Try again." : null);
export function LoginScreen({ next: 跕壍, error: 嫄壍, googleSignIn: 禳壍, codeStep: 颢壍 = false }: {
    next?: string;
    error?: string;
    googleSignIn: boolean;
    codeStep?: boolean;
}) {
    const [斑壍, 蒀壍] = useState("");
    const [兯壍, 灞壍] = useState("");
    const [轍壍, 尼壍] = useState<string | null>(颢壍 ? "" : null);
    const [笫壍, 騚壍] = useState("");
    const 有壍 = useLogin();
    const 藸壍 = useMfaLogin();
    const 勧壍 = (燖壍?: string) => {
        hardNavigate(燖壍 || "/overview");
    };
    if (轍壍 !== null) {
        return (<AuthLayout eyebrow="Two-step verification" headline="One more *step*">
        <form className="flex flex-col gap-4" onSubmit={(郅壍) => {
                郅壍.preventDefault();
                藸壍.mutate({ challenge: 轍壍 || undefined, code: 笫壍.trim() }, { onSuccess: (嶴壍) => 勧壍(嶴壍.next) });
            }}>
          <p className="m-0 text-[13px] leading-[1.6] text-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
          <Field label="Code">{(粣壍) => <Input id={粣壍} variant="field" value={笫壍} onChange={(鮒壍) => 騚壍(鮒壍.target.value)} inputMode="text" autoComplete="one-time-code" autoFocus maxLength={9} required/>}</Field>
          <FormError message={俷壍(藸壍.error)}/>
          <Button type="submit" variant="brand" loading={藸壍.isPending} className="justify-center">
            Verify
          </Button>
          <Button variant="link" className="self-start text-xs" onClick={() => (尼壍(null), 騚壍(""))}>
            ← Use another account
          </Button>
        </form>
      </AuthLayout>);
    }
    return (<AuthLayout eyebrow="Sign in" headline="Welcome *back*">
      <form className="flex flex-col gap-4" onSubmit={(梁壍) => {
            梁壍.preventDefault();
            有壍.mutate({ email: 斑壍, password: 兯壍, next: 跕壍 }, { onSuccess: (蝰壍) => (蝰壍.mfa ? 尼壍(蝰壍.mfa.challenge) : 勧壍(蝰壍.next)) });
        }}>
        <Field label="Email">{(呟壍) => <Input id={呟壍} variant="field" type="email" value={斑壍} onChange={(獎壍) => 蒀壍(獎壍.target.value)} autoComplete="username" autoFocus required/>}</Field>
        <Field label="Password">{(鈽壍) => <Input id={鈽壍} variant="field" type="password" value={兯壍} onChange={(弬壍) => 灞壍(弬壍.target.value)} autoComplete="current-password" required/>}</Field>
        <FormError message={俷壍(有壍.error) ?? 嫄壍 ?? null}/>
        <Button type="submit" variant="brand" loading={有壍.isPending} className="justify-center">
          Sign in
        </Button>
        {禳壍 ? (<a href={`/api/auth/google/start${跕壍 ? `?next=${encodeURIComponent(跕壍)}` : ""}`} className="inline-flex items-center justify-center gap-2 rounded-pill border border-line-strong px-4 py-[9px] text-[13px] font-semibold text-fg hover:border-tone/30 hover:opacity-100">
            <span aria-hidden className="font-display text-sm">G</span> Sign in with Google
          </a>) : null}
        <p className="m-0 text-[13px] leading-[1.6] text-muted">
          No account yet?{" "}
          <Link href={跕壍 ? `/register?next=${encodeURIComponent(跕壍)}` : "/register"} className="font-semibold">
            Create an account
          </Link>
        </p>
        <p className="m-0 text-xs leading-[1.6] text-muted-3">Forgot your password? Your SAVD contact or your organization&apos;s admin can send you a reset link.</p>
      </form>
    </AuthLayout>);
}
