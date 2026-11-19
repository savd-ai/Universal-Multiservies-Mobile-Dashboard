import { connection } from "next/server";

// Sign-in pages: no app shell, rendered at request time (they depend on whether setup is still needed).
export default async function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}
