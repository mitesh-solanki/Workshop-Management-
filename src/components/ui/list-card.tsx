import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ListCardProps = {
  href?: string;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

/** Tappable list row for mobile-first lists. */
function ListCard({
  href,
  onClick,
  title,
  subtitle,
  meta,
  trailing,
  className,
  titleClassName,
  subtitleClassName,
}: ListCardProps) {
  const body = (
    <>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "truncate text-body font-medium text-slate-900",
              titleClassName,
            )}
          >
            {title}
          </p>
          {meta ? (
            <div className="shrink-0 text-caption text-slate-500">{meta}</div>
          ) : null}
        </div>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-caption text-slate-600",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ??
        (href || onClick ? (
          <ChevronRight
            className="size-5 shrink-0 text-slate-400"
            aria-hidden
          />
        ) : null)}
    </>
  );

  const interactive = Boolean(href || onClick);
  const classes = cn(
    "flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left transition-colors",
    interactive &&
      "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
}

type ListCardGroupProps = {
  children: ReactNode;
  className?: string;
};

function ListCardGroup({ children, className }: ListCardGroupProps) {
  return (
    <ul
      className={cn(
        "divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export { ListCard, ListCardGroup };
