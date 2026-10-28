import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/domain/contracts/auth";
import { LoginScreen } from "@/features/auth/login-screen";
import { googleSignInEnabled } from "@/lib/server/auth/google";
import { principalFromCookies } from "@/lib/server/auth/principal";
import { setupRequired } from "@/lib/server/auth/setup";
import { authConfig } from "@/lib/server/env/config";
export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: {
    searchParams: Promise<{
        next?: string;
        error?: string;
        step?: string;
    }>;
}) {
    const { next, error, step } = await searchParams;
    if (authConfig().mode === "off")
        redirect(safeNext(next));
    if (await setupRequired())
        redirect("/register");
    if (await principalFromCookies())
        redirect(safeNext(next));
    return <LoginScreen next={next ? safeNext(next) : undefined} error={error?.slice(0, 200)} googleSignIn={googleSignInEnabled()} codeStep={step === "2fa"}/>;
}
