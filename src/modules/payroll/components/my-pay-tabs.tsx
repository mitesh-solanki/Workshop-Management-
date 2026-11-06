"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type MyPayTab = "salary" | "advance";

type Props = {
  activeTab: MyPayTab;
};

export function MyPayTabs({ activeTab }: Props) {
  const t = useTranslations("myPay");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(tab: MyPayTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "salary") params.delete("tab");
    else params.set("tab", tab);
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div
      className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
      role="tablist"
      aria-label={t("tabsLabel")}
    >
      {(
        [
          { id: "salary" as const, label: t("tabs.salary") },
          { id: "advance" as const, label: t("tabs.advance") },
        ] as const
      ).map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex h-9 min-h-9 items-center rounded-md px-3 text-[13px] font-semibold transition-colors",
              active
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
