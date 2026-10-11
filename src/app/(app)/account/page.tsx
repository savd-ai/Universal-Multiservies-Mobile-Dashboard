import { Suspense } from "react";
import { AccountScreen } from "@/features/account/account-screen";
export default function Page() {
    return (<Suspense fallback={null}>
      <AccountScreen />
    </Suspense>);
}
