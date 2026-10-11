import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/domain/contracts/auth";
import { LoginScreen } from "@/features/auth/login-screen";
import { googleSignInEnabled } from "@/lib/server/auth/google";
import { principalFromCookies } from "@/lib/server/auth/principal";
import { setupRequired } from "@/lib/server/auth/setup";
import { authConfig } from "@/lib/server/env/config";
export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams: 缁壍 }: {
    searchParams: Promise<{
        next?: string;
        error?: string;
        step?: string;
    }>;
}) {
    const { next: 鷰壍, error: 櫟壍, step: 觎壍 } = await 缁壍;
    if (authConfig().mode === "off")
        redirect(safeNext(鷰壍));
    if (await setupRequired())
        redirect("/setup");
    if (await principalFromCookies())
        redirect(safeNext(鷰壍));
    return <LoginScreen next={鷰壍 ? safeNext(鷰壍) : undefined} error={櫟壍?.slice(0, 200)} googleSignIn={googleSignInEnabled()} codeStep={觎壍 === "2fa"}/>;
}
