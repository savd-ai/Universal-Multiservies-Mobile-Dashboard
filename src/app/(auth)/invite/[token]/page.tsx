import type { Metadata } from "next";
import { InviteScreen } from "@/features/auth/invite-screen";
export const metadata: Metadata = { title: "Invitation" };
export default async function InvitePage({ params }: {
    params: Promise<{
        token: string;
    }>;
}) {
    const { token } = await params;
    return <InviteScreen token={token}/>;
}
