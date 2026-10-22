import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Usage: <Textarea rows={3} placeholder="Notes" />
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-body text-foreground shadow-sm transition-[color,box-shadow] outline-none placeholder:text-slate-400 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
