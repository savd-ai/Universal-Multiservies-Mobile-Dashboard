import { redirect } from "next/navigation";
// The first admin no longer needs a setup code (2026-10-12): accounts are created at /register.
export default function SetupPage() {
    redirect("/register");
}
