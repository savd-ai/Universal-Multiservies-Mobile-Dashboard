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
const errText = (e: unknown) => (e instanceof ApiError ? e.message : e ? "Something went wrong" : null);
function StatusPill({ u }: {
    u: UserView;
}) {
    if (u.status === "disabled")
        return <Pill tone="muted">Disabled</Pill>;
    if (u.status === "invited")
        return <Pill tone="warn">Invited</Pill>;
    return <Pill tone="accent">Active</Pill>;
}
export function LinkDialog({ link, email, onClose }: {
    link: IssuedLink | null;
    email: string;
    onClose: () => void;
}) {
    return (<Modal open={!!link} onOpenChange={(o) => (o ? undefined : onClose())} eyebrow={link?.kind === "reset" ? "Password reset link" : "Invite link"} title={`Send this link to ${email}`} description="Links aren't emailed by the dashboard. Copy it into a direct message; it works once and expires on the date below." width={560} footer={<>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
          <Button variant="accent" onClick={() => void navigator.clipboard
                .writeText(link?.url ?? "")
                .then(() => toast("Link copied"))
                .catch(() => toast("Copy failed — select the link and copy it", { tone: "crit" }))}>
            Copy link
          </Button>
        </>}>
      <CodeBlock className="text-[12px] break-all whitespace-pre-wrap">{link?.url}</CodeBlock>
      <p className="m-0 mt-3 text-xs text-muted-3">Expires {link ? formatWhen(link.expiresAt) : ""}</p>
    </Modal>);
}
function UserForm({ initial, onSubmit, pending, error, viewerRole, viewerClientId, clients, submitLabel, editing }: {
    initial: {
        name: string;
        email: string;
        role: Role;
        clientId: string | null;
    };
    onSubmit: (v: {
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
    const [v, setV] = useState(initial);
    const roles = assignableRoles(viewerRole);
    const needsClient = !isAgencyRole(v.role);
    return (<form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ ...v, clientId: needsClient ? (viewerRole === "client_admin" ? viewerClientId : v.clientId) : null });
        }}>
      <Field label="Name">{(id) => <Input id={id} variant="field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} required autoFocus/>}</Field>
      <Field label="Email">{(id) => <Input id={id} variant="field" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required disabled={editing}/>}</Field>
      <Field label="Role" hint={ROLE_DESCRIPTIONS[v.role]}>
        {(id) => (<Select id={id} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
            {roles.map((r) => (<option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>))}
          </Select>)}
      </Field>
      {needsClient && viewerRole === "agency_admin" ? (<Field label="Client" hint={clients.length ? "They will only see this client's accounts." : "Create a client first (Access → Clients)."}>
          {(id) => (<Select id={id} value={v.clientId ?? ""} onChange={(e) => setV({ ...v, clientId: e.target.value || null })} required>
              <option value="">Choose a client…</option>
              {clients.map((c) => (<option key={c.id} value={c.id}>
                  {c.name}
                </option>))}
            </Select>)}
        </Field>) : null}
      {error ? (<p role="alert" className="m-0 text-[13px] text-crit">
          {error}
        </p>) : null}
      <Button type="submit" variant="accent" loading={pending} className="self-end">
        {submitLabel}
      </Button>
    </form>);
}
export function UsersScreen() {
    const me = useMe();
    const can = useCan();
    const status = useStatus();
    const viewer = me.data?.user;
    const users = useUsers();
    const clients = useClients(viewer?.role === "agency_admin");
    const create = useCreateUser();
    const update = useUpdateUser();
    const remove = useDeleteUser();
    const linkFor = useUserLink();
    const resetMfa = useResetUserMfa();
    const [inviting, setInviting] = useState(false);
    const [editing, setEditing] = useState<UserView | null>(null);
    const [removing, setRemoving] = useState<UserView | null>(null);
    const [link, setLink] = useState<{
        link: IssuedLink;
        email: string;
    } | null>(null);
    const clientOptions = (clients.data?.clients ?? []).map((c) => ({ id: c.id, name: c.name }));
    if (me.data?.authMode === "off") {
        return (<div className="flex flex-col gap-6">
        <PageHeader />
        <Card className="text-[13px] leading-[1.6] text-muted">Access control is off (AUTH_MODE=off): everyone who can reach the dashboard is treated as an agency admin. Set AUTH_MODE=required (the default) to use sign-in, roles and client workspaces.</Card>
      </div>);
    }
    const act = (p: Promise<unknown>, ok: string) => void p.then(() => toast(ok)).catch((e: unknown) => toast(errText(e) ?? "Failed", { tone: "crit" }));
    const menuFor = (u: UserView): MenuItem[] => [
        { label: u.status === "invited" ? "Copy a new invite link" : "Create a password reset link", disabled: u.status === "disabled", onSelect: () => linkFor.mutate(u.id, { onSuccess: (l) => setLink({ link: l, email: u.email }), onError: (e) => toast(errText(e) ?? "Failed", { tone: "crit" }) }) },
        { label: "Edit role or name", onSelect: () => setEditing(u) },
        ...(u.mfaEnabled ? [{ label: "Reset two-factor authentication", onSelect: () => act(resetMfa.mutateAsync(u.id), `Two-factor authentication reset for ${u.email}`) }] : []),
        u.status === "disabled"
            ? { label: "Enable", onSelect: () => act(update.mutateAsync({ id: u.id, patch: { status: "active" } }), `${u.email} enabled`) }
            : { label: "Disable (signs them out)", disabled: u.id === viewer?.id, onSelect: () => act(update.mutateAsync({ id: u.id, patch: { status: "disabled" } }), `${u.email} disabled`) },
        { label: "Remove", danger: true, separatorBefore: true, disabled: u.id === viewer?.id, onSelect: () => setRemoving(u) },
    ];
    const columns: Column<UserView>[] = [
        {
            key: "name",
            header: "Person",
            width: "minmax(220px,2fr)",
            sortValue: (u) => u.name.toLowerCase(),
            cell: (u) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-fg">
            {u.name}
            {u.id === viewer?.id ? <span className="ml-2 font-mono text-micro text-faint">you</span> : null}
          </span>
          <span className="truncate text-xs text-muted-3">{u.email}</span>
        </span>),
        },
        { key: "role", header: "Role", width: "minmax(130px,1fr)", sortValue: (u) => u.role, cell: (u) => <span className="text-[13px]">{ROLE_LABELS[u.role]}</span> },
        { key: "client", header: "Client", width: "minmax(140px,1.2fr)", sortValue: (u) => u.clientName ?? "", cell: (u) => <span className="text-[13px] text-muted">{u.clientName ?? (isAgencyRole(u.role) ? "All clients" : "—")}</span> },
        { key: "status", header: "Status", width: "110px", sortValue: (u) => u.status, cell: (u) => <StatusPill u={u}/> },
        { key: "mfa", header: "2FA", width: "70px", align: "center", sortValue: (u) => (u.mfaEnabled ? 1 : 0), cell: (u) => (u.mfaEnabled ? <span className="text-accent">✓</span> : <span className="text-faint">—</span>) },
        { key: "last", header: "Last sign-in", width: "minmax(140px,1fr)", sortValue: (u) => u.lastLoginAt ?? "", cell: (u) => <span className="font-mono text-meta text-muted-3">{u.lastLoginAt ? formatWhen(u.lastLoginAt) : "never"}</span> },
        { key: "menu", header: "", width: "48px", align: "right", cell: (u) => <Menu trigger={<IconButton label={`Actions for ${u.email}`}>⋯</IconButton>} items={menuFor(u)}/> },
    ];
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<Button variant="brand" onClick={() => setInviting(true)} disabled={!viewer}>
            Invite someone
          </Button>}/>
      <Card className="flex flex-col gap-4">
        <CardHeader title="People" sub={users.data ? `${users.data.users.length} ${users.data.users.length === 1 ? "person" : "people"}${viewer?.clientName ? ` · ${viewer.clientName}` : ""}` : "Loading…"}/>
        {users.error ? <ErrorState error={users.error} onRetry={() => void users.refetch()}/> : null}
        {!users.data && !users.error ? <Skeleton height={180}/> : null}
        {users.data ? <DataTable rows={users.data.users} columns={columns} rowKey={(u) => u.id} initialSort={{ key: "name", dir: "asc" }} ariaLabel="Users" minWidth={820}/> : null}
      </Card>
      
      {can("settings.manage") && !can("system.manage") && status.data ? <DisplayPreferences accountCurrency={status.data.account.currency} envCurrency={false}/> : null}
      <Card className="flex flex-col gap-3">
        <CardHeader title="Roles" sub="What each role can see and do"/>
        <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (<div key={r} className="flex flex-col gap-0.5">
              <dt className="text-[13px] font-semibold text-fg">{ROLE_LABELS[r]}</dt>
              <dd className="m-0 text-xs leading-normal text-muted-3">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>))}
        </dl>
      </Card>

      <Modal open={inviting} onOpenChange={setInviting} eyebrow="Invite" title="Invite someone" description="They get a one-time link to set their password. Nothing is emailed — you copy the link." width={480}>
        {viewer ? (<UserForm initial={{ name: "", email: "", role: viewer.role === "client_admin" ? "client_viewer" : "agency_member", clientId: viewer.clientId }} viewerRole={viewer.role} viewerClientId={viewer.clientId} clients={clientOptions} pending={create.isPending} error={errText(create.error)} submitLabel="Create invite link" onSubmit={(v) => create.mutate(v, {
                onSuccess: (r) => {
                    setInviting(false);
                    create.reset();
                    setLink({ link: r.link, email: r.user.email });
                },
            })}/>) : null}
      </Modal>
      <Modal open={!!editing} onOpenChange={(o) => (o ? undefined : setEditing(null))} eyebrow="Edit" title={editing?.email ?? ""} width={480}>
        {editing && viewer ? (<UserForm key={editing.id} editing initial={{ name: editing.name, email: editing.email, role: editing.role, clientId: editing.clientId }} viewerRole={viewer.role} viewerClientId={viewer.clientId} clients={clientOptions} pending={update.isPending} error={errText(update.error)} submitLabel="Save" onSubmit={(v) => update.mutate({ id: editing.id, patch: { name: v.name, role: v.role, clientId: v.clientId } }, {
                onSuccess: () => {
                    setEditing(null);
                    update.reset();
                    toast("Saved");
                },
            })}/>) : null}
      </Modal>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => (o ? undefined : setRemoving(null))} title={`Remove ${removing?.email ?? ""}?`} description="They are signed out everywhere and can't sign in again. Dashboards they built stay." confirmLabel="Remove" danger onConfirm={() => removing && act(remove.mutateAsync(removing.id), `${removing.email} removed`)}/>
      <LinkDialog link={link?.link ?? null} email={link?.email ?? ""} onClose={() => setLink(null)}/>
    </div>);
}
