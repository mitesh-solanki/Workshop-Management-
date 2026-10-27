"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, X } from "lucide-react";
import { AppLogoMark } from "@/components/brand/app-logo";
import {
  isCounterSalesPath,
  isInventoryPartsPath,
  navGroupsForRole,
  type AppRole,
  type NavItem,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

function childIsActive(pathname: string, href: string, key: string): boolean {
  if (key === "counterSales") return isCounterSalesPath(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function parentIsActive(pathname: string, item: NavItem): boolean {
  if (item.key === "inventory") {
    return isInventoryPartsPath(pathname) || isCounterSalesPath(pathname);
  }
  if (item.children?.length) {
    return item.children.some((child) =>
      childIsActive(pathname, child.href, child.key),
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function parentLinkIsActive(pathname: string, item: NavItem): boolean {
  if (item.key === "inventory") {
    return isInventoryPartsPath(pathname);
  }
  return parentIsActive(pathname, item);
}

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
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [menusPath, setMenusPath] = useState(pathname);
  if (menusPath !== pathname) {
    setMenusPath(pathname);
    setOpenMenus({});
  }

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  function toggleMenu(key: string) {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div
          className={cn(
            "flex h-14 items-center gap-3 px-2",
            collapsed && "justify-center px-0",
            "pr-1 lg:pr-0",
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
              collapsed && "flex-none justify-center",
            )}
            aria-label={appName}
          >
            <AppLogoMark size="lg" className="shrink-0" />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="font-brand truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {appName}
              </p>
              <p className="truncate text-caption text-sidebar-muted">
                {garageName}
              </p>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("closeMenu")}
            className="ml-auto shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            onClick={() => setOpenMobile(false)}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label={t("label")}>
          {groups.map(({ group, items }) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{t(`groups.${group}`)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const { href, key, icon: Icon, children } = item;
                    const active = parentIsActive(pathname, item);
                    const hasChildren = Boolean(children?.length);
                    const menuOpen = hasChildren
                      ? (openMenus[key] ?? active)
                      : false;

                    if (!hasChildren) {
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
                    }

                    if (collapsed) {
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
                              <span className="sr-only">{t(key)}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    const parentActive = parentLinkIsActive(pathname, item);

                    return (
                      <SidebarMenuItem key={href}>
                        <div
                          className={cn(
                            "flex min-h-11 items-stretch overflow-hidden rounded-lg",
                            parentActive
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "hover:bg-sidebar-accent",
                          )}
                        >
                          <Link
                            href={href}
                            title={t(key)}
                            className={cn(
                              "flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-sm font-medium outline-none",
                              parentActive
                                ? "text-white"
                                : "text-sidebar-foreground",
                            )}
                            onClick={() => {
                              setOpenMenus((prev) => ({
                                ...prev,
                                [key]: true,
                              }));
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <Icon className="size-4 shrink-0" aria-hidden />
                            <span className="truncate">{t(key)}</span>
                          </Link>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex size-11 shrink-0 items-center justify-center outline-none",
                              parentActive
                                ? "text-white hover:bg-blue-800/40"
                                : "text-sidebar-foreground hover:bg-sidebar-accent",
                            )}
                            aria-label={t("toggleSubmenu", { label: t(key) })}
                            aria-expanded={menuOpen}
                            onClick={() => toggleMenu(key)}
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform",
                                menuOpen && "rotate-180",
                              )}
                              aria-hidden
                            />
                          </button>
                        </div>

                        {menuOpen ? (
                          <SidebarMenuSub>
                            {children!.map((child) => {
                              const childActive = childIsActive(
                                pathname,
                                child.href,
                                child.key,
                              );
                              return (
                                <SidebarMenuSubItem
                                  key={child.href + child.key}
                                >
                                  <SidebarMenuSubButton
                                    asChild
                                    size="md"
                                    isActive={childActive}
                                    className={cn(
                                      "min-h-10",
                                      childActive &&
                                        "bg-blue-600 text-white hover:bg-blue-700 hover:text-white data-[active=true]:bg-blue-600 data-[active=true]:text-white",
                                    )}
                                  >
                                    <Link
                                      href={child.href}
                                      onClick={() => {
                                        if (isMobile) setOpenMobile(false);
                                      }}
                                    >
                                      <span>{t(child.key)}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        ) : null}
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

      <SidebarRail />
    </Sidebar>
  );
}
