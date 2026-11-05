"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronDown, List, Plus, X } from "lucide-react";
import { AppLogoMark } from "@/components/brand/app-logo";
import {
  isCounterSalesPath,
  isInventoryPartsPath,
  navGroupsForRole,
  type AppRole,
  type NavFlyoutItem,
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

type FlyoutPos = { top: number; left: number };

const FLYOUT_MENU_WIDTH = 216;
const FLYOUT_GAP = 8;
const FLYOUT_ITEM_HEIGHT = 40;
const FLYOUT_HEADER_HEIGHT = 28;
const FLYOUT_PAD_Y = 16;

function estimateFlyoutHeight(itemCount: number): number {
  return FLYOUT_HEADER_HEIGHT + FLYOUT_PAD_Y + itemCount * FLYOUT_ITEM_HEIGHT;
}

/** Prefer align-top with trigger; flip upward when the menu would clip the viewport. */
function computeFlyoutPos(
  triggerRect: DOMRect,
  menuHeight: number,
): FlyoutPos {
  const maxLeft = window.innerWidth - FLYOUT_MENU_WIDTH - FLYOUT_GAP;
  const left = Math.min(triggerRect.right + FLYOUT_GAP, maxLeft);
  const viewportBottom = window.innerHeight - FLYOUT_GAP;
  const spaceBelow = viewportBottom - triggerRect.top;
  const spaceAbove = triggerRect.bottom - FLYOUT_GAP;

  let top = triggerRect.top;
  if (menuHeight > spaceBelow) {
    if (menuHeight <= spaceAbove) {
      top = triggerRect.bottom - menuHeight;
    } else {
      top = Math.max(FLYOUT_GAP, viewportBottom - menuHeight);
    }
  }

  const maxTop = Math.max(FLYOUT_GAP, viewportBottom - menuHeight);
  top = Math.min(Math.max(FLYOUT_GAP, top), maxTop);
  return { top, left };
}

function childIsActive(pathname: string, href: string, key: string): boolean {
  if (key === "counterSales") return isCounterSalesPath(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function parentIsActive(pathname: string, item: NavItem): boolean {
  if (item.key === "inventory") {
    return isInventoryPartsPath(pathname) || isCounterSalesPath(pathname);
  }
  if (item.children?.length) {
    // Parent route itself (e.g. /payroll) must count as active, not only children.
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return true;
    }
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

function isFlyoutActive(pathname: string, href: string): boolean {
  if (href.includes("?")) return false;
  if (href.endsWith("/new")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavFlyoutHost({
  item,
  pathname,
  flyoutsEnabled,
  onNavigate,
  children,
}: {
  item: NavItem;
  pathname: string;
  flyoutsEnabled: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("nav");
  const flyoutItems = item.flyout ?? [];
  const hasFlyout = flyoutItems.length > 0 && flyoutsEnabled;
  const itemRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<FlyoutPos>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeFlyout = useCallback(() => {
    clearCloseTimer();
    setFlyoutOpen(false);
  }, [clearCloseTimer]);

  const placeFlyout = useCallback(() => {
    if (!itemRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const measured = menuRef.current?.offsetHeight;
    const height =
      measured && measured > 0
        ? measured
        : estimateFlyoutHeight(flyoutItems.length);
    setPos(computeFlyoutPos(rect, height));
  }, [flyoutItems.length]);

  const openFlyout = useCallback(() => {
    if (!hasFlyout || !itemRef.current) return;
    clearCloseTimer();
    placeFlyout();
    setFlyoutOpen(true);
  }, [clearCloseTimer, hasFlyout, placeFlyout]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 120);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (!flyoutsEnabled) closeFlyout();
  }, [flyoutsEnabled, closeFlyout]);

  useEffect(() => {
    function onHide() {
      closeFlyout();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") closeFlyout();
    }
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [closeFlyout]);

  useEffect(() => {
    closeFlyout();
  }, [pathname, closeFlyout]);

  useLayoutEffect(() => {
    if (!flyoutOpen) return;
    placeFlyout();
  }, [flyoutOpen, placeFlyout]);

  useEffect(() => {
    if (!flyoutOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeFlyout();
    }

    window.addEventListener("scroll", placeFlyout, true);
    window.addEventListener("resize", placeFlyout);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", placeFlyout, true);
      window.removeEventListener("resize", placeFlyout);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [flyoutOpen, closeFlyout, placeFlyout]);

  const flyoutMenu =
    hasFlyout && flyoutOpen && mounted
      ? createPortal(
          <div
            ref={menuRef}
            className="pointer-events-auto fixed z-100 max-h-[calc(100vh-1rem)] min-w-54 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-lg shadow-slate-900/15"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleClose}
          >
            <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-700/80">
              {t(item.key)}
            </p>
            <div className="space-y-0.5 px-1.5">
              {flyoutItems.map((action: NavFlyoutItem) => {
                const actionActive = isFlyoutActive(pathname, action.href);
                const ActionIcon = action.kind === "add" ? Plus : List;
                return (
                  <Link
                    key={`${action.labelKey}-${action.href}`}
                    href={action.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      actionActive
                        ? "bg-blue-50 font-semibold text-blue-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <ActionIcon
                      className={cn(
                        "size-3.5 shrink-0",
                        action.kind === "add"
                          ? "text-blue-600"
                          : "text-slate-400",
                      )}
                      aria-hidden
                    />
                    <span>{t(`flyout.${action.labelKey}`)}</span>
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={hasFlyout ? openFlyout : undefined}
      onMouseLeave={hasFlyout ? scheduleClose : undefined}
    >
      {children}
      {flyoutMenu}
    </div>
  );
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
  const flyoutsEnabled = !isMobile;
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

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
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
                          <SidebarNavFlyoutHost
                            item={item}
                            pathname={pathname}
                            flyoutsEnabled={flyoutsEnabled}
                            onNavigate={closeMobile}
                          >
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
                                title={
                                  collapsed && !item.flyout?.length
                                    ? t(key)
                                    : undefined
                                }
                                onClick={closeMobile}
                              >
                                <Icon aria-hidden />
                                <span className="group-data-[collapsible=icon]:hidden">
                                  {t(key)}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarNavFlyoutHost>
                        </SidebarMenuItem>
                      );
                    }

                    if (collapsed) {
                      return (
                        <SidebarMenuItem key={href}>
                          <SidebarNavFlyoutHost
                            item={item}
                            pathname={pathname}
                            flyoutsEnabled={flyoutsEnabled}
                            onNavigate={closeMobile}
                          >
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
                                title={item.flyout?.length ? undefined : t(key)}
                                onClick={closeMobile}
                              >
                                <Icon aria-hidden />
                                <span className="sr-only">{t(key)}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarNavFlyoutHost>
                        </SidebarMenuItem>
                      );
                    }

                    const parentActive = parentLinkIsActive(pathname, item);

                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarNavFlyoutHost
                          item={item}
                          pathname={pathname}
                          flyoutsEnabled={flyoutsEnabled}
                          onNavigate={closeMobile}
                        >
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
                              className={cn(
                                "flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-medium outline-none",
                                parentActive
                                  ? "text-white"
                                  : "text-sidebar-foreground",
                              )}
                              onClick={(event) => {
                                // Already on this section with submenu open → close it.
                                if (parentActive && menuOpen) {
                                  event.preventDefault();
                                  setOpenMenus((prev) => ({
                                    ...prev,
                                    [key]: false,
                                  }));
                                  return;
                                }
                                setOpenMenus((prev) => ({
                                  ...prev,
                                  [key]: true,
                                }));
                                closeMobile();
                              }}
                            >
                              <Icon className="size-4 shrink-0" aria-hidden />
                              <span className="truncate">{t(key)}</span>
                            </Link>
                            <button
                              type="button"
                              className={cn(
                                "inline-flex min-h-11 min-w-11 flex-1 items-center justify-end px-2 outline-none",
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
                        </SidebarNavFlyoutHost>

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
                                      onClick={closeMobile}
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
          showProfileLink={role === "OWNER" || role === "MANAGER"}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
