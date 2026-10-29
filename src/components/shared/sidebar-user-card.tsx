"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, LogOut, User } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SidebarUserCardProps = {
  name: string;
  email: string;
  roleLabel: string;
  collapsed?: boolean;
  /** Hide Garage Settings / profile for mechanics. */
  showProfileLink?: boolean;
};

export function SidebarUserCard({
  name,
  email,
  roleLabel,
  collapsed: _collapsed = false,
  showProfileLink = true,
}: SidebarUserCardProps) {
  const t = useTranslations("nav");
  const tLang = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("userMenu")}
          className={cn(
            "flex w-full min-h-14 items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 px-2.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:hover:bg-sidebar-accent",
          )}
        >
          <InitialsAvatar name={name} />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {name}
            </p>
            <Badge
              variant="secondary"
              className="mt-0.5 h-5 border-0 bg-blue-100 px-1.5 text-[10px] text-blue-800"
            >
              {roleLabel}
            </Badge>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-caption text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        {showProfileLink ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <User className="size-4" aria-hidden />
                {t("profile")}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-caption text-muted-foreground">
          {t("language")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            startTransition(async () => {
              await setLocale(value as Locale);
              router.refresh();
            });
          }}
        >
          {locales.map((code) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              disabled={pending}
              className="min-h-10"
            >
              <span className="flex flex-1 items-center justify-between gap-2">
                {tLang(code)}
                {code === locale ? (
                  <Check className="size-3.5 opacity-60" aria-hidden />
                ) : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="size-4" aria-hidden />
              {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
