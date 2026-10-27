import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type TimelineActor = {
  id: string;
  name: string | null;
  email: string;
} | null;

type TimelineEvent = {
  id: string;
  action: string;
  meta: unknown;
  createdAt: Date;
  actor: TimelineActor;
};

type Props = {
  events: TimelineEvent[];
  emptyLabel: string;
  formatActor: (actor: TimelineActor) => string;
  formatEvent: (event: TimelineEvent) => string;
  formatWhen: (date: Date) => string;
};

const DAY_DOT_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-600",
  "bg-rose-500",
  "bg-cyan-600",
  "bg-orange-500",
  "bg-indigo-600",
] as const;

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayDotClass(date: Date, dayIndexByKey: Map<string, number>): string {
  const key = dayKey(date);
  let index = dayIndexByKey.get(key);
  if (index == null) {
    index = dayIndexByKey.size;
    dayIndexByKey.set(key, index);
  }
  return DAY_DOT_COLORS[index % DAY_DOT_COLORS.length]!;
}

export function OrderTimeline({
  events,
  emptyLabel,
  formatActor,
  formatEvent,
  formatWhen,
}: Props) {
  if (events.length === 0) {
    return (
      <EmptyState compact icon={History} title={emptyLabel} className="border-0 shadow-none" />
    );
  }

  const dayIndexByKey = new Map<string, number>();

  return (
    <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative space-y-0.5">
          <span
            className={cn(
              "absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full ring-4 ring-card",
              dayDotClass(event.createdAt, dayIndexByKey),
            )}
            aria-hidden
          />
          <p className="text-body font-medium text-slate-900">
            {formatEvent(event)}
          </p>
          <p className="text-caption text-slate-500">
            {`${formatActor(event.actor)} · ${formatWhen(event.createdAt)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
