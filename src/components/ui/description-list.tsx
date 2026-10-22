import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn-style description list for record detail pages.
 * Use DescriptionList (2-col grid) or DescriptionListRows (stacked label/value).
 */
function DescriptionList({
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="description-list"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-5",
        className,
      )}
      {...props}
    />
  );
}

function DescriptionItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="description-item"
      className={cn("min-w-0 space-y-1", className)}
      {...props}
    />
  );
}

function DescriptionTerm({
  className,
  ...props
}: React.ComponentProps<"dt">) {
  return (
    <dt
      data-slot="description-term"
      className={cn("text-caption font-medium text-slate-500", className)}
      {...props}
    />
  );
}

function DescriptionDetails({
  className,
  ...props
}: React.ComponentProps<"dd">) {
  return (
    <dd
      data-slot="description-details"
      className={cn("text-body break-words text-slate-900", className)}
      {...props}
    />
  );
}

type DescriptionListRowsProps = {
  className?: string;
  children: ReactNode;
};

/** Stacked rows: label left, value right — good for compliance / meta. */
function DescriptionListRows({ className, children }: DescriptionListRowsProps) {
  return (
    <dl
      data-slot="description-list-rows"
      className={cn("divide-y divide-slate-100", className)}
    >
      {children}
    </dl>
  );
}

type DescriptionRowProps = {
  term: ReactNode;
  children: ReactNode;
  className?: string;
};

function DescriptionRow({ term, children, className }: DescriptionRowProps) {
  return (
    <div
      data-slot="description-row"
      className={cn(
        "flex flex-col gap-1 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
    >
      <DescriptionTerm className="shrink-0 sm:w-44">{term}</DescriptionTerm>
      <DescriptionDetails className="min-w-0 sm:text-right">
        {children}
      </DescriptionDetails>
    </div>
  );
}

export {
  DescriptionList,
  DescriptionItem,
  DescriptionTerm,
  DescriptionDetails,
  DescriptionListRows,
  DescriptionRow,
};
