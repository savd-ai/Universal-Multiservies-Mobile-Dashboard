"use client";
import { ErrorState } from "@/components/ui/feedback";
export default function AppError({ error, reset }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}) {
    return (<div className="rounded-card border border-line bg-card p-[22px]">
      <ErrorState error={error} onRetry={reset}/>
    </div>);
}
