"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented, Switch } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import { CodeBlock } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useSaveAlertChannel } from "@/lib/api/alerts";
import { ALERT_CHANNEL_PLUGINS, type AlertChannelBody, type AlertChannelPlugin, type AlertChannelUpdate, type AlertChannelView } from "@/lib/domain/contracts/alerts";
import { isSecretsDisabled, PLUGIN_META, SECRETS_HELP } from "./helpers/alerts";
interface ChannelDialogProps {
    channel?: AlertChannelView;
    onClose: () => void;
    encryption: boolean;
}
export function ChannelDialog({ channel, onClose, encryption }: ChannelDialogProps) {
    const editing = !!channel;
    const [pluginId, setPluginId] = useState<AlertChannelPlugin>(channel?.pluginId ?? "slack");
    const [name, setName] = useState(channel?.name ?? PLUGIN_META.slack.label);
    const [nameTouched, setNameTouched] = useState(editing);
    const [url, setUrl] = useState("");
    const [mention, setMention] = useState(channel?.options.mention ?? "");
    const [secret, setSecret] = useState("");
    const [clearSecret, setClearSecret] = useState(false);
    const [includeLinks, setIncludeLinks] = useState(channel?.options.includeLinks ?? true);
    const [enabled, setEnabled] = useState(channel?.enabled ?? true);
    const [error, setError] = useState<{
        message: string;
        secrets?: boolean;
    } | null>(null);
    const save = useSaveAlertChannel();
    const meta = PLUGIN_META[pluginId];
    const typeChanged = editing && pluginId !== channel.pluginId;
    const pick = (p: AlertChannelPlugin) => {
        setPluginId(p);
        if (!nameTouched)
            setName(PLUGIN_META[p].label);
        setError(null);
    };
    const submit = () => {
        const n = name.trim();
        const u = url.trim();
        if (!n)
            return setError({ message: "Give the channel a name." });
        if ((!editing || typeChanged) && !u)
            return setError({ message: typeChanged ? `Changing the type needs the new ${meta.label} webhook URL.` : "Paste the webhook URL." });
        if (u && !/^https?:\/\//i.test(u))
            return setError({ message: "The webhook URL must start with https://" });
        const options = { includeLinks, mention: meta.mention ? mention.trim() || undefined : undefined };
        const onSuccess = (ch: AlertChannelView) => {
            toast(editing ? `Saved “${ch.name}”` : `Added “${ch.name}” — send a test to check it`);
            onClose();
        };
        const onError = (e: Error) => setError({ message: e.message || "Couldn't save the channel", secrets: isSecretsDisabled(e) });
        if (!editing) {
            const body2: AlertChannelBody = { pluginId, name: n, enabled, url: u, options, ...(meta.signing && secret ? { signingSecret: secret } : {}) };
            save.mutate({ body: body2 }, { onSuccess, onError });
            return;
        }
        const body: AlertChannelUpdate = {
            name: n,
            enabled,
            options: { includeLinks, mention: meta.mention ? mention.trim() : "" },
            version: channel.version,
            ...(typeChanged ? { pluginId } : {}),
            ...(u ? { url: u } : {}),
            ...(meta.signing && clearSecret ? { signingSecret: "" } : meta.signing && secret ? { signingSecret: secret } : {}),
        };
        save.mutate({ id: channel.id, body }, { onSuccess, onError });
    };
    return (<Modal open onOpenChange={(o) => !o && onClose()} eyebrow={editing ? "Edit channel" : "Add channel"} title={editing ? channel.name : "Where should alerts go?"} description={editing ? `${PLUGIN_META[channel.pluginId].label} · the URL stays encrypted and is never shown again.` : "Alerts, resolved notices and the daily digest are posted here. Nothing is sent until a route matches."} width={560} footer={<>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={save.isPending}>
            {editing ? "Save channel" : "Add channel"}
          </Button>
        </>}>
      <div className="flex flex-col gap-4">
        {!encryption ? (<p className="rounded-mini border border-line bg-fill px-3.5 py-3 text-xs leading-relaxed text-muted">
            Saving webhook URLs from the UI needs <span className="font-mono">APP_ENCRYPTION_KEY</span> in .env (generate one with <span className="font-mono">npm run gen:key</span>). Without it, define the channel in .env instead — it shows up here read-only.
          </p>) : null}

        <div className="flex flex-col gap-2">
          <span className="label-mono">Type</span>
          <Segmented ariaLabel="Channel type" variant="sans" fill value={pluginId} onChange={pick} options={ALERT_CHANNEL_PLUGINS.map((p) => ({ value: p, label: p === "teams" ? "Teams" : p === "webhook" ? "Webhook" : PLUGIN_META[p].label }))}/>
          <p className="text-xs leading-relaxed text-muted-3">{meta.help}</p>
        </div>

        <Field label="Name">
          {(id) => (<Input id={id} variant="field" value={name} maxLength={60} onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
            }}/>)}
        </Field>

        <Field label={pluginId === "teams" ? "Workflows webhook URL" : "Webhook URL"} hint={editing && channel.url.masked && !typeChanged ? `Leave blank to keep the current URL (${channel.url.masked}).` : `Or set ${meta.envKey} in .env.`}>
          {(id) => (<Input id={id} variant="field" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={meta.placeholder} autoComplete="off" spellCheck={false} className="font-mono text-xs"/>)}
        </Field>

        {meta.mention ? (<Field label="Mention (optional)" hint="@here, @channel or a user / group mention like <@U0123ABCD> — added to alerts, never to tests.">
            {(id) => <Input id={id} variant="field" value={mention} maxLength={60} onChange={(e) => setMention(e.target.value)} placeholder="@here"/>}
          </Field>) : null}

        {meta.signing ? (<div className="flex flex-col gap-2">
            <Field label="Signing secret (optional)" hint={editing && channel.signing ? "A secret is set. Type a new one to replace it." : "Used to sign every request (HMAC-SHA256)."}>
              {(id) => <Input id={id} variant="field" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" disabled={clearSecret}/>}
            </Field>
            {editing && channel.signing ? (<label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted">
                <Checkbox checked={clearSecret} onChange={setClearSecret} ariaLabel="Remove the signing secret"/>
                Remove the signing secret
              </label>) : null}
          </div>) : null}

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Switch checked={includeLinks} onChange={setIncludeLinks} label="Include dashboard links"/>
          <Switch checked={enabled} onChange={setEnabled} label={enabled ? "Enabled" : "Disabled"}/>
        </div>

        {error ? (error.secrets ? (<div role="alert" className="flex flex-col gap-2.5 rounded-mini border border-crit/25 bg-crit-t/40 p-4 text-[13px] text-muted">
              <span className="font-semibold text-fg">Webhook URLs can&apos;t be stored yet</span>
              <span>{SECRETS_HELP}.</span>
              <CodeBlock className="p-3">{`APP_ENCRYPTION_KEY=…   # npm run gen:key\n${meta.envKey}=${meta.placeholder}`}</CodeBlock>
              <span className="text-xs text-muted-3">{error.message}</span>
            </div>) : (<p role="alert" className="text-[13px] text-crit">
              {error.message}
            </p>)) : null}
      </div>
    </Modal>);
}
