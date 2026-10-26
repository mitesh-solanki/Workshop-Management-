"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SectionNavItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type Props<T extends string> = {
  title: string;
  items: readonly SectionNavItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Optional row above the items (e.g. back link). */
  leading?: ReactNode;
};

export function SectionSideNav<T extends string>({
  title,
  items,
  active,
  onChange,
  leading,
}: Props<T>) {
  return (
    <Card className="sticky top-0 z-10 gap-0 self-start overflow-visible py-0 lg:top-4">
      <CardHeader className="border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardBody className="p-1.5 sm:p-2">
        <nav aria-label={title} className="flex flex-col gap-0.5">
          {leading}
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
                  "inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition-colors sm:min-h-11 sm:gap-2.5 sm:px-3 sm:text-body",
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
