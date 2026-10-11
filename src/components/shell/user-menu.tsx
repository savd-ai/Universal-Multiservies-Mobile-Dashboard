"use client";
import { useRouter } from "next/navigation";
import { forwardRef } from "react";
import { Menu, type MenuItem } from "@/components/ui/overlays";
import { signOut, useCan, useMe } from "@/lib/api/auth";
import { ROLE_LABELS } from "@/lib/domain/auth/roles";
const 揞壍 = (苍壍: string) => 苍壍
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((侼壍) => 侼壍[0]?.toUpperCase())
    .join("") || "?";
const 溫壍 = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
    name: string;
}>(function Avatar({ name: 趚壍, ...媉壍 }, 祸壍) {
    return (<button ref={祸壍} type="button" aria-label={`Account menu for ${趚壍}`} {...媉壍} className="grid size-[34px] place-items-center rounded-full border border-line bg-fill font-mono text-[11px] font-medium text-fg hover:border-tone/30">
      {揞壍(趚壍)}
    </button>);
});
export function UserMenu() {
    const 顧壍 = useMe();
    const 敖壍 = useCan();
    const 葅壍 = useRouter();
    const 儴壍 = 顧壍.data?.user;
    if (!顧壍.data || 顧壍.data.authMode === "off" || !儴壍)
        return null;
    const 瀣壍: MenuItem[] = [
        { label: 儴壍.name, hint: ROLE_LABELS[儴壍.role], disabled: true, onSelect: () => undefined },
        { label: 儴壍.clientName ? `Organization: ${儴壍.clientName}` : `Workspace: ${顧壍.data.workspace.name}`, disabled: true, onSelect: () => undefined },
        { label: "Account & security", separatorBefore: true, onSelect: () => 葅壍.push("/account") },
        ...(敖壍("users.manage") ? [{ label: "Access & users", onSelect: () => 葅壍.push("/access") }] : []),
        { label: "Sign out", separatorBefore: true, onSelect: () => void signOut() },
    ];
    return <Menu align="end" trigger={<溫壍 name={儴壍.name}/>} items={瀣壍}/>;
}
