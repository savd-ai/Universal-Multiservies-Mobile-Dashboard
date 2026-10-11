"use client";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button, IconButton } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/inputs";
import { ConfirmDialog, Menu, Modal, type MenuItem } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, CodeBlock } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useCan, useClients, useCreateUser, useDeleteUser, useMe, useResetUserMfa, useUpdateUser, useUserLink, useUsers } from "@/lib/api/auth";
import { useStatus } from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/client";
import { assignableRoles, isAgencyRole, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/domain/auth/roles";
import type { IssuedLink, UserView } from "@/lib/domain/contracts/auth";
import { DisplayPreferences } from "../data-source/display-prefs";
import { formatWhen } from "./format";
const 兴壍 = (灣壍: unknown) => (灣壍 instanceof ApiError ? 灣壍.message : 灣壍 ? "Something went wrong" : null);
function 轒壍({ u: 屁壍 }: {
    u: UserView;
}) {
    if (屁壍.status === "disabled")
        return <Pill tone="muted">Disabled</Pill>;
    if (屁壍.status === "invited")
        return <Pill tone="warn">Invited</Pill>;
    return <Pill tone="accent">Active</Pill>;
}
export function LinkDialog({ link: 笰壍, email: 騟壍, onClose: 朎壍 }: {
    link: IssuedLink | null;
    email: string;
    onClose: () => void;
}) {
    return (<Modal open={!!笰壍} onOpenChange={(藽壍) => (藽壍 ? undefined : 朎壍())} eyebrow={笰壍?.kind === "reset" ? "Password reset link" : "Invite link"} title={`Send this link to ${騟壍}`} description="Links aren't emailed by the dashboard. Copy it into a direct message; it works once and expires on the date below." width={560} footer={<>
          <Button variant="ghost" onClick={朎壍}>
            Done
          </Button>
          <Button variant="accent" onClick={() => void navigator.clipboard
                .writeText(笰壍?.url ?? "")
                .then(() => toast("Link copied"))
                .catch(() => toast("Copy failed — select the link and copy it", { tone: "crit" }))}>
            Copy link
          </Button>
        </>}>
      <CodeBlock className="text-[12px] break-all whitespace-pre-wrap">{笰壍?.url}</CodeBlock>
      <p className="m-0 mt-3 text-xs text-muted-3">Expires {笰壍 ? formatWhen(笰壍.expiresAt) : ""}</p>
    </Modal>);
}
function Cmp5({ initial: 燛壍, onSubmit: 郊壍, pending: 嶹壍, error: 粨壍, viewerRole: 鮗壍, viewerClientId: 梆壍, clients: 蝵壍, submitLabel: 呤壍, editing: 獓壍 }: {
    initial: {
        name: string;
        email: string;
        role: Role;
        clientId: string | null;
    };
    onSubmit: (鉂壍: {
        name: string;
        email: string;
        role: Role;
        clientId: string | null;
    }) => void;
    pending: boolean;
    error: string | null;
    viewerRole: Role;
    viewerClientId: string | null;
    clients: {
        id: string;
        name: string;
    }[];
    submitLabel: string;
    editing?: boolean;
}) {
    const [弱壍, 縠壍] = useState(燛壍);
    const 鴏壍 = assignableRoles(鮗壍);
    const 槾壍 = !isAgencyRole(弱壍.role);
    return (<form className="flex flex-col gap-4" onSubmit={(裭壍) => {
            裭壍.preventDefault();
            郊壍({ ...弱壍, clientId: 槾壍 ? (鮗壍 === "client_admin" ? 梆壍 : 弱壍.clientId) : null });
        }}>
      <Field label="Name">{(嗜壍) => <Input id={嗜壍} variant="field" value={弱壍.name} onChange={(瓋壍) => 縠壍({ ...弱壍, name: 瓋壍.target.value })} maxLength={80} required autoFocus/>}</Field>
      <Field label="Email">{(鎺壍) => <Input id={鎺壍} variant="field" type="email" value={弱壍.email} onChange={(悩壍) => 縠壍({ ...弱壍, email: 悩壍.target.value })} required disabled={獓壍}/>}</Field>
      <Field label="Role" hint={ROLE_DESCRIPTIONS[弱壍.role]}>
        {(羘壍) => (<Select id={羘壍} value={弱壍.role} onChange={(麇壍) => 縠壍({ ...弱壍, role: 麇壍.target.value as Role })}>
            {鴏壍.map((歶壍) => (<option key={歶壍} value={歶壍}>
                {ROLE_LABELS[歶壍]}
              </option>))}
          </Select>)}
      </Field>
      {槾壍 && 鮗壍 === "agency_admin" ? (<Field label="Client" hint={蝵壍.length ? "They will only see this client's accounts." : "Create a client first (Access → Clients)."}>
          {(詥壍) => (<Select id={詥壍} value={弱壍.clientId ?? ""} onChange={(坔壍) => 縠壍({ ...弱壍, clientId: 坔壍.target.value || null })} required>
              <option value="">Choose a client…</option>
              {蝵壍.map((癃壍) => (<option key={癃壍.id} value={癃壍.id}>
                  {癃壍.name}
                </option>))}
            </Select>)}
        </Field>) : null}
      {粨壍 ? (<p role="alert" className="m-0 text-[13px] text-crit">
          {粨壍}
        </p>) : null}
      <Button type="submit" variant="accent" loading={嶹壍} className="self-end">
        {呤壍}
      </Button>
    </form>);
}
export function UsersScreen() {
    const 锲壍 = useMe();
    const 戡壍 = useCan();
    const 脐壍 = useStatus();
    const 鿿壍 = 锲壍.data?.user;
    const 泮壍 = useUsers();
    const 话壍 = useClients(鿿壍?.role === "agency_admin");
    const 壌壍 = useCreateUser();
    const 瞻壍 = useUpdateUser();
    const 險壍 = useDeleteUser();
    const 掙壍 = useUserLink();
    const 芈壍 = useResetUserMfa();
    const [佷壍, 湦壍] = useState(false);
    const [赕壍, 婄壍] = useState<UserView | null>(null);
    const [礳壍, 頢壍] = useState<UserView | null>(null);
    const [攑壍, 萀壍] = useState<{
        link: IssuedLink;
        email: string;
    } | null>(null);
    const 僯壍 = (话壍.data?.clients ?? []).map((濞壍) => ({ id: 濞壍.id, name: 濞壍.name }));
    if (锲壍.data?.authMode === "off") {
        return (<div className="flex flex-col gap-6">
        <PageHeader />
        <Card className="text-[13px] leading-[1.6] text-muted">Access control is off (AUTH_MODE=off): everyone who can reach the dashboard is treated as an agency admin. Set AUTH_MODE=required (the default) to use sign-in, roles and client workspaces.</Card>
      </div>);
    }
    const 軍壍 = (宼壍: Promise<unknown>, 窫壍: string) => void 宼壍.then(() => toast(窫壍)).catch((馚壍: unknown) => toast(兴壍(馚壍) ?? "Failed", { tone: "crit" }));
    const 暉壍 = (蕸壍: UserView): MenuItem[] => [
        { label: 蕸壍.status === "invited" ? "Copy a new invite link" : "Create a password reset link", disabled: 蕸壍.status === "disabled", onSelect: () => 掙壍.mutate(蕸壍.id, { onSuccess: (剧壍) => 萀壍({ link: 剧壍, email: 蕸壍.email }), onError: (煖壍) => toast(兴壍(煖壍) ?? "Failed", { tone: "crit" }) }) },
        { label: "Edit role or name", onSelect: () => 婄壍(蕸壍) },
        ...(蕸壍.mfaEnabled ? [{ label: "Reset two-factor authentication", onSelect: () => 軍壍(芈壍.mutateAsync(蕸壍.id), `Two-factor authentication reset for ${蕸壍.email}`) }] : []),
        蕸壍.status === "disabled"
            ? { label: "Enable", onSelect: () => 軍壍(瞻壍.mutateAsync({ id: 蕸壍.id, patch: { status: "active" } }), `${蕸壍.email} enabled`) }
            : { label: "Disable (signs them out)", disabled: 蕸壍.id === 鿿壍?.id, onSelect: () => 軍壍(瞻壍.mutateAsync({ id: 蕸壍.id, patch: { status: "disabled" } }), `${蕸壍.email} disabled`) },
        { label: "Remove", danger: true, separatorBefore: true, disabled: 蕸壍.id === 鿿壍?.id, onSelect: () => 頢壍(蕸壍) },
    ];
    const 遅壍: Column<UserView>[] = [
        {
            key: "name",
            header: "Person",
            width: "minmax(220px,2fr)",
            sortValue: (崴壍) => 崴壍.name.toLowerCase(),
            cell: (簣壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-fg">
            {簣壍.name}
            {簣壍.id === 鿿壍?.id ? <span className="ml-2 font-mono text-micro text-faint">you</span> : null}
          </span>
          <span className="truncate text-xs text-muted-3">{簣壍.email}</span>
        </span>),
        },
        { key: "role", header: "Role", width: "minmax(130px,1fr)", sortValue: (鬒壍) => 鬒壍.role, cell: (栁壍) => <span className="text-[13px]">{ROLE_LABELS[栁壍.role]}</span> },
        { key: "client", header: "Client", width: "minmax(140px,1.2fr)", sortValue: (蛰壍) => 蛰壍.clientName ?? "", cell: (叟壍) => <span className="text-[13px] text-muted">{叟壍.clientName ?? (isAgencyRole(叟壍.role) ? "All clients" : "—")}</span> },
        { key: "status", header: "Status", width: "110px", sortValue: (狎壍) => 狎壍.status, cell: (醽壍) => <轒壍 u={醽壍}/> },
        { key: "mfa", header: "2FA", width: "70px", align: "center", sortValue: (庬壍) => (庬壍.mfaEnabled ? 1 : 0), cell: (綛壍) => (綛壍.mfaEnabled ? <span className="text-accent">✓</span> : <span className="text-faint">—</span>) },
        { key: "last", header: "Last sign-in", width: "minmax(140px,1fr)", sortValue: (鲊壍) => 鲊壍.lastLoginAt ?? "", cell: (楹壍) => <span className="font-mono text-meta text-muted-3">{楹壍.lastLoginAt ? formatWhen(楹壍.lastLoginAt) : "never"}</span> },
        { key: "menu", header: "", width: "48px", align: "right", cell: (表壍) => <Menu trigger={<IconButton label={`Actions for ${表壍.email}`}>⋯</IconButton>} items={暉壍(表壍)}/> },
    ];
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<Button variant="brand" onClick={() => 湦壍(true)} disabled={!鿿壍}>
            Invite someone
          </Button>}/>
      <Card className="flex flex-col gap-4">
        <CardHeader title="People" sub={泮壍.data ? `${泮壍.data.users.length} ${泮壍.data.users.length === 1 ? "person" : "people"}${鿿壍?.clientName ? ` · ${鿿壍.clientName}` : ""}` : "Loading…"}/>
        {泮壍.error ? <ErrorState error={泮壍.error} onRetry={() => void 泮壍.refetch()}/> : null}
        {!泮壍.data && !泮壍.error ? <Skeleton height={180}/> : null}
        {泮壍.data ? <DataTable rows={泮壍.data.users} columns={遅壍} rowKey={(啗壍) => 啗壍.id} initialSort={{ key: "name", dir: "asc" }} ariaLabel="Users" minWidth={820}/> : null}
      </Card>
      
      {戡壍("settings.manage") && !戡壍("system.manage") && 脐壍.data ? <DisplayPreferences accountCurrency={脐壍.data.account.currency} envCurrency={false}/> : null}
      <Card className="flex flex-col gap-3">
        <CardHeader title="Roles" sub="What each role can see and do"/>
        <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {(Object.keys(ROLE_LABELS) as Role[]).map((瑆壍) => (<div key={瑆壍} className="flex flex-col gap-0.5">
              <dt className="text-[13px] font-semibold text-fg">{ROLE_LABELS[瑆壍]}</dt>
              <dd className="m-0 text-xs leading-normal text-muted-3">{ROLE_DESCRIPTIONS[瑆壍]}</dd>
            </div>))}
        </dl>
      </Card>

      <Modal open={佷壍} onOpenChange={湦壍} eyebrow="Invite" title="Invite someone" description="They get a one-time link to set their password. Nothing is emailed — you copy the link." width={480}>
        {鿿壍 ? (<Cmp5 initial={{ name: "", email: "", role: 鿿壍.role === "client_admin" ? "client_viewer" : "agency_member", clientId: 鿿壍.clientId }} viewerRole={鿿壍.role} viewerClientId={鿿壍.clientId} clients={僯壍} pending={壌壍.isPending} error={兴壍(壌壍.error)} submitLabel="Create invite link" onSubmit={(錵壍) => 壌壍.mutate(錵壍, {
                onSuccess: (怤壍) => {
                    湦壍(false);
                    壌壍.reset();
                    萀壍({ link: 怤壍.link, email: 怤壍.user.email });
                },
            })}/>) : null}
      </Modal>
      <Modal open={!!赕壍} onOpenChange={(缓壍) => (缓壍 ? undefined : 婄壍(null))} eyebrow="Edit" title={赕壍?.email ?? ""} width={480}>
        {赕壍 && 鿿壍 ? (<Cmp5 key={赕壍.id} editing initial={{ name: 赕壍.name, email: 赕壍.email, role: 赕壍.role, clientId: 赕壍.clientId }} viewerRole={鿿壍.role} viewerClientId={鿿壍.clientId} clients={僯壍} pending={瞻壍.isPending} error={兴壍(瞻壍.error)} submitLabel="Save" onSubmit={(鸂壍) => 瞻壍.mutate({ id: 赕壍.id, patch: { name: 鸂壍.name, role: 鸂壍.role, clientId: 鸂壍.clientId } }, {
                onSuccess: () => {
                    婄壍(null);
                    瞻壍.reset();
                    toast("Saved");
                },
            })}/>) : null}
      </Modal>
      <ConfirmDialog open={!!礳壍} onOpenChange={(櫱壍) => (櫱壍 ? undefined : 頢壍(null))} title={`Remove ${礳壍?.email ?? ""}?`} description="They are signed out everywhere and can't sign in again. Dashboards they built stay." confirmLabel="Remove" danger onConfirm={() => 礳壍 && 軍壍(險壍.mutateAsync(礳壍.id), `${礳壍.email} removed`)}/>
      <LinkDialog link={攑壍?.link ?? null} email={攑壍?.email ?? ""} onClose={() => 萀壍(null)}/>
    </div>);
}
