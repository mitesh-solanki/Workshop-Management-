"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  bottomNavItemsForRole,
  type AppRole,
} from "@/components/shared/nav-items";
import { cn } from "@/lib/utils";

type BottomNavProps = {
  role: AppRole;
};

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = bottomNavItemsForRole(role, 4);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden"
      aria-label={t("label")}
    >
      <ul className="mx-auto flex max-w-7xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                  active
                    ? "text-teal-700"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
