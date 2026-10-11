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
const 枓壍 = (蚂壍: unknown) => (蚂壍 instanceof ApiError ? 蚂壍.message : 蚂壍 ? "Something went wrong" : null);
const 危壍 = (牠壍: string) => 牠壍.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3");
interface Draft {
    name: string;
    notes: string;
    accountIds: string[];
    startFrom: "templates" | "agency";
}
function Cmp4({ initial: 帾壍, directory: 紭壍, clientId: 鰜壍, isNew: 椋壍, pending: 蟺壍, error: 哩壍, onSubmit: 珘壍 }: {
    initial: Draft;
    directory: DirectoryAccount[];
    clientId: string | null;
    isNew: boolean;
    pending: boolean;
    error: string | null;
    onSubmit: (鋇壍: Draft) => void;
}) {
    const [徶壍, 纥壍] = useState(帾壍);
    const 鶔壍 = (檃壍: string) => 纥壍((襲壍) => ({ ...襲壍, accountIds: 襲壍.accountIds.includes(檃壍) ? 襲壍.accountIds.filter((噡壍) => 噡壍 !== 檃壍) : [...襲壍.accountIds, 檃壍] }));
    return (<form className="flex flex-col gap-4" onSubmit={(畐壍) => {
            畐壍.preventDefault();
            珘壍(徶壍);
        }}>
      <Field label="Client name">{(鐿壍) => <Input id={鐿壍} variant="field" value={徶壍.name} onChange={(愮壍) => 纥壍({ ...徶壍, name: 愮壍.target.value })} maxLength={80} required autoFocus/>}</Field>
      <Field label="Google Ads accounts" hint="Accounts reached through the agency's Google Ads credentials. An account belongs to one client at a time.">
        {() => (<div className="flex max-h-64 flex-col overflow-y-auto rounded-mini border border-line p-1.5">
            {紭壍.length === 0 ? <span className="px-2 py-3 text-xs text-muted-3">No accounts available (check the Google Ads connection on Data source).</span> : null}
            {紭壍.map((耝壍) => {
                const 鼌壍 = 耝壍.clientId && 耝壍.clientId !== 鰜壍;
                return (<label key={耝壍.id} className={`flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] ${鼌壍 ? "opacity-50" : "cursor-pointer hover:bg-fill"}`}>
                  <Checkbox checked={徶壍.accountIds.includes(耝壍.id)} onChange={() => (鼌壍 ? undefined : 鶔壍(耝壍.id))} ariaLabel={耝壍.name}/>
                  <span className="min-w-0 flex-1 truncate">{耝壍.name}</span>
                  <span className="font-mono text-micro text-faint">{鼌壍 ? `in ${耝壍.clientName}` : `${危壍(耝壍.id)} · ${耝壍.currency}`}</span>
                </label>);
            })}
          </div>)}
      </Field>
      <Field label="Notes (optional)">{(毻壍) => <Textarea id={毻壍} rows={2} value={徶壍.notes} onChange={(諪壍) => 纥壍({ ...徶壍, notes: 諪壍.target.value })} maxLength={500}/>}</Field>
      {椋壍 ? (<Field label="Start the workspace from" hint={徶壍.startFrom === "agency" ? "Copies the agency workspace's dashboards, saved questions, custom metrics and detection rules." : "The standard dashboard templates and default detection rules."}>
          {() => (<Segmented ariaLabel="Start the workspace from" variant="sans" value={徶壍.startFrom} onChange={(埙壍) => 纥壍({ ...徶壍, startFrom: 埙壍 })} options={[
                    { value: "templates", label: "Default templates" },
                    { value: "agency", label: "Copy of the agency workspace" },
                ]}/>)}
        </Field>) : null}
      {哩壍 ? (<p role="alert" className="m-0 text-[13px] text-crit">
          {哩壍}
        </p>) : null}
      <Button type="submit" variant="accent" loading={蟺壍} className="self-end">
        {椋壍 ? "Create client" : "Save"}
      </Button>
    </form>);
}
export function ClientsAdminScreen() {
    const 盈壍 = useClients();
    const 閷壍 = useCreateClient();
    const 抦壍 = useUpdateClient();
    const 膕壍 = useDeleteClient();
    const [亄壍, 浳壍] = useState<ClientView | "new" | null>(null);
    const [豢壍, 契壍] = useState<ClientView | null>(null);
    const 础壍 = useMemo(() => 盈壍.data?.directory ?? [], [盈壍.data]);
    const 霯壍 = 础壍.filter((搞壍) => !搞壍.clientId);
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<Button variant="brand" onClick={() => 浳壍("new")}>
            New client
          </Button>}/>
      {盈壍.error ? <ErrorState error={盈壍.error} onRetry={() => void 盈壍.refetch()}/> : null}
      {!盈壍.data && !盈壍.error ? <Skeleton height={220}/> : null}
      {盈壍.data ? (<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {盈壍.data.clients.map((茍壍) => (<Card key={茍壍.id} className="flex flex-col gap-3.5">
              <CardHeader title={茍壍.name} sub={`${茍壍.accountIds.length} account${茍壍.accountIds.length === 1 ? "" : "s"} · ${茍壍.userCount} user${茍壍.userCount === 1 ? "" : "s"}`} action={<span className="flex items-center gap-1.5">
                    <Button variant="ghost" size="xs" onClick={() => 浳壍(茍壍)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="xs" onClick={() => 契壍(茍壍)}>
                      Delete
                    </Button>
                  </span>}/>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {茍壍.accounts.map((俼壍) => (<li key={俼壍.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate">{俼壍.name}</span>
                    <span className="font-mono text-micro text-faint">
                      {危壍(俼壍.id)} · {俼壍.currency}
                    </span>
                  </li>))}
                {茍壍.missingAccountIds.map((滫壍) => (<li key={滫壍} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-mono text-muted-3">{危壍(滫壍)}</span>
                    <Pill tone="warn">Not reachable</Pill>
                  </li>))}
                {!茍壍.accountIds.length ? <li className="text-xs text-muted-3">No accounts yet — its users will see nothing until you assign one.</li> : null}
              </ul>
              {茍壍.notes ? <p className="m-0 text-xs text-muted-3">{茍壍.notes}</p> : null}
            </Card>))}
          <Card className="flex flex-col gap-3">
            <CardHeader title="Not assigned to a client" sub={`${霯壍.length} account${霯壍.length === 1 ? "" : "s"} · only agency roles see these`}/>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {霯壍.map((跚壍) => (<li key={跚壍.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate">{跚壍.name}</span>
                  <span className="font-mono text-micro text-faint">
                    {危壍(跚壍.id)} · {跚壍.currency}
                  </span>
                </li>))}
              {!霯壍.length ? <li className="text-xs text-muted-3">Every reachable account belongs to a client.</li> : null}
            </ul>
          </Card>
        </div>) : null}

      <Modal open={亄壍 !== null} onOpenChange={(嫉壍) => (嫉壍 ? undefined : 浳壍(null))} eyebrow={亄壍 === "new" ? "New client" : "Edit client"} title={亄壍 === "new" ? "Add a client" : (亄壍?.name ?? "")} width={560}>
        {亄壍 !== null ? (<Cmp4 key={亄壍 === "new" ? "new" : 亄壍.id} isNew={亄壍 === "new"} clientId={亄壍 === "new" ? null : 亄壍.id} directory={础壍} initial={亄壍 === "new" ? { name: "", notes: "", accountIds: [], startFrom: "templates" } : { name: 亄壍.name, notes: 亄壍.notes, accountIds: 亄壍.accountIds, startFrom: "templates" }} pending={閷壍.isPending || 抦壍.isPending} error={枓壍(亄壍 === "new" ? 閷壍.error : 抦壍.error)} onSubmit={(禸壍) => {
                const 颧壍 = () => {
                    浳壍(null);
                    閷壍.reset();
                    抦壍.reset();
                    toast(亄壍 === "new" ? `Client ${禸壍.name} created` : "Saved");
                };
                if (亄壍 === "new")
                    閷壍.mutate(禸壍, { onSuccess: 颧壍 });
                else
                    抦壍.mutate({ id: 亄壍.id, patch: { name: 禸壍.name, notes: 禸壍.notes, accountIds: 禸壍.accountIds } }, { onSuccess: 颧壍 });
            }}/>) : null}
      </Modal>
      <ConfirmDialog open={!!豢壍} onOpenChange={(斖壍) => (斖壍 ? undefined : 契壍(null))} title={`Delete ${豢壍?.name ?? ""}?`} description={豢壍?.userCount ? `Remove or move its ${豢壍.userCount} user(s) first.` : "Its accounts go back to the agency (with their signal history, targets and plans). The workspace's dashboards and settings stay on disk under data/workspaces/."} confirmLabel="Delete client" danger onConfirm={() => 豢壍 &&
            void 膕壍
                .mutateAsync(豢壍.id)
                .then(() => toast(`${豢壍.name} deleted`))
                .catch((蒅壍: unknown) => toast(枓壍(蒅壍) ?? "Failed", { tone: "crit" }))}/>
    </div>);
}
