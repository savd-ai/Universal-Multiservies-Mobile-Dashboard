"use client";
import { Dialog, DropdownMenu, Popover as RPopover, Tooltip as RTooltip } from "radix-ui";
import { cn } from "./cn";
import { Button, IconButton } from "./button";
interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    width?: number;
    className?: string;
}
export function Modal({ open, onOpenChange, eyebrow, title, description, children, footer, width = 440, className }: ModalProps) {
    return (<Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(8,9,10,0.7)] animate-fade-up-fast"/>
        <Dialog.Content className={cn("fixed top-1/2 left-1/2 z-50 flex max-h-[88dvh] -translate-x-1/2 -translate-y-1/2 flex-col gap-[18px] overflow-y-auto rounded-card border border-tone/12 bg-surface p-5 text-fg shadow-modal outline-none sm:p-7", className)} style={{ width: `min(${width}px, 92vw)` }}>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {eyebrow ? <span className="font-mono text-meta tracking-eyebrow text-accent uppercase">{eyebrow}</span> : null}
              <Dialog.Title className="m-0 font-display text-2xl font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="m-0 text-[13px] leading-relaxed text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" size="md">
                ×
              </IconButton>
            </Dialog.Close>
          </div>
          {children}
          {footer ? <div className="flex flex-wrap justify-end gap-2.5">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>);
}
interface DrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    children?: React.ReactNode;
    width?: number;
    modal?: boolean;
}
export function Drawer({ open, onOpenChange, eyebrow, title, children, width = 460, modal = true }: DrawerProps) {
    return (<Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal ? <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(8,9,10,0.6)]"/> : null}
        <Dialog.Content onInteractOutside={modal ? undefined : (e) => e.preventDefault()} className="fixed top-0 right-0 bottom-0 z-40 flex flex-col gap-[22px] overflow-y-auto border-l border-line bg-page p-5 text-fg shadow-drawer outline-none animate-fade-up-fast sm:p-7" style={{ width: `min(${width}px, 100vw)` }}>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {eyebrow ? <span className="font-mono text-meta tracking-meta text-accent uppercase">{eyebrow}</span> : null}
              <Dialog.Title className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.02em]">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Details"}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" size="md">
                ×
              </IconButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>);
}
interface ConfirmProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
}
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", danger, onConfirm }: ConfirmProps) {
    return (<Modal open={open} onOpenChange={onOpenChange} title={title} description={description} footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "accent"} onClick={() => {
                onConfirm();
                onOpenChange(false);
            }}>
            {confirmLabel}
          </Button>
        </>}/>);
}
export function Popover({ trigger, children, align = "end", className, open, onOpenChange }: {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: "start" | "center" | "end";
    className?: string;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
}) {
    return (<RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content align={align} sideOffset={8} collisionPadding={8} className={cn("z-50 rounded-mini border border-tone/12 bg-surface p-1.5 text-fg shadow-pop outline-none animate-fade-up-fast", className)}>
          {children}
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
export function Menu({ trigger, items, align = "end" }: {
    trigger: React.ReactNode;
    items: MenuItem[];
    align?: "start" | "end";
}) {
    return (<DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} collisionPadding={8} className="z-50 min-w-[200px] rounded-mini border border-tone/12 bg-surface p-1.5 text-fg shadow-pop outline-none animate-fade-up-fast">
          {items.map((it, i) => (<div key={i}>
              {it.separatorBefore ? <DropdownMenu.Separator className="my-1 h-px bg-line"/> : null}
              <DropdownMenu.Item disabled={it.disabled} onSelect={it.onSelect} className={cn("flex cursor-pointer items-center justify-between gap-4 rounded-[8px] px-2.5 py-2 text-[13px] outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-fill", it.danger && "text-crit")}>
                <span>{it.label}</span>
                {it.hint ? <span className="font-mono text-micro text-faint">{it.hint}</span> : null}
              </DropdownMenu.Item>
            </div>))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>);
}
export function Tooltip({ content, children, side = "top" }: {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
}) {
    if (!content)
        return <>{children}</>;
    return (<RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} collisionPadding={8} className="z-[60] max-w-[min(280px,calc(100vw-16px))] rounded-[8px] border border-tone/12 bg-surface px-2.5 py-1.5 text-xs leading-snug text-fg shadow-pop">
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>);
}
