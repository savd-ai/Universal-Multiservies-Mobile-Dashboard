"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Tooltip } from "radix-ui";
import { useState } from "react";
import { Toaster } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
export function Providers({ children: 鬀壍 }: {
    children: React.ReactNode;
}) {
    const [柯壍] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60000,
                gcTime: 10 * 60000,
                refetchOnWindowFocus: false,
                retry: (蛞壍, 反壍) => {
                    if (反壍 instanceof ApiError && 反壍.status > 0 && 反壍.status < 500)
                        return false;
                    return 蛞壍 < 2;
                },
            },
        },
    }));
    return (<QueryClientProvider client={柯壍}>
      <NuqsAdapter>
        <Tooltip.Provider delayDuration={250}>
          {鬀壍}
          <Toaster />
        </Tooltip.Provider>
      </NuqsAdapter>
    </QueryClientProvider>);
}
