"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ClipboardList,
  Contact,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/customers", key: "customers", icon: Contact },
  { href: "/orders", key: "orders", icon: ClipboardList },
  { href: "/team", key: "team", icon: Users },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur"
      aria-label={t("label")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {links.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
