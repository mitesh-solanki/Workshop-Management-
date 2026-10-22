import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Tighter padding for nested dashboard panels. */
  compact?: boolean;
  className?: string;
};

/**
 * Usage: <EmptyState icon={Package} title="No parts" description="…" action={<Button>Add</Button>} />
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed py-0 shadow-sm", className)}>
      <CardBody
        className={cn(
          "flex flex-col items-center text-center",
          compact ? "gap-1.5 px-4 py-6" : "gap-2 px-4 py-10",
        )}
      >
        {Icon ? (
          <Icon
            className={cn("text-slate-400", compact ? "size-6" : "size-8")}
            aria-hidden
          />
        ) : null}
        <p
          className={cn(
            "text-slate-900",
            compact ? "text-body font-semibold" : "text-section-title",
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="max-w-sm text-caption text-slate-600 sm:text-body">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-1.5">{action}</div> : null}
      </CardBody>
    </Card>
  );
}

export { EmptyState };
