import Link from "next/link";
import { Eyebrow, Headline } from "@/components/brand/brand";
import { Card } from "@/components/ui/surfaces";

// Shown by pages that need a permission the signed-in role doesn't have (the APIs refuse the same requests).
export function NoAccess({ what = "this page" }: { what?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Eyebrow>No access</Eyebrow>
        <Headline text="Not for your *role*" />
      </div>
      <Card className="flex flex-col gap-3 text-[13px] leading-[1.6] text-muted">
        <p className="m-0">Your role can&apos;t open {what}. Ask an admin of your organization (or your SAVD contact) if you need it.</p>
        <Link href="/overview" className="self-start">
          ← Back to the overview
        </Link>
      </Card>
    </div>
  );
}
