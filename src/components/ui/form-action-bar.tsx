"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

type Props = {
  actions: ReactNode;
  summary?: ReactNode;
  className?: string;
};

/**
 * Fixed bottom action bar for long create/edit pages (Cruise admin pattern).
 * Clears the app sidebar from lg up; full-bleed on smaller screens.
 */
export function FormActionBar({ actions, summary, className }: Props) {
  const { state } = useSidebar();

  return (
    <div
      data-slot="form-action-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_28px_-14px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:px-6 lg:px-8.5",
        state === "collapsed"
          ? "lg:left-(--sidebar-width-icon)"
          : "lg:left-(--sidebar-width)",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 shrink">{summary}</div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
