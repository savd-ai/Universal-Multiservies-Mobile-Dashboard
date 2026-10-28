"use client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented } from "@/components/ui/controls";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/inputs";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { ClientView, DirectoryAccount } from "@/lib/domain/contracts/auth";
const errText = (e: unknown) => (e instanceof ApiError ? e.message : e ? "Something went wrong" : null);
const fmtId = (id: string) => id.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3");
interface Draft {
    name: string;
    notes: string;
    accountIds: string[];
    startFrom: "templates" | "agency";
}
function ClientForm({ initial, directory, clientId, isNew, pending, error, onSubmit }: {
    initial: Draft;
    directory: DirectoryAccount[];
    clientId: string | null;
    isNew: boolean;
    pending: boolean;
    error: string | null;
    onSubmit: (d: Draft) => void;
}) {
    const [d, setD] = useState(initial);
    const toggle = (id: string) => setD((x) => ({ ...x, accountIds: x.accountIds.includes(id) ? x.accountIds.filter((a) => a !== id) : [...x.accountIds, id] }));
    return (<form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            onSubmit(d);
        }}>
      <Field label="Client name">{(id) => <Input id={id} variant="field" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} required autoFocus/>}</Field>
      <Field label="Google Ads accounts" hint="Accounts reached through the agency's Google Ads credentials. An account belongs to one client at a time.">
        {() => (<div className="flex max-h-64 flex-col overflow-y-auto rounded-mini border border-line p-1.5">
            {directory.length === 0 ? <span className="px-2 py-3 text-xs text-muted-3">No accounts available (check the Google Ads connection on Data source).</span> : null}
            {directory.map((a) => {
                const elsewhere = a.clientId && a.clientId !== clientId;
                return (<label key={a.id} className={`flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] ${elsewhere ? "opacity-50" : "cursor-pointer hover:bg-fill"}`}>
                  <Checkbox checked={d.accountIds.includes(a.id)} onChange={() => (elsewhere ? undefined : toggle(a.id))} ariaLabel={a.name}/>
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="font-mono text-micro text-faint">{elsewhere ? `in ${a.clientName}` : `${fmtId(a.id)} · ${a.currency}`}</span>
                </label>);
            })}
          </div>)}
      </Field>
      <Field label="Notes (optional)">{(id) => <Textarea id={id} rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} maxLength={500}/>}</Field>
      {isNew ? (<Field label="Start the workspace from" hint={d.startFrom === "agency" ? "Copies the agency workspace's dashboards, saved questions, custom metrics and detection rules." : "The standard dashboard templates and default detection rules."}>
          {() => (<Segmented ariaLabel="Start the workspace from" variant="sans" value={d.startFrom} onChange={(v) => setD({ ...d, startFrom: v })} options={[
                    { value: "templates", label: "Default templates" },
                    { value: "agency", label: "Copy of the agency workspace" },
                ]}/>)}
        </Field>) : null}
      {error ? (<p role="alert" className="m-0 text-[13px] text-crit">
          {error}
        </p>) : null}
      <Button type="submit" variant="accent" loading={pending} className="self-end">
        {isNew ? "Create client" : "Save"}
      </Button>
    </form>);
}
export function ClientsAdminScreen() {
    const q = useClients();
    const create = useCreateClient();
    const update = useUpdateClient();
    const remove = useDeleteClient();
    const [editing, setEditing] = useState<ClientView | "new" | null>(null);
    const [removing, setRemoving] = useState<ClientView | null>(null);
    const directory = useMemo(() => q.data?.directory ?? [], [q.data]);
    const unassigned = directory.filter((a) => !a.clientId);
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<Button variant="brand" onClick={() => setEditing("new")}>
            New client
          </Button>}/>
      {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()}/> : null}
      {!q.data && !q.error ? <Skeleton height={220}/> : null}
      {q.data ? (<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {q.data.clients.map((c) => (<Card key={c.id} className="flex flex-col gap-3.5">
              <CardHeader title={c.name} sub={`${c.accountIds.length} account${c.accountIds.length === 1 ? "" : "s"} · ${c.userCount} user${c.userCount === 1 ? "" : "s"}`} action={<span className="flex items-center gap-1.5">
                    <Button variant="ghost" size="xs" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="xs" onClick={() => setRemoving(c)}>
                      Delete
                    </Button>
                  </span>}/>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {c.accounts.map((a) => (<li key={a.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate">{a.name}</span>
                    <span className="font-mono text-micro text-faint">
                      {fmtId(a.id)} · {a.currency}
                    </span>
                  </li>))}
                {c.missingAccountIds.map((id) => (<li key={id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-mono text-muted-3">{fmtId(id)}</span>
                    <Pill tone="warn">Not reachable</Pill>
                  </li>))}
                {!c.accountIds.length ? <li className="text-xs text-muted-3">No accounts yet — its users will see nothing until you assign one.</li> : null}
              </ul>
              {c.notes ? <p className="m-0 text-xs text-muted-3">{c.notes}</p> : null}
            </Card>))}
          <Card className="flex flex-col gap-3">
            <CardHeader title="Not assigned to a client" sub={`${unassigned.length} account${unassigned.length === 1 ? "" : "s"} · only agency roles see these`}/>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {unassigned.map((a) => (<li key={a.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate">{a.name}</span>
                  <span className="font-mono text-micro text-faint">
                    {fmtId(a.id)} · {a.currency}
                  </span>
                </li>))}
              {!unassigned.length ? <li className="text-xs text-muted-3">Every reachable account belongs to a client.</li> : null}
            </ul>
          </Card>
        </div>) : null}

      <Modal open={editing !== null} onOpenChange={(o) => (o ? undefined : setEditing(null))} eyebrow={editing === "new" ? "New client" : "Edit client"} title={editing === "new" ? "Add a client" : (editing?.name ?? "")} width={560}>
        {editing !== null ? (<ClientForm key={editing === "new" ? "new" : editing.id} isNew={editing === "new"} clientId={editing === "new" ? null : editing.id} directory={directory} initial={editing === "new" ? { name: "", notes: "", accountIds: [], startFrom: "templates" } : { name: editing.name, notes: editing.notes, accountIds: editing.accountIds, startFrom: "templates" }} pending={create.isPending || update.isPending} error={errText(editing === "new" ? create.error : update.error)} onSubmit={(d) => {
                const done = () => {
                    setEditing(null);
                    create.reset();
                    update.reset();
                    toast(editing === "new" ? `Client ${d.name} created` : "Saved");
                };
                if (editing === "new")
                    create.mutate(d, { onSuccess: done });
                else
                    update.mutate({ id: editing.id, patch: { name: d.name, notes: d.notes, accountIds: d.accountIds } }, { onSuccess: done });
            }}/>) : null}
      </Modal>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => (o ? undefined : setRemoving(null))} title={`Delete ${removing?.name ?? ""}?`} description={removing?.userCount ? `Remove or move its ${removing.userCount} user(s) first.` : "Its accounts go back to the agency (with their signal history, targets and plans). The workspace's dashboards and settings stay on disk under data/workspaces/."} confirmLabel="Delete client" danger onConfirm={() => removing &&
            void remove
                .mutateAsync(removing.id)
                .then(() => toast(`${removing.name} deleted`))
                .catch((e: unknown) => toast(errText(e) ?? "Failed", { tone: "crit" }))}/>
    </div>);
}
