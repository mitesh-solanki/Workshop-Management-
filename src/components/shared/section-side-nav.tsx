"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SectionNavItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type SharedProps<T extends string> = {
  title: string;
  items: readonly SectionNavItem<T>[];
  active: T;
  onChange: (id: T) => void;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  leading?: ReactNode;
};

function useActiveItem<T extends string>(
  items: readonly SectionNavItem<T>[],
  active: T,
) {
  return items.find((item) => item.id === active) ?? items[0];
}

/** Sticky section picker for mobile — must sit outside CSS grid so sticky can travel. */
export function SectionMobileNavBar<T extends string>({
  title,
  items,
  active,
  onChange,
  backHref,
  backLabel,
  onBack,
}: Omit<SharedProps<T>, "leading">) {
  const activeItem = useActiveItem(items, active);
  const ActiveIcon = activeItem?.icon;
  const showBack = Boolean(backHref || onBack);

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-card/95 px-4 py-2 backdrop-blur-md supports-backdrop-filter:bg-card/90 lg:hidden">
      <div className="flex items-center gap-2">
        {showBack ? (
          backHref ? (
            <Button
              asChild
              variant="outline"
              size="icon-sm"
              className="size-9 shrink-0 rounded-full border-slate-200"
              aria-label={backLabel}
            >
              <Link href={backHref}>
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-9 shrink-0 rounded-full border-slate-200"
              aria-label={backLabel}
              onClick={onBack}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
          )
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-h-9 flex-1 justify-between gap-2 border-primary/30 bg-card px-3 text-left text-sm font-semibold text-foreground shadow-sm"
              aria-label={title}
            >
              <span className="flex min-w-0 items-center gap-2">
                {ActiveIcon ? (
                  <ActiveIcon
                    className="size-3.5 shrink-0 text-primary"
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{activeItem?.label ?? title}</span>
              </span>
              <ChevronDown
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-48"
          >
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className={cn(
                    "min-h-11 gap-2",
                    isActive && "bg-accent font-semibold text-accent-foreground",
                  )}
                  onSelect={() => onChange(item.id)}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Desktop sidebar — keep inside the detail grid column. */
export function SectionDesktopNav<T extends string>({
  title,
  items,
  active,
  onChange,
  backHref,
  backLabel,
  onBack,
  leading,
}: SharedProps<T>) {
  const showBack = Boolean(backHref || onBack);

  const desktopLeading =
    leading ??
    (showBack ? (
      backHref ? (
        <Link
          href={backHref}
          className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-body font-medium text-slate-700 transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{backLabel}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-body font-medium text-slate-700 transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{backLabel}</span>
        </button>
      )
    ) : null);

  return (
    <Card className="sticky top-4 z-10 hidden gap-0 self-start overflow-visible py-0 lg:flex">
      <CardHeader className="border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardBody className="p-1.5 sm:p-2">
        <nav aria-label={title} className="flex flex-col gap-0.5">
          {desktopLeading}
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-body font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-700 hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </CardBody>
    </Card>
  );
}

/** @deprecated Prefer SectionMobileNavBar + SectionDesktopNav for sticky mobile. */
export function SectionSideNav<T extends string>(props: SharedProps<T>) {
  return (
    <>
      <SectionMobileNavBar {...props} />
      <SectionDesktopNav {...props} />
    </>
  );
}
