"use client";

import { AppHeader } from "@/components/app-header";
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
    <SidebarProvider defaultOpen className="min-h-full min-w-0 flex-1">
      <AppSidebar
        role={role}
        appName={appName}
        garageName={garageName}
        userName={userName}
        userEmail={userEmail}
        roleLabel={roleLabel}
      />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AppHeader appName={appName} garageName={garageName} />
        <div className="w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-[34px] lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
