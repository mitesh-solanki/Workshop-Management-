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
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-body text-foreground shadow-sm transition-[color,box-shadow] outline-none placeholder:text-slate-400 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
