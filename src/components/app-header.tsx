"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, ChevronRight, Search } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { NavKey } from "@/components/shared/nav-items";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TITLE_BY_PREFIX: { prefix: string; key: NavKey }[] = [
  { prefix: "/dashboard", key: "dashboard" },
  { prefix: "/customers", key: "customers" },
  { prefix: "/orders", key: "orders" },
  { prefix: "/team", key: "team" },
  { prefix: "/settings", key: "settings" },
];

type AppHeaderProps = {
  appName: string;
  garageName: string;
};

export function AppHeader({ appName, garageName }: AppHeaderProps) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const { isMobile, openMobile } = useSidebar();

  const match = TITLE_BY_PREFIX.find(
    (item) =>
      pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  const pageTitle = match ? tNav(match.key) : appName;
  const isHome = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const triggerLabel = isMobile
    ? openMobile
      ? tNav("closeMenu")
      : tNav("openMenu")
    : tNav("toggleSidebar");

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/80">
      <div className="flex h-16 w-full items-center gap-2 px-4 sm:px-6 lg:px-[34px]">
        <SidebarTrigger
          aria-label={triggerLabel}
          className="-ml-3 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-section-title text-slate-900">
            {pageTitle}
          </p>
          <nav
            aria-label={tShell("breadcrumb")}
            className="flex min-w-0 items-center gap-1 text-caption text-slate-500"
          >
            <Link
              href="/dashboard"
              className="truncate hover:text-slate-800 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {garageName}
            </Link>
            {!isHome && match ? (
              <>
                <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
                <span className="truncate text-slate-600" aria-current="page">
                  {pageTitle}
                </span>
              </>
            ) : null}
          </nav>
        </div>

        <div className="hidden max-w-sm flex-1 xl:max-w-md md:block">
          <label className="relative block">
            <span className="sr-only">{tShell("searchLabel")}</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              type="search"
              placeholder={tShell("searchPlaceholder")}
              className="h-11 rounded-lg border-slate-200 bg-slate-50 pl-9 pr-16"
              disabled
              aria-disabled
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-slate-200 bg-card px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
              {tShell("searchShortcut")}
            </kbd>
          </label>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSwitcher />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled
                  aria-label={tShell("notifications")}
                  className="text-slate-500"
                >
                  <Bell className="size-5" aria-hidden />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tShell("notificationsSoon")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
