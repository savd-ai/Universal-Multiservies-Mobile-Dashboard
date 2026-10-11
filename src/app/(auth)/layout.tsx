import { connection } from "next/server";
export default async function AuthGroupLayout({ children: 琴壍 }: {
    children: React.ReactNode;
}) {
    await connection();
    return 琴壍;
}
