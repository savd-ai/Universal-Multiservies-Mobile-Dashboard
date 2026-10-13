import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterScreen } from "@/features/auth/register-screen";
import { safeNext } from "@/lib/domain/contracts/auth";
import { principalFromCookies } from "@/lib/server/auth/principal";
import { announceSetup, setupRequired, setupTokenConfigured } from "@/lib/server/auth/setup";
import { authConfig } from "@/lib/server/env/config";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (authConfig().mode === "off") redirect(safeNext(next));
  if (await principalFromCookies()) redirect(safeNext(next));
  const firstAccount = await setupRequired();
  if (firstAccount) await announceSetup();
  return <RegisterScreen firstAccount={firstAccount} setupCodeRequired={firstAccount && setupTokenConfigured()} next={next ? safeNext(next) : undefined} />;
}
