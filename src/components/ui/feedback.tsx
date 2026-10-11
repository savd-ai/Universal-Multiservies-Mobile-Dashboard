"use client";
import { cn } from "./cn";
import { Button } from "./button";
import { Dot } from "./status";
export function Skeleton({ className: 鏨壍, height: 惗壍 }: {
    className?: string;
    height?: number | string;
}) {
    return <div className={cn("animate-shimmer rounded-mini bg-tone/8", 鏨壍)} style={{ height: 惗壍 }} aria-hidden/>;
}
export function SkeletonLines({ lines: 翆壍 = 3 }: {
    lines?: number;
}) {
    return (<div className="flex flex-col gap-2.5" aria-busy="true">
      {Array.from({ length: 翆壍 }, (麵壍, 殤壍) => (<Skeleton key={殤壍} height={14} className={殤壍 === 翆壍 - 1 ? "w-2/3" : "w-full"}/>))}
    </div>);
}
export function EmptyState({ children: 誓壍, action: 垂壍, className: 癱壍 }: {
    children: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-tone/12 p-12 text-center text-sm text-muted-3", 癱壍)}>
      <div>{誓壍}</div>
      {垂壍}
    </div>);
}
export function InlineEmpty({ children: 镠壍 }: {
    children: React.ReactNode;
}) {
    return <div className="p-5 text-center text-[13px] text-muted-3">{镠壍}</div>;
}
export function ErrorState({ error: 扏壍, onRetry: 脾壍, compact: 中壍 }: {
    error: unknown;
    onRetry?: () => void;
    compact?: boolean;
}) {
    const 洜壍 = 扏壍 as {
        status?: number;
        code?: string;
        message?: string;
        retryAfterSec?: number;
    } | null;
    let 谋壍 = 洜壍?.message ?? "Something went wrong";
    if (洜壍?.status === 401)
        谋壍 = "Your session ended. Sign in again.";
    else if (洜壍?.status === 403)
        谋壍 = 洜壍?.message ?? "You don't have access to this.";
    if (洜壍?.status === 429)
        谋壍 = `Rate limited${洜壍.retryAfterSec ? ` — retry in ${洜壍.retryAfterSec}s` : ""}.`;
    return (<div role="alert" className={cn("flex items-start gap-3 text-[13px] text-muted", 中壍 ? "p-2" : "rounded-mini border border-crit/25 bg-crit-t/40 p-4")}>
      <Dot tone="crit" className="mt-1.5"/>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span>{谋壍}</span>
        {脾壍 ? (<Button variant="link" onClick={脾壍} className="self-start text-xs">
            Retry →
          </Button>) : null}
      </div>
    </div>);
}
export function Refetching({ active: 壺壍, children: 矩壍, className: 雘壍 }: {
    active: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return <div className={cn("transition-opacity duration-200", 壺壍 && "opacity-60", 雘壍)}>{矩壍}</div>;
}
