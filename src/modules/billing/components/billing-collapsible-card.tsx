"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function BillingCollapsibleCard({
  title,
  hint,
  defaultOpen = false,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[13px] border border-[#cfdcf1] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.04)]",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 border-b border-[#d8e4f5] px-4 py-3.5 text-left transition-colors",
          open ? "bg-[#eef4ff]" : "bg-[#f4f8ff] hover:bg-[#eef4ff]",
        )}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="min-w-0 flex-1">
          <strong className="block text-[14px] font-semibold text-slate-900">
            {title}
          </strong>
          {hint ? (
            <small className="mt-0.5 block text-[13px] text-slate-500">
              {hint}
            </small>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-slate-400 transition-transform duration-300",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <SmoothAccordion open={open}>
        <div className="bg-[#fafcff] px-4 py-4 sm:px-5">{children}</div>
      </SmoothAccordion>
    </div>
  );
}
