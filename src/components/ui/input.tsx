import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isDateLike =
    type === "date" || type === "datetime-local" || type === "month" || type === "time"

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none focus-visible:outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-sm",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        "aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger/30 dark:aria-invalid:ring-danger/40",
        // Chromium centers the date segments in the wide edit area — pin value left, icon right.
        isDateLike &&
          "relative text-left [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:m-0 [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0",
        className
      )}
      {...props}
    />
  )
}

export { Input }
