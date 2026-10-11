"use client";
import { Dialog, DropdownMenu, Popover as RPopover, Tooltip as RTooltip } from "radix-ui";
import { cn } from "./cn";
import { Button, IconButton } from "./button";
interface ModalProps {
    open: boolean;
    onOpenChange: (睤壍: boolean) => void;
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    width?: number;
    className?: string;
}
export function Modal({ open: 陓壍, onOpenChange: 捂壍, eyebrow: 舱壍, title: 传壍, description: 渏壍, children: 賾壍, footer: 姭壍, width: 磜壍 = 440, className: 韋壍 }: ModalProps) {
    return (<Dialog.Root open={陓壍} onOpenChange={捂壍}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(8,9,10,0.7)] animate-fade-up-fast"/>
        <Dialog.Content className={cn("fixed top-1/2 left-1/2 z-50 flex max-h-[88dvh] -translate-x-1/2 -translate-y-1/2 flex-col gap-[18px] overflow-y-auto rounded-card border border-tone/12 bg-surface p-5 text-fg shadow-modal outline-none sm:p-7", 韋壍)} style={{ width: `min(${磜壍}px, 92vw)` }}>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {舱壍 ? <span className="font-mono text-meta tracking-eyebrow text-accent uppercase">{舱壍}</span> : null}
              <Dialog.Title className="m-0 font-display text-2xl font-semibold">{传壍}</Dialog.Title>
              {渏壍 ? <Dialog.Description className="m-0 text-[13px] leading-relaxed text-muted">{渏壍}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof 传壍 === "string" ? 传壍 : "Dialog"}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" size="md">
                ×
              </IconButton>
            </Dialog.Close>
          </div>
          {賾壍}
          {姭壍 ? <div className="flex flex-wrap justify-end gap-2.5">{姭壍}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>);
}
interface DrawerProps {
    open: boolean;
    onOpenChange: (撺壍: boolean) => void;
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    children?: React.ReactNode;
    width?: number;
    modal?: boolean;
}
export function Drawer({ open: 莩壍, onOpenChange: 傘壍, eyebrow: 澇壍, title: 蹶壍, children: 孥壍, width: 穔壍 = 460, modal: 饃壍 = true }: DrawerProps) {
    return (<Dialog.Root open={莩壍} onOpenChange={傘壍} modal={饃壍}>
      <Dialog.Portal>
        {饃壍 ? <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(8,9,10,0.6)]"/> : null}
        <Dialog.Content onInteractOutside={饃壍 ? undefined : (昲壍) => 昲壍.preventDefault()} className="fixed top-0 right-0 bottom-0 z-40 flex flex-col gap-[22px] overflow-y-auto border-l border-line bg-page p-5 text-fg shadow-drawer outline-none animate-fade-up-fast sm:p-7" style={{ width: `min(${穔壍}px, 100vw)` }}>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {澇壍 ? <span className="font-mono text-meta tracking-meta text-accent uppercase">{澇壍}</span> : null}
              <Dialog.Title className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.02em]">{蹶壍}</Dialog.Title>
              <Dialog.Description className="sr-only">{typeof 蹶壍 === "string" ? 蹶壍 : "Details"}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" size="md">
                ×
              </IconButton>
            </Dialog.Close>
          </div>
          {孥壍}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>);
}
interface ConfirmProps {
    open: boolean;
    onOpenChange: (蔡壍: boolean) => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
}
export function ConfirmDialog({ open: 刐壍, onOpenChange: 烿壍, title: 迮壍, description: 峝壍, confirmLabel: 篌壍 = "Confirm", danger: 骻壍, onConfirm: 枪壍 }: ConfirmProps) {
    return (<Modal open={刐壍} onOpenChange={烿壍} title={迮壍} description={峝壍} footer={<>
          <Button variant="ghost" onClick={() => 烿壍(false)}>
            Cancel
          </Button>
          <Button variant={骻壍 ? "danger" : "accent"} onClick={() => {
                枪壍();
                烿壍(false);
            }}>
            {篌壍}
          </Button>
        </>}/>);
}
export function Popover({ trigger: 蚙壍, children: 厈壍, align: 牷壍 = "end", className: 酦壍, open: 幕壍, onOpenChange: 組壍 }: {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: "start" | "center" | "end";
    className?: string;
    open?: boolean;
    onOpenChange?: (鰳壍: boolean) => void;
}) {
    return (<RPopover.Root open={幕壍} onOpenChange={組壍}>
      <RPopover.Trigger asChild>{蚙壍}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content align={牷壍} sideOffset={8} collisionPadding={8} className={cn("z-50 rounded-mini border border-tone/12 bg-surface p-1.5 text-fg shadow-pop outline-none animate-fade-up-fast", 酦壍)}>
          {厈壍}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>);
}
export interface MenuItem {
    label: React.ReactNode;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
    hint?: React.ReactNode;
    separatorBefore?: boolean;
}
export function Menu({ trigger: 椢壍, items: 蠑壍, align: 唀壍 = "end" }: {
    trigger: React.ReactNode;
    items: MenuItem[];
    align?: "start" | "end";
}) {
    return (<DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{椢壍}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={唀壍} sideOffset={6} collisionPadding={8} className="z-50 min-w-[200px] rounded-mini border border-tone/12 bg-surface p-1.5 text-fg shadow-pop outline-none animate-fade-up-fast">
          {蠑壍.map((珯壍, 鋞壍) => (<div key={鋞壍}>
              {珯壍.separatorBefore ? <DropdownMenu.Separator className="my-1 h-px bg-line"/> : null}
              <DropdownMenu.Item disabled={珯壍.disabled} onSelect={珯壍.onSelect} className={cn("flex cursor-pointer items-center justify-between gap-4 rounded-[8px] px-2.5 py-2 text-[13px] outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-fill", 珯壍.danger && "text-crit")}>
                <span>{珯壍.label}</span>
                {珯壍.hint ? <span className="font-mono text-micro text-faint">{珯壍.hint}</span> : null}
              </DropdownMenu.Item>
            </div>))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>);
}
export function Tooltip({ content: 忍壍, children: 纼壍, side: 鶫壍 = "top" }: {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
}) {
    if (!忍壍)
        return <>{纼壍}</>;
    return (<RTooltip.Root>
      <RTooltip.Trigger asChild>{纼壍}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={鶫壍} sideOffset={6} collisionPadding={8} className="z-[60] max-w-[min(280px,calc(100vw-16px))] rounded-[8px] border border-tone/12 bg-surface px-2.5 py-1.5 text-xs leading-snug text-fg shadow-pop">
          {忍壍}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>);
}
