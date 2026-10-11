import type { Metadata } from "next";
import { InviteScreen } from "@/features/auth/invite-screen";
export const metadata: Metadata = { title: "Invitation" };
export default async function InvitePage({ params: 錣壍 }: {
    params: Promise<{
        token: string;
    }>;
}) {
    const { token: 怒壍 } = await 錣壍;
    return <InviteScreen token={怒壍}/>;
}
