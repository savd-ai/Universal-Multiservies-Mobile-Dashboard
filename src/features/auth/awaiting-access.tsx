"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "./auth-layout";

/** Shown instead of the app to signed-in users who have no client yet (e.g. right after registering). */
export function AwaitingAccess({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout eyebrow="Account created" headline="Almost *there*">
      <p className="m-0 text-[13px] leading-[1.6] text-muted">
        {`Your account${email ? ` (${email})` : ""} is active, but it isn't linked to a client yet, so there is no data to show. `}
        Ask your SAVD contact or your organization&apos;s admin to assign you on the Access page, then check again.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" onClick={() => window.location.reload()}>
          Check again
        </Button>
        <Button
          variant="ghost"
          loading={busy}
          onClick={() => {
            setBusy(true);
            void fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin" })
              .catch(() => undefined)
              .finally(() => window.location.replace("/login"));
          }}
        >
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
