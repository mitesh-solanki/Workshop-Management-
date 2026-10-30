"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, ChevronRight } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { LanguageSwitcher } from "@/components/language-switcher";
import { usePageChrome } from "@/components/page-chrome";
import type { NavKey } from "@/components/shared/nav-items";
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
  { prefix: "/vehicles", key: "vehicles" },
  { prefix: "/inventory/sales", key: "counterSales" },
  { prefix: "/inventory", key: "inventory" },
  { prefix: "/vendors", key: "vendors" },
  { prefix: "/parts-requests", key: "partsRequests" },
  { prefix: "/purchase-orders", key: "purchaseOrders" },
  { prefix: "/vendor-bills", key: "vendorBills" },
  { prefix: "/purchase-returns", key: "purchaseReturns" },
  { prefix: "/invoices", key: "invoices" },
  { prefix: "/orders", key: "orders" },
  { prefix: "/inspections", key: "inspections" },
  { prefix: "/workshop", key: "workshop" },
  { prefix: "/team", key: "team" },
  { prefix: "/settings", key: "settings" },
];

type AppHeaderProps = {
  appName: string;
  garageName: string;
  homeHref?: string;
};

export function AppHeader({
  appName,
  garageName,
  homeHref = "/dashboard",
}: AppHeaderProps) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const { isMobile, openMobile } = useSidebar();
  const chrome = usePageChrome();
  const detailLabel = chrome?.detailLabel ?? null;

  const match = TITLE_BY_PREFIX.find(
    (item) =>
      pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  const sectionTitle = match ? tNav(match.key) : appName;
  const pageTitle = sectionTitle;
  const isHome =
    pathname === homeHref || pathname.startsWith(`${homeHref}/`);
  const sectionHref = match?.prefix ?? homeHref;
  const triggerLabel = isMobile
    ? openMobile
      ? tNav("closeMenu")
      : tNav("openMenu")
    : tNav("toggleSidebar");

  const breadcrumb = (
    <nav
      aria-label={tShell("breadcrumb")}
      className={
        detailLabel
          ? "flex min-w-0 items-center gap-1 text-caption text-slate-500"
          : "flex min-w-0 items-center gap-1 text-caption text-slate-500"
      }
    >
      <Link
        href={homeHref}
        className="truncate hover:text-slate-800 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        {garageName}
      </Link>
      {!isHome && match ? (
        <>
          <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
          {detailLabel ? (
            <>
              <Link
                href={sectionHref}
                className="truncate hover:text-slate-800 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {sectionTitle}
              </Link>
              <ChevronRight
                className="size-3 shrink-0 opacity-60"
                aria-hidden
              />
              <span className="truncate text-slate-600" aria-current="page">
                {detailLabel}
              </span>
            </>
          ) : (
            <span className="truncate text-slate-600" aria-current="page">
              {sectionTitle}
            </span>
          )}
        </>
      ) : null}
    </nav>
  );

  const titleBlock = (
    <div className="min-w-0">
      <p className="truncate text-section-title text-slate-900">{pageTitle}</p>
      {breadcrumb}
    </div>
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-1.5 ml-auto">
      <LanguageSwitcher />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled
              aria-label={tShell("notifications")}
              className="rounded-full border-blue-200 bg-white text-blue-600 hover:bg-blue-50 [&_svg]:text-blue-600"
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
  );

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/80">
      <div className="flex w-full flex-col gap-2 px-3 pt-2.5 pb-2.5 sm:px-6 sm:pt-3 sm:pb-3 lg:px-8.5 md:gap-0 md:py-0">
        <div className="flex h-11 w-full items-center gap-2 md:h-16">
          <SidebarTrigger
            aria-label={triggerLabel}
            className="-ml-1 shrink-0 text-slate-500 border hover:bg-slate-100 hover:text-slate-900 sm:-ml-3"
          />
          <div className="min-w-0 flex-1 md:max-w-sm xl:max-w-md">
            <GlobalSearch />
          </div>

          {actions}
        </div>
      </div>
    </header>
  );
}
