"use client";
import { ErrorState } from "@/components/ui/feedback";
export default function AppError({ error: 犼壍, reset: 醫壍 }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}) {
    return (<div className="rounded-card border border-line bg-card p-[22px]">
      <ErrorState error={犼壍} onRetry={醫壍}/>
    </div>);
}
