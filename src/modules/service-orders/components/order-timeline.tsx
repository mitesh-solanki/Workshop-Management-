import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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

  return (
    <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative space-y-0.5">
          <span
            className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full bg-blue-600 ring-4 ring-card"
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
