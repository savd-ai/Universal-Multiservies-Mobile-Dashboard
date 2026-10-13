"use client";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Segmented } from "@/components/ui/controls";
import { ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { useDemo } from "@/lib/api/demo";
import { DemoDashboard } from "./demo-dashboard";
export function DemoScreen() {
    const [account, setAccount] = useState<string | null>(null);
    const demo = useDemo(account);
    const accounts = demo.data?.accounts ?? [];
    return (<div className="flex flex-col gap-6">
      <PageHeader />
      {accounts.length > 1 ? (<Segmented ariaLabel="Demo account" variant="sans" className="self-start" options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={demo.data?.dataset.account.id ?? accounts[0]!.id} onChange={setAccount}/>) : null}
      {demo.error && !demo.data ? (<ErrorState error={demo.error} onRetry={() => void demo.refetch()}/>) : !demo.data ? (<Card>
          <SkeletonLines lines={6}/>
        </Card>) : (<DemoDashboard data={demo.data.dataset}/>)}
    </div>);
}
