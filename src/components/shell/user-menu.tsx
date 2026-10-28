"use client";
import { useRouter } from "next/navigation";
import { forwardRef } from "react";
import { Menu, type MenuItem } from "@/components/ui/overlays";
import { signOut, useCan, useMe } from "@/lib/api/auth";
import { ROLE_LABELS } from "@/lib/domain/auth/roles";
const initials = (name: string) => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
const Avatar2 = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
    name: string;
}>(function Avatar({ name, ...rest }, ref) {
    return (<button ref={ref} type="button" aria-label={`Account menu for ${name}`} {...rest} className="grid size-[34px] place-items-center rounded-full border border-line bg-fill font-mono text-[11px] font-medium text-fg hover:border-tone/30">
      {initials(name)}
    </button>);
});
export function UserMenu() {
    const me = useMe();
    const can = useCan();
    const router = useRouter();
    const user = me.data?.user;
    if (!me.data || me.data.authMode === "off" || !user)
        return null;
    const items: MenuItem[] = [
        { label: user.name, hint: ROLE_LABELS[user.role], disabled: true, onSelect: () => undefined },
        { label: user.clientName ? `Organization: ${user.clientName}` : `Workspace: ${me.data.workspace.name}`, disabled: true, onSelect: () => undefined },
        { label: "Account & security", separatorBefore: true, onSelect: () => router.push("/account") },
        ...(can("users.manage") ? [{ label: "Access & users", onSelect: () => router.push("/access") }] : []),
        { label: "Sign out", separatorBefore: true, onSelect: () => void signOut() },
    ];
    return <Menu align="end" trigger={<Avatar2 name={user.name}/>} items={items}/>;
}
