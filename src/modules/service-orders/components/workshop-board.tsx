"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { moveServiceOrderStatusAction } from "@/app/actions/service-orders";
import { cn } from "@/lib/utils";
import {
  BOARD_STATUSES,
  PRIORITY_RANK,
  STATUS_TRANSITIONS,
  canTransitionStatus,
  type ServiceOrderPriorityValue,
  type ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";

export type BoardOrder = {
  id: string;
  status: ServiceOrderStatusValue;
  priority: ServiceOrderPriorityValue;
  expectedCompletion: Date | string | null;
  bay: string | null;
  vehicle: { registrationNumber: string };
  customer: { name: string };
  technician: { id: string; name: string | null; email: string } | null;
};

export type BoardTechnician = {
  id: string;
  name: string | null;
  email: string;
};

export type BoardBay = {
  bay: string;
  count: number;
  registrationNumbers: string[];
};

type Props = {
  orders: BoardOrder[];
  technicians: BoardTechnician[];
  bays: BoardBay[];
  selectedTechnicianId: string;
  canFilterTechnicians: boolean;
  canMutate: boolean;
};

function formatDue(value: Date | string | null, empty: string): string {
  if (!value) {
    return empty;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return empty;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(value: Date | string | null): boolean {
  if (!value) {
    return false;
  }
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function sortBoardOrders(a: BoardOrder, b: BoardOrder): number {
  const byPriority =
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) {
    return byPriority;
  }
  const aDue = a.expectedCompletion
    ? new Date(a.expectedCompletion).getTime()
    : Number.POSITIVE_INFINITY;
  const bDue = b.expectedCompletion
    ? new Date(b.expectedCompletion).getTime()
    : Number.POSITIVE_INFINITY;
  return aDue - bDue;
}

function techLabel(tech: BoardTechnician | BoardOrder["technician"]): string {
  if (!tech) {
    return "";
  }
  return tech.name?.trim() || tech.email;
}

export function WorkshopBoard({
  orders,
  technicians,
  bays,
  selectedTechnicianId,
  canFilterTechnicians,
  canMutate,
}: Props) {
  const t = useTranslations("workshop");
  const to = useTranslations("orders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] =
    useState<ServiceOrderStatusValue>("WAITING");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ServiceOrderStatusValue | null>(
    null,
  );

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(
      BOARD_STATUSES.map((status) => [status, [] as BoardOrder[]]),
    ) as Record<ServiceOrderStatusValue, BoardOrder[]>;

    for (const order of orders) {
      map[order.status].push(order);
    }
    for (const status of BOARD_STATUSES) {
      map[status].sort(sortBoardOrders);
    }
    return map;
  }, [orders]);

  function onTechnicianFilter(value: string) {
    const params = new URLSearchParams();
    if (value) {
      params.set("technicianId", value);
    }
    const query = params.toString();
    router.push(query ? `/workshop?${query}` : "/workshop");
  }

  function moveOrder(orderId: string, toStatus: ServiceOrderStatusValue) {
    const order = orders.find((item) => item.id === orderId);
    if (!order || !canMutate) {
      return;
    }
    if (!canTransitionStatus(order.status, toStatus)) {
      setError(t("invalidDrop"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await moveServiceOrderStatusAction(orderId, toStatus);
      if (!result.ok) {
        setError(result.message ?? t("moveFailed"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canFilterTechnicians && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="board-technician" className="text-sm font-medium">
            {t("filterTechnician")}
          </label>
          <select
            id="board-technician"
            className="min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedTechnicianId}
            onChange={(event) => onTechnicianFilter(event.target.value)}
          >
            <option value="">{t("filterAllTechnicians")}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {techLabel(tech)}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="space-y-2" aria-label={t("bayOccupancy")}>
        <h2 className="text-sm font-medium">{t("bayOccupancy")}</h2>
        {bays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("bayEmpty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {bays.map((bay) => (
              <li
                key={bay.bay}
                className="rounded-md border px-3 py-2 text-sm"
                title={bay.registrationNumbers.join(", ")}
              >
                <span className="font-medium">{bay.bay}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {t("bayCount", { count: bay.count })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="text-sm text-destructive" role="status">
          {error}
        </p>
      )}
      {pending && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("moving")}
        </p>
      )}

      {/* Phone: column switcher */}
      <div className="space-y-3 md:hidden">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="board-column" className="text-sm font-medium">
            {t("columnSwitcher")}
          </label>
          <select
            id="board-column"
            className="min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={mobileStatus}
            onChange={(event) =>
              setMobileStatus(event.target.value as ServiceOrderStatusValue)
            }
          >
            {BOARD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {to(`statuses.${status}`)} ({byStatus[status].length})
              </option>
            ))}
          </select>
        </div>
        <BoardColumn
          status={mobileStatus}
          orders={byStatus[mobileStatus]}
          canMutate={canMutate}
          draggingId={draggingId}
          isDropTarget={false}
          onDragStart={setDraggingId}
          onDragEnd={() => {
            setDraggingId(null);
            setDropTarget(null);
          }}
          onDropStatus={() => undefined}
          onMove={moveOrder}
          showMoveButtons
        />
      </div>

      {/* Desktop / tablet: all columns, drag between them */}
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex md:items-start">
        {BOARD_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            orders={byStatus[status]}
            canMutate={canMutate}
            draggingId={draggingId}
            isDropTarget={dropTarget === status}
            onDragStart={setDraggingId}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTarget(null);
            }}
            onDropStatus={(orderId) => moveOrder(orderId, status)}
            onDragOverColumn={() => setDropTarget(status)}
            onDragLeaveColumn={() =>
              setDropTarget((current) => (current === status ? null : current))
            }
            onMove={moveOrder}
            showMoveButtons={false}
          />
        ))}
      </div>

      {orders.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}

type ColumnProps = {
  status: ServiceOrderStatusValue;
  orders: BoardOrder[];
  canMutate: boolean;
  draggingId: string | null;
  isDropTarget: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropStatus: (orderId: string) => void;
  onDragOverColumn?: () => void;
  onDragLeaveColumn?: () => void;
  onMove: (orderId: string, to: ServiceOrderStatusValue) => void;
  showMoveButtons: boolean;
};

function BoardColumn({
  status,
  orders,
  canMutate,
  draggingId,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDropStatus,
  onDragOverColumn,
  onDragLeaveColumn,
  onMove,
  showMoveButtons,
}: ColumnProps) {
  const t = useTranslations("workshop");
  const to = useTranslations("orders");

  return (
    <section
      className={cn(
        "flex w-full shrink-0 flex-col rounded-md border bg-secondary/20 md:w-64",
        isDropTarget && "ring-2 ring-ring",
      )}
      aria-label={to(`statuses.${status}`)}
      onDragOver={(event) => {
        if (!canMutate || !draggingId) {
          return;
        }
        event.preventDefault();
        onDragOverColumn?.();
      }}
      onDragLeave={() => onDragLeaveColumn?.()}
      onDrop={(event) => {
        event.preventDefault();
        const orderId =
          event.dataTransfer.getData("text/order-id") || draggingId;
        if (orderId) {
          onDropStatus(orderId);
        }
        onDragEnd();
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">{to(`statuses.${status}`)}</h3>
        <span className="text-xs text-muted-foreground">{orders.length}</span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2 p-2">
        {orders.length === 0 ? (
          <li className="px-1 py-3 text-xs text-muted-foreground">
            {t("columnEmpty")}
          </li>
        ) : (
          orders.map((order) => (
            <BoardCard
              key={order.id}
              order={order}
              canMutate={canMutate}
              isDragging={draggingId === order.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onMove={onMove}
              showMoveButtons={showMoveButtons}
            />
          ))
        )}
      </ul>
    </section>
  );
}

type CardProps = {
  order: BoardOrder;
  canMutate: boolean;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMove: (orderId: string, to: ServiceOrderStatusValue) => void;
  showMoveButtons: boolean;
};

function BoardCard({
  order,
  canMutate,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
  showMoveButtons,
}: CardProps) {
  const t = useTranslations("workshop");
  const to = useTranslations("orders");
  const nextStatuses = STATUS_TRANSITIONS[order.status];
  const draggable = canMutate && nextStatuses.length > 0;
  const overdue = isOverdue(order.expectedCompletion);

  return (
    <li
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          return;
        }
        event.dataTransfer.setData("text/order-id", order.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(order.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-md border bg-background p-3 shadow-sm",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/orders/${order.id}`}
          className="min-h-11 min-w-0 flex-1 font-medium underline-offset-2 hover:underline"
        >
          {order.vehicle.registrationNumber}
        </Link>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
            order.priority === "URGENT" && "bg-destructive/15 text-destructive",
            order.priority === "HIGH" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
            order.priority === "NORMAL" && "bg-secondary text-secondary-foreground",
            order.priority === "LOW" && "bg-muted text-muted-foreground",
          )}
        >
          {t(`priorities.${order.priority}`)}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        {order.customer.name}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("technicianLabel")}:{" "}
        {order.technician
          ? techLabel(order.technician)
          : to("technicianUnassigned")}
      </p>
      <p
        className={cn(
          "mt-1 text-xs",
          overdue ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        {t("dueLabel")}: {formatDue(order.expectedCompletion, t("dueNone"))}
        {overdue ? ` · ${t("overdue")}` : null}
      </p>
      {order.bay && (
        <p className="mt-1 text-xs text-muted-foreground">
          {to("bay")}: {order.bay}
        </p>
      )}
      {showMoveButtons && canMutate && nextStatuses.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs font-medium">{t("moveTo")}</p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className="min-h-11 rounded-md border px-3 text-sm font-medium"
                onClick={() => onMove(order.id, status)}
              >
                {to(`statuses.${status}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
