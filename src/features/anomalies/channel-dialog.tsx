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
export function ChannelDialog({ channel: 噊壍, onClose: 甹壍, encryption: 鐨壍 }: ChannelDialogProps) {
    const 愗壍 = !!噊壍;
    const [耆壍, 黵壍] = useState<AlertChannelPlugin>(噊壍?.pluginId ?? "slack");
    const [毤壍, 諓壍] = useState(噊壍?.name ?? PLUGIN_META.slack.label);
    const [埂壍, 皱壍] = useState(愗壍);
    const [閠壍, 抏壍] = useState("");
    const [腾壍, 乭壍] = useState(噊壍?.options.mention ?? "");
    const [浜壍, 豋壍] = useState("");
    const [夺壍, 砩壍] = useState(false);
    const [霘壍, 搇壍] = useState(噊壍?.options.includeLinks ?? true);
    const [苶壍, 俥壍] = useState(噊壍?.enabled ?? true);
    const [滔壍, 跃壍] = useState<{
        message: string;
        secrets?: boolean;
    } | null>(null);
    const 媲壍 = useSaveAlertChannel();
    const 禡壍 = PLUGIN_META[耆壍];
    const 颐壍 = 愗壍 && 耆壍 !== 噊壍.pluginId;
    const 敿壍 = (葮壍: AlertChannelPlugin) => {
        黵壍(葮壍);
        if (!埂壍)
            諓壍(PLUGIN_META[葮壍].label);
        跃壍(null);
    };
    const 兝壍 = () => {
        const 灌壍 = 毤壍.trim();
        const 輻壍 = 閠壍.trim();
        if (!灌壍)
            return 跃壍({ message: "Give the channel a name." });
        if ((!愗壍 || 颐壍) && !輻壍)
            return 跃壍({ message: 颐壍 ? `Changing the type needs the new ${禡壍.label} webhook URL.` : "Paste the webhook URL." });
        if (輻壍 && !/^https?:\/\//i.test(輻壍))
            return 跃壍({ message: "The webhook URL must start with https://" });
        const 尪壍 = { includeLinks: 霘壍, mention: 禡壍.mention ? 腾壍.trim() || undefined : undefined };
        const 笙壍 = (騈壍: AlertChannelView) => {
            toast(愗壍 ? `Saved “${騈壍.name}”` : `Added “${騈壍.name}” — send a test to check it`);
            甹壍();
        };
        const 曷壍 = (藦壍: Error) => 跃壍({ message: 藦壍.message || "Couldn't save the channel", secrets: isSecretsDisabled(藦壍) });
        if (!愗壍) {
            const 動壍: AlertChannelBody = { pluginId: 耆壍, name: 灌壍, enabled: 苶壍, url: 輻壍, options: 尪壍, ...(禡壍.signing && 浜壍 ? { signingSecret: 浜壍 } : {}) };
            媲壍.mutate({ body: 動壍 }, { onSuccess: 笙壍, onError: 曷壍 });
            return;
        }
        const 燄壍: AlertChannelUpdate = {
            name: 灌壍,
            enabled: 苶壍,
            options: { includeLinks: 霘壍, mention: 禡壍.mention ? 腾壍.trim() : "" },
            version: 噊壍.version,
            ...(颐壍 ? { pluginId: 耆壍 } : {}),
            ...(輻壍 ? { url: 輻壍 } : {}),
            ...(禡壍.signing && 夺壍 ? { signingSecret: "" } : 禡壍.signing && 浜壍 ? { signingSecret: 浜壍 } : {}),
        };
        媲壍.mutate({ id: 噊壍.id, body: 燄壍 }, { onSuccess: 笙壍, onError: 曷壍 });
    };
    return (<Modal open onOpenChange={(邳壍) => !邳壍 && 甹壍()} eyebrow={愗壍 ? "Edit channel" : "Add channel"} title={愗壍 ? 噊壍.name : "Where should alerts go?"} description={愗壍 ? `${PLUGIN_META[噊壍.pluginId].label} · the URL stays encrypted and is never shown again.` : "Alerts, resolved notices and the daily digest are posted here. Nothing is sent until a route matches."} width={560} footer={<>
          <Button variant="ghost" onClick={甹壍}>
            Cancel
          </Button>
          <Button variant="accent" onClick={兝壍} loading={媲壍.isPending}>
            {愗壍 ? "Save channel" : "Add channel"}
          </Button>
        </>}>
      <div className="flex flex-col gap-4">
        {!鐨壍 ? (<p className="rounded-mini border border-line bg-fill px-3.5 py-3 text-xs leading-relaxed text-muted">
            Saving webhook URLs from the UI needs <span className="font-mono">APP_ENCRYPTION_KEY</span> in .env (generate one with <span className="font-mono">npm run gen:key</span>). Without it, define the channel in .env instead — it shows up here read-only.
          </p>) : null}

        <div className="flex flex-col gap-2">
          <span className="label-mono">Type</span>
          <Segmented ariaLabel="Channel type" variant="sans" fill value={耆壍} onChange={敿壍} options={ALERT_CHANNEL_PLUGINS.map((嶢壍) => ({ value: 嶢壍, label: 嶢壍 === "teams" ? "Teams" : 嶢壍 === "webhook" ? "Webhook" : PLUGIN_META[嶢壍].label }))}/>
          <p className="text-xs leading-relaxed text-muted-3">{禡壍.help}</p>
        </div>

        <Field label="Name">
          {(粑壍) => (<Input id={粑壍} variant="field" value={毤壍} maxLength={60} onChange={(鮀壍) => {
                諓壍(鮀壍.target.value);
                皱壍(true);
            }}/>)}
        </Field>

        <Field label={耆壍 === "teams" ? "Workflows webhook URL" : "Webhook URL"} hint={愗壍 && 噊壍.url.masked && !颐壍 ? `Leave blank to keep the current URL (${噊壍.url.masked}).` : `Or set ${禡壍.envKey} in .env.`}>
          {(桯壍) => (<Input id={桯壍} variant="field" type="url" value={閠壍} onChange={(蝞壍) => 抏壍(蝞壍.target.value)} placeholder={禡壍.placeholder} autoComplete="off" spellCheck={false} className="font-mono text-xs"/>)}
        </Field>

        {禡壍.mention ? (<Field label="Mention (optional)" hint="@here, @channel or a user / group mention like <@U0123ABCD> — added to alerts, never to tests.">
            {(呍壍) => <Input id={呍壍} variant="field" value={腾壍} maxLength={60} onChange={(猼壍) => 乭壍(猼壍.target.value)} placeholder="@here"/>}
          </Field>) : null}

        {禡壍.signing ? (<div className="flex flex-col gap-2">
            <Field label="Signing secret (optional)" hint={愗壍 && 噊壍.signing ? "A secret is set. Type a new one to replace it." : "Used to sign every request (HMAC-SHA256)."}>
              {(鈫壍) => <Input id={鈫壍} variant="field" type="password" value={浜壍} onChange={(弚壍) => 豋壍(弚壍.target.value)} autoComplete="new-password" disabled={夺壍}/>}
            </Field>
            {愗壍 && 噊壍.signing ? (<label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted">
                <Checkbox checked={夺壍} onChange={砩壍} ariaLabel="Remove the signing secret"/>
                Remove the signing secret
              </label>) : null}
          </div>) : null}

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Switch checked={霘壍} onChange={搇壍} label="Include dashboard links"/>
          <Switch checked={苶壍} onChange={俥壍} label={苶壍 ? "Enabled" : "Disabled"}/>
        </div>

        {滔壍 ? (滔壍.secrets ? (<div role="alert" className="flex flex-col gap-2.5 rounded-mini border border-crit/25 bg-crit-t/40 p-4 text-[13px] text-muted">
              <span className="font-semibold text-fg">Webhook URLs can&apos;t be stored yet</span>
              <span>{SECRETS_HELP}.</span>
              <CodeBlock className="p-3">{`APP_ENCRYPTION_KEY=…   # npm run gen:key\n${禡壍.envKey}=${禡壍.placeholder}`}</CodeBlock>
              <span className="text-xs text-muted-3">{滔壍.message}</span>
            </div>) : (<p role="alert" className="text-[13px] text-crit">
              {滔壍.message}
            </p>)) : null}
      </div>
    </Modal>);
}
