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
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className="space-y-3 border-l-2 border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative space-y-0.5">
          <span
            className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full bg-foreground"
            aria-hidden
          />
          <p className="text-sm font-medium">{formatEvent(event)}</p>
          <p className="text-xs text-muted-foreground">
            {formatActor(event.actor)} · {formatWhen(event.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
