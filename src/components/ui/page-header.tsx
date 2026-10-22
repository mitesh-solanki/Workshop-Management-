import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Right-side actions (buttons). */
  actions?: ReactNode;
  /** Optional tabs row under the title. */
  tabs?: ReactNode;
  className?: string;
};

/**
 * Usage:
 * <PageHeader title="Team" description="…" actions={<Button>Invite</Button>} tabs={<Tabs… />} />
 */
function PageHeader({
  title,
  description,
  actions,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-page-title text-slate-900">{title}</h1>
          {description ? (
            typeof description === "string" ? (
              <p className="hidden text-body text-slate-600 sm:block">
                {description}
              </p>
            ) : (
              <div className="hidden text-body text-slate-600 sm:block">
                {description}
              </div>
            )
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {tabs ? <div className="border-b border-slate-200">{tabs}</div> : null}
    </header>
  );
}

export { PageHeader };
