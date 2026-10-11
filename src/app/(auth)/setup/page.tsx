import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupScreen } from "@/features/auth/setup-screen";
import { announceSetup, setupRequired } from "@/lib/server/auth/setup";
export const metadata: Metadata = { title: "Set up" };
export default async function SetupPage() {
    if (!(await setupRequired()))
        redirect("/login");
    await announceSetup();
    return <SetupScreen />;
}
