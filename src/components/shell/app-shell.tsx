"use client";
import dynamic from "next/dynamic";
import { Dialog } from "radix-ui";
import { Suspense } from "react";
import { IconButton } from "@/components/ui/button";
import { useUi } from "@/stores/ui";
import { CommandPalette } from "./command-palette";
import { BlankBanner, PageFooter } from "./page-chrome";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
const 駶壍 = dynamic(() => import("@/features/campaigns/campaign-drawer").then((曥壍) => 曥壍.CampaignDrawerHost), { ssr: false });
export function AppShell({ children: 藔壍 }: {
    children: React.ReactNode;
}) {
    useGlobalShortcuts();
    const 勃壍 = useUi((熲壍) => 熲壍.mobileNavOpen);
    const 邡壍 = useUi((嶐壍) => 嶐壍.setMobileNav);
    return (<div className="grid grid-cols-1 min-h-dvh bg-page text-fg sm:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[236px_minmax(0,1fr)]">
      <div className="no-print hidden sm:block lg:hidden">
        <Sidebar rail/>
      </div>
      <div className="no-print hidden lg:block">
        <Sidebar />
      </div>
      <Dialog.Root open={勃壍} onOpenChange={邡壍}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(8,9,10,0.6)] sm:hidden"/>
          <Dialog.Content className="fixed inset-y-0 left-0 z-40 w-[min(280px,85vw)] sm:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Pages</Dialog.Description>
            <Sidebar onNavigate={() => 邡壍(false)}/>
            <Dialog.Close asChild>
              <IconButton label="Close navigation" size="md" className="absolute top-5 right-3">
                ×
              </IconButton>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <main className="flex min-w-0 flex-col bg-glow">
        <TopBar onMenu={() => 邡壍(true)}/>
        <BlankBanner />
        <div className="flex min-w-0 flex-col gap-6 px-4 pt-7 pb-10 sm:px-9">
          <Suspense fallback={null}>{藔壍}</Suspense>
          <PageFooter />
        </div>
      </main>
      <CommandPalette />
      <ShortcutsDialog />
      <Suspense fallback={null}>
        <駶壍 />
      </Suspense>
    </div>);
}
