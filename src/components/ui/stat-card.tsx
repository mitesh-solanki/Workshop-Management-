import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardBody,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardTone =
  | "waiting"
  | "inspection"
  | "in-progress"
  | "waiting-parts"
  | "ready"
  | "completed"
  | "danger"
  | "neutral";

const toneClasses: Record<
  StatCardTone,
  { border: string; icon: string; emphasize: string }
> = {
  waiting: {
    border: "border-t-status-waiting",
    icon: "bg-status-waiting/15 text-status-waiting",
    emphasize: "ring-1 ring-status-waiting/30",
  },
  inspection: {
    border: "border-t-status-inspection",
    icon: "bg-status-inspection/15 text-status-inspection",
    emphasize: "ring-1 ring-status-inspection/30",
  },
  "in-progress": {
    border: "border-t-status-in-progress",
    icon: "bg-status-in-progress/15 text-status-in-progress",
    emphasize: "ring-1 ring-status-in-progress/30",
  },
  "waiting-parts": {
    border: "border-t-status-waiting-parts",
    icon: "bg-status-waiting-parts/20 text-status-waiting-parts",
    emphasize:
      "bg-status-waiting-parts/5 ring-1 ring-status-waiting-parts/40 shadow-sm",
  },
  ready: {
    border: "border-t-status-ready",
    icon: "bg-status-ready/15 text-status-ready",
    emphasize: "ring-1 ring-status-ready/30",
  },
  completed: {
    border: "border-t-status-completed",
    icon: "bg-status-completed/15 text-status-completed",
    emphasize: "ring-1 ring-status-completed/30",
  },
  danger: {
    border: "border-t-danger",
    icon: "bg-danger/15 text-danger",
    emphasize: "bg-danger/5 ring-1 ring-danger/40 shadow-sm",
  },
  neutral: {
    border: "border-t-slate-300",
    icon: "bg-slate-100 text-slate-600",
    emphasize: "ring-1 ring-slate-200",
  },
};

type StatCardProps = {
  title: string;
  value: ReactNode;
  description?: string;
  /** Icon shown in a coloured tile. */
  icon?: LucideIcon;
  /** Status / semantic colour for top border and icon tile. */
  tone?: StatCardTone;
  /** Stronger emphasis when the count matters (e.g. waiting for parts > 0). */
  emphasize?: boolean;
  /** Optional trailing chip (e.g. Badge). */
  badge?: ReactNode;
  className?: string;
};

/**
 * Usage:
 * <StatCard title="Waiting" value={12} icon={Clock} tone="waiting" />
 */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "neutral",
  emphasize = false,
  badge,
  className,
}: StatCardProps) {
  const colors = toneClasses[tone];

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-t-2 py-0",
        colors.border,
        emphasize && colors.emphasize,
        className,
      )}
    >
      <CardBody className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          {Icon ? (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                colors.icon,
              )}
              aria-hidden
            >
              <Icon className="size-5" />
            </span>
          ) : (
            <span className="size-10" aria-hidden />
          )}
          {badge}
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-page-title tabular-nums text-slate-900">{value}</p>
          <CardTitle className="text-body font-medium text-slate-600">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="text-caption">
              {description}
            </CardDescription>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export { StatCard, type StatCardTone };
