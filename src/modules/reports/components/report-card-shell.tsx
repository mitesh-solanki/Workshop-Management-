"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  countLabel: string;
  hero: ReactNode;
  actions: ReactNode;
  chart: ReactNode;
  pending?: boolean;
};

/** Shared chrome for money + inventory report cards. */
export function ReportCardShell({
  title,
  countLabel,
  hero,
  actions,
  chart,
  pending = false,
}: Props) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-opacity",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              {title}
            </h2>
            <span className="text-xs font-medium text-slate-500 sm:text-sm">
              ({countLabel})
            </span>
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
            {hero}
          </div>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          {actions}
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1">{chart}</div>
    </article>
  );
}
