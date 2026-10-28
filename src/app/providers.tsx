"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Tooltip } from "radix-ui";
import { useState } from "react";
import { Toaster } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
export function Providers({ children }: {
    children: React.ReactNode;
}) {
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60000,
                gcTime: 10 * 60000,
                refetchOnWindowFocus: false,
                retry: (count, err) => {
                    if (err instanceof ApiError && err.status > 0 && err.status < 500)
                        return false;
                    return count < 2;
                },
            },
        },
    }));
    return (<QueryClientProvider client={client}>
      <NuqsAdapter>
        <Tooltip.Provider delayDuration={250}>
          {children}
          <Toaster />
        </Tooltip.Provider>
      </NuqsAdapter>
    </QueryClientProvider>);
}
