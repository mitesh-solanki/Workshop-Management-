"use client";

import { AppHeader } from "@/components/app-header";
import { PageChromeProvider } from "@/components/page-chrome";
import { AppSidebar } from "@/components/shared/app-sidebar";
import type { AppRole } from "@/components/shared/nav-items";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type AppShellProps = {
  role: AppRole;
  appName: string;
  garageName: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  children: React.ReactNode;
};

export function AppShell({
  role,
  appName,
  garageName,
  userName,
  userEmail,
  roleLabel,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider
      defaultOpen
      className="flex h-svh max-h-svh min-h-0 w-full min-w-0 flex-1 overflow-hidden"
    >
      <AppSidebar
        role={role}
        appName={appName}
        garageName={garageName}
        userName={userName}
        userEmail={userEmail}
        roleLabel={roleLabel}
      />
      <SidebarInset className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PageChromeProvider>
          <AppHeader appName={appName} garageName={garageName} />
          {/* Only this pane scrolls — header stays put; section navs sticky inside. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* Outer min-h-full fills the pane; padding is inner so loaders do not overflow. */}
            <div className="flex min-h-full w-full flex-col">
              <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-[34px] lg:py-8">
                {children}
              </div>
            </div>
          </div>
        </PageChromeProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
