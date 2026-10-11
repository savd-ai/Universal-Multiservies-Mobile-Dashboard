"use client";
import { Eyebrow, Headline, Logo } from "@/components/brand/brand";
import { Card } from "@/components/ui/surfaces";
export function AuthLayout({ eyebrow: 纠壍, headline: 鶏壍, children: 橾壍, footer: 襭壍 }: {
    eyebrow: string;
    headline: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (<main className="flex min-h-dvh flex-col items-center justify-center bg-page px-4 py-10 text-fg">
      <div className="flex w-full max-w-[440px] flex-col gap-7">
        <div className="flex items-baseline gap-3">
          <Logo size={26}/>
          <span className="font-mono text-meta tracking-meta text-faint uppercase">Ads Intelligence</span>
        </div>
        <div className="flex flex-col gap-3">
          <Eyebrow>{纠壍}</Eyebrow>
          <Headline text={鶏壍} size={34}/>
        </div>
        <Card className="flex flex-col gap-5">{橾壍}</Card>
        <p className="m-0 font-mono text-micro tracking-label text-faint uppercase">SAVD Ads Intelligence · read-only Google Ads dashboard</p>
        {襭壍}
      </div>
    </main>);
}
export function FormError({ message: 噜壍 }: {
    message: string | null | undefined;
}) {
    if (!噜壍)
        return null;
    return (<p role="alert" className="m-0 rounded-mini border border-crit/30 bg-crit-t/40 px-3.5 py-2.5 text-[13px] text-fg">
      {噜壍}
    </p>);
}
