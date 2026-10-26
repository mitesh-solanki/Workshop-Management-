"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { AppLogoMark } from "@/components/brand/app-logo";
import {
  navGroupsForRole,
  type AppRole,
} from "@/components/shared/nav-items";
import { SidebarUserCard } from "@/components/shared/sidebar-user-card";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  role: AppRole;
  appName: string;
  garageName: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
};

export function AppSidebar({
  role,
  appName,
  garageName,
  userName,
  userEmail,
  roleLabel,
}: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const groups = navGroupsForRole(role);
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  // Close the mobile sheet after navigation (and on first mount).
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div
          className={cn(
            "flex h-14 items-center gap-3 px-2",
            collapsed && "justify-center px-0",
            isMobile && "pr-1",
          )}
        >
          <AppLogoMark size="lg" className="shrink-0" />
          {!collapsed ? (
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="font-brand truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {appName}
              </p>
              <p className="truncate text-caption text-sidebar-muted">
                {garageName}
              </p>
            </div>
          ) : null}
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("closeMenu")}
              className="ml-auto shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setOpenMobile(false)}
            >
              <X className="size-5" aria-hidden />
            </Button>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label={t("label")}>
          {groups.map(({ group, items }) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{t(`groups.${group}`)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map(({ href, key, icon: Icon }) => {
                    const active =
                      pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          size="lg"
                          className={cn(
                            "min-h-11 rounded-lg group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg",
                            active &&
                            "data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:hover:bg-blue-700 data-[active=true]:hover:text-white",
                          )}
                        >
                          <Link
                            href={href}
                            title={t(key)}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <Icon aria-hidden />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {t(key)}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarUserCard
          name={userName}
          email={userEmail}
          roleLabel={roleLabel}
          collapsed={collapsed}
        />
      </SidebarFooter>

      {!isMobile ? <SidebarRail /> : null}
    </Sidebar>
  );
}
