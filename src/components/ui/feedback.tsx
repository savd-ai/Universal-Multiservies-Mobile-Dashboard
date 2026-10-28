"use client";
import { cn } from "./cn";
import { Button } from "./button";
import { Dot } from "./status";
export function Skeleton({ className, height }: {
    className?: string;
    height?: number | string;
}) {
    return <div className={cn("animate-shimmer rounded-mini bg-tone/8", className)} style={{ height }} aria-hidden/>;
}
export function SkeletonLines({ lines = 3 }: {
    lines?: number;
}) {
    return (<div className="flex flex-col gap-2.5" aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (<Skeleton key={i} height={14} className={i === lines - 1 ? "w-2/3" : "w-full"}/>))}
    </div>);
}
export function EmptyState({ children, action, className }: {
    children: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-tone/12 p-12 text-center text-sm text-muted-3", className)}>
      <div>{children}</div>
      {action}
    </div>);
}
export function InlineEmpty({ children }: {
    children: React.ReactNode;
}) {
    return <div className="p-5 text-center text-[13px] text-muted-3">{children}</div>;
}
export function ErrorState({ error, onRetry, compact }: {
    error: unknown;
    onRetry?: () => void;
    compact?: boolean;
}) {
    const e = error as {
        status?: number;
        code?: string;
        message?: string;
        retryAfterSec?: number;
    } | null;
    let message = e?.message ?? "Something went wrong";
    if (e?.status === 401)
        message = "Your session ended. Sign in again.";
    else if (e?.status === 403)
        message = e?.message ?? "You don't have access to this.";
    if (e?.status === 429)
        message = `Rate limited${e.retryAfterSec ? ` — retry in ${e.retryAfterSec}s` : ""}.`;
    return (<div role="alert" className={cn("flex items-start gap-3 text-[13px] text-muted", compact ? "p-2" : "rounded-mini border border-crit/25 bg-crit-t/40 p-4")}>
      <Dot tone="crit" className="mt-1.5"/>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span>{message}</span>
        {onRetry ? (<Button variant="link" onClick={onRetry} className="self-start text-xs">
            Retry →
          </Button>) : null}
      </div>
    </div>);
}
export function Refetching({ active, children, className }: {
    active: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return <div className={cn("transition-opacity duration-200", active && "opacity-60", className)}>{children}</div>;
}
