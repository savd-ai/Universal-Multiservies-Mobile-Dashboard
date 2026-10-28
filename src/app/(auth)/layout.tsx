import { connection } from "next/server";
export default async function AuthGroupLayout({ children }: {
    children: React.ReactNode;
}) {
    await connection();
    return children;
}
