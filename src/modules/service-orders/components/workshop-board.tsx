"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import { moveServiceOrderStatusAction } from "@/app/actions/service-orders";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  BOARD_STATUSES,
  canTransitionStatus,
  PRIORITY_RANK,
  STATUS_TRANSITIONS,
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
  selectedBay: string;
  canFilterTechnicians: boolean;
  canMutate: boolean;
};

const selectClass =
  "h-9 min-h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 sm:w-auto sm:min-w-[11rem]";

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
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
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
  orders: ordersProp,
  technicians,
  bays,
  selectedTechnicianId,
  selectedBay,
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
  /** Ref so dragover can allow drops before React re-renders after dragstart. */
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ServiceOrderStatusValue | null>(
    null,
  );
  /** Local copy so status moves show immediately and stay draggable. */
  const [orders, setOrders] = useState(ordersProp);

  useEffect(() => {
    setOrders(ordersProp);
  }, [ordersProp]);

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

  const draggingOrder = draggingId
    ? orders.find((item) => item.id === draggingId)
    : null;

  function clearDrag() {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  function beginDrag(orderId: string) {
    draggingIdRef.current = orderId;
    setDraggingId(orderId);
    setError(null);
  }

  function pushFilters(next: { technicianId?: string; bay?: string }) {
    const params = new URLSearchParams();
    const technicianId =
      next.technicianId !== undefined
        ? next.technicianId
        : selectedTechnicianId;
    const bay = next.bay !== undefined ? next.bay : selectedBay;
    if (technicianId) {
      params.set("technicianId", technicianId);
    }
    if (bay) {
      params.set("bay", bay);
    }
    const query = params.toString();
    router.push(query ? `/workshop?${query}` : "/workshop");
  }

  function moveOrder(orderId: string, toStatus: ServiceOrderStatusValue) {
    const order = orders.find((item) => item.id === orderId);
    if (!order || order.status === toStatus) {
      return;
    }
    if (!canTransitionStatus(order.status, toStatus)) {
      setError(t("invalidMove"));
      return;
    }

    const fromStatus = order.status;
    setError(null);
    // Optimistic: card jumps to the new column and status updates immediately.
    setOrders((current) =>
      current.map((item) =>
        item.id === orderId ? { ...item, status: toStatus } : item,
      ),
    );

    startTransition(async () => {
      const result = await moveServiceOrderStatusAction(orderId, toStatus);
      if (!result.ok) {
        setOrders((current) =>
          current.map((item) =>
            item.id === orderId ? { ...item, status: fromStatus } : item,
          ),
        );
        setError(result.message ?? t("moveFailed"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {(canFilterTechnicians || bays.length > 0) && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-card px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          {canFilterTechnicians ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <label
                htmlFor="board-technician"
                className="shrink-0 text-caption font-medium text-slate-500"
              >
                {t("filterTechnician")}
              </label>
              <select
                id="board-technician"
                className={selectClass}
                value={selectedTechnicianId}
                onChange={(event) =>
                  pushFilters({ technicianId: event.target.value })
                }
              >
                <option value="">{t("filterAllTechnicians")}</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {techLabel(tech)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {bays.length > 0 ? (
            <section
              className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end"
              aria-label={t("filterBay")}
            >
              <span className="text-caption font-medium text-slate-500">
                {t("filterBay")}
              </span>
              <ul className="flex flex-wrap gap-1">
                <li>
                  <button
                    type="button"
                    aria-pressed={!selectedBay}
                    onClick={() => pushFilters({ bay: "" })}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      !selectedBay
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    {t("filterAllBays")}
                  </button>
                </li>
                {bays.map((bay) => {
                  const active = selectedBay === bay.bay;
                  return (
                    <li key={bay.bay}>
                      <button
                        type="button"
                        title={bay.registrationNumbers.join(", ")}
                        aria-pressed={active}
                        onClick={() =>
                          pushFilters({ bay: active ? "" : bay.bay })
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                          active
                            ? "border-blue-700 bg-blue-700 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100",
                        )}
                      >
                        <span className="font-semibold">{bay.bay}</span>
                        <span
                          className={cn(
                            "tabular-nums",
                            active ? "text-blue-100" : "text-slate-500",
                          )}
                        >
                          {bay.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="text-sm text-danger" role="status">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="text-sm text-slate-600" role="status">
          {t("moving")}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("emptyTitle")}
          description={t("empty")}
          action={
            <Button asChild variant="secondary" size="md">
              <Link href="/orders">{to("title")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            <FormField id="board-column" label={t("columnSwitcher")}>
              <select
                id="board-column"
                className={selectClass}
                value={mobileStatus}
                onChange={(event) =>
                  setMobileStatus(
                    event.target.value as ServiceOrderStatusValue,
                  )
                }
              >
                {BOARD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {`${to(`statuses.${status}`)} (${byStatus[status].length})`}
                  </option>
                ))}
              </select>
            </FormField>
            <BoardColumn
              status={mobileStatus}
              orders={byStatus[mobileStatus]}
              canMutate={canMutate}
              draggingId={draggingId}
              isDropTarget={false}
              canAcceptOrder={() => false}
              getDraggingId={() => draggingIdRef.current}
              onDragStart={beginDrag}
              onDragEnd={clearDrag}
              onDropStatus={() => undefined}
              onMove={moveOrder}
              showMoveButtons
            />
          </div>

          <div className="hidden min-w-0 gap-2 lg:grid lg:grid-cols-3 xl:grid-cols-6">
            {BOARD_STATUSES.map((status) => {
              const acceptDrop = Boolean(
                draggingOrder &&
                  canTransitionStatus(draggingOrder.status, status),
              );
              return (
                <BoardColumn
                  key={status}
                  status={status}
                  orders={byStatus[status]}
                  canMutate={canMutate}
                  draggingId={draggingId}
                  isDropTarget={dropTarget === status && acceptDrop}
                  canAcceptOrder={(orderId) => {
                    const order = orders.find((item) => item.id === orderId);
                    return Boolean(
                      order && canTransitionStatus(order.status, status),
                    );
                  }}
                  getDraggingId={() => draggingIdRef.current}
                  onDragStart={beginDrag}
                  onDragEnd={clearDrag}
                  onDropStatus={(orderId) => moveOrder(orderId, status)}
                  onDragOverColumn={() => setDropTarget(status)}
                  onDragLeaveColumn={() =>
                    setDropTarget((current) =>
                      current === status ? null : current,
                    )
                  }
                  onMove={moveOrder}
                  showMoveButtons={false}
                />
              );
            })}
          </div>
        </>
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
  canAcceptOrder: (orderId: string) => boolean;
  getDraggingId: () => string | null;
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
  canAcceptOrder,
  getDraggingId,
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
  const activeId = getDraggingId() ?? draggingId;
  const acceptDrop = Boolean(activeId && canAcceptOrder(activeId));

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50/70",
        isDropTarget &&
          "border-blue-600 bg-blue-50/50 ring-2 ring-inset ring-blue-600/25",
        draggingId && !acceptDrop && "opacity-60",
      )}
      aria-label={to(`statuses.${status}`)}
      onDragOver={(event) => {
        if (!canMutate) {
          return;
        }
        // Read ref synchronously — React state from dragstart may not have flushed yet.
        const orderId = getDraggingId();
        if (!orderId || !canAcceptOrder(orderId)) {
          return;
        }
        // Must preventDefault or the browser will not fire drop.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOverColumn?.();
      }}
      onDragLeave={() => onDragLeaveColumn?.()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const orderId =
          event.dataTransfer.getData("text/plain") ||
          event.dataTransfer.getData("text/order-id") ||
          getDraggingId();
        if (orderId && canAcceptOrder(orderId)) {
          onDropStatus(orderId);
        }
        onDragEnd();
      }}
    >
      <header className="flex items-center justify-between gap-1.5 rounded-t-lg border-b border-slate-200 bg-card px-2 py-1.5">
        <StatusBadge status={status} label={to(`statuses.${status}`)} />
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
          {orders.length}
        </span>
      </header>
      <ul className="flex min-h-28 flex-col gap-2 p-2">
        {orders.length === 0 ? (
          <li className="px-1 py-3 text-center text-caption text-slate-500">
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
          event.preventDefault();
          return;
        }
        // text/plain is reliable across browsers; custom type alone can fail.
        event.dataTransfer.setData("text/plain", order.id);
        event.dataTransfer.setData("text/order-id", order.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(order.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border border-slate-200 bg-card p-2.5 shadow-sm",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <Link
          href={`/orders/${order.id}`}
          draggable={false}
          onClick={(event) => {
            // Avoid navigating when the user was dragging the card.
            if (isDragging) {
              event.preventDefault();
            }
          }}
          className="min-h-11 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 underline-offset-2 hover:text-blue-700 hover:underline"
        >
          {order.vehicle.registrationNumber}
        </Link>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            order.priority === "URGENT" && "bg-danger/15 text-danger",
            order.priority === "HIGH" && "bg-amber-500/15 text-amber-800",
            order.priority === "NORMAL" && "bg-slate-100 text-slate-700",
            order.priority === "LOW" && "bg-slate-50 text-slate-500",
          )}
        >
          {t(`priorities.${order.priority}`)}
        </span>
      </div>
      <p className="mt-1 truncate text-caption text-slate-600">
        {order.customer.name}
      </p>
      <p className="mt-0.5 truncate text-caption text-slate-500">
        {`${t("technicianLabel")}: ${
          order.technician
            ? techLabel(order.technician)
            : to("technicianUnassigned")
        }`}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-caption",
          overdue ? "font-medium text-danger" : "text-slate-500",
        )}
      >
        {`${t("dueLabel")}: ${formatDue(order.expectedCompletion, t("dueNone"))}${
          overdue ? ` · ${t("overdue")}` : ""
        }`}
      </p>
      {order.bay ? (
        <p className="mt-0.5 truncate text-caption text-slate-500">
          {`${to("bay")}: ${order.bay}`}
        </p>
      ) : null}
      {showMoveButtons && canMutate && nextStatuses.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
          <p className="text-caption font-medium text-slate-700">{t("moveTo")}</p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onMove(order.id, status)}
              >
                {to(`statuses.${status}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
