import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { OrderLineForm } from "@/modules/service-orders/components/order-line-form";
import { OrderTimeline } from "@/modules/service-orders/components/order-timeline";
import { StatusForm } from "@/modules/service-orders/components/status-form";
import { listParts } from "@/modules/inventory/service";
import {
  getOrder,
  getOrderTimeline,
} from "@/modules/service-orders/service";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDateTime(value: Date | null, empty: string) {
  if (!value) {
    return empty;
  }
  return value.toLocaleString();
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("orders");
  const tc = await getTranslations("customers");

  let order: Awaited<ReturnType<typeof getOrder>>;
  let timeline: Awaited<ReturnType<typeof getOrderTimeline>>;
  try {
    order = await getOrder(session, id);
    timeline = await getOrderTimeline(session, id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const parts = await listParts(session);

  const canMutate =
    (session.role === "OWNER" ||
      session.role === "MANAGER" ||
      (session.role === "TECHNICIAN" &&
        order.technicianId === session.userId)) &&
    order.status !== "COMPLETED";

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <Link href="/orders" className="text-sm text-muted-foreground underline">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {order.vehicle.registrationNumber}
            </h1>
            <p className="text-base text-muted-foreground">
              {order.customer.name} · {order.vehicle.make} {order.vehicle.model}
            </p>
          </div>
          <span className="rounded-md border px-3 py-1.5 text-sm font-medium">
            {t(`statuses.${order.status}`)}
          </span>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("details")}</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("complaint")}</dt>
            <dd className="whitespace-pre-wrap">{order.complaint}</dd>
          </div>
          {order.requestedServices && (
            <div>
              <dt className="text-muted-foreground">{t("requestedServices")}</dt>
              <dd className="whitespace-pre-wrap">{order.requestedServices}</dd>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("odometerIn")}</dt>
              <dd>
                {order.odometerIn != null
                  ? `${order.odometerIn} ${t("km")}`
                  : tc("notSet")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("expectedCompletion")}</dt>
              <dd>
                {formatDateTime(order.expectedCompletion, tc("notSet"))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("technician")}</dt>
              <dd>
                {order.technician
                  ? order.technician.name?.trim() || order.technician.email
                  : t("technicianUnassigned")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("priority")}</dt>
              <dd>{t(`priorities.${order.priority}`)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("bay")}</dt>
              <dd>{order.bay ?? tc("notSet")}</dd>
            </div>
          </div>
        </dl>
        <p>
          <Link
            href={`/customers/${order.customerId}`}
            className="text-sm underline"
          >
            {t("viewCustomer")}
          </Link>
        </p>
      </section>

      {canMutate && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{t("statusSection")}</h2>
          <StatusForm
            orderId={order.id}
            currentStatus={order.status as ServiceOrderStatusValue}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("inspectionSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("inspectionHint")}</p>
        <Link
          href={`/orders/${order.id}/inspection`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground"
        >
          {t("openInspection")}
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("estimateSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("estimateHint")}</p>
        <Link
          href={`/orders/${order.id}/estimate`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border px-4 text-base font-medium"
        >
          {t("openEstimate")}
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("lines")}</h2>
        {order.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("linesEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {order.lines.map((line) => {
              const total = multiplyByQuantity(
                line.unitPricePaise,
                line.quantity,
              );
              return (
                <li key={line.id} className="space-y-1 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{line.description}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t(`lineTypes.${line.type}`)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {line.quantity} × {formatRupees(line.unitPricePaise)} ={" "}
                    {formatRupees(total)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {canMutate && (
          <OrderLineForm
            orderId={order.id}
            parts={parts.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              unit: p.unit,
              sellingPricePaise: p.sellingPricePaise,
              quantityOnHand: p.quantityOnHand,
            }))}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("timeline")}</h2>
        <OrderTimeline
          events={timeline}
          emptyLabel={t("timelineEmpty")}
          formatActor={(actor) =>
            actor
              ? actor.name?.trim() || actor.email
              : t("timelineUnknownActor")
          }
          formatWhen={(date) => date.toLocaleString()}
          formatEvent={(event) => {
            const meta =
              event.meta && typeof event.meta === "object"
                ? (event.meta as Record<string, unknown>)
                : {};
            if (event.action === "service_order.status_changed") {
              const to = typeof meta.to === "string" ? meta.to : null;
              if (meta.created === true && to) {
                return t("timelineCreated", {
                  status: t(`statuses.${to as ServiceOrderStatusValue}`),
                });
              }
              const from = typeof meta.from === "string" ? meta.from : null;
              if (from && to) {
                return t("timelineStatusChanged", {
                  from: t(`statuses.${from as ServiceOrderStatusValue}`),
                  to: t(`statuses.${to as ServiceOrderStatusValue}`),
                });
              }
            }
            if (event.action === "service_order.line_added") {
              const description =
                typeof meta.description === "string"
                  ? meta.description
                  : t("lineDescription");
              return t("timelineLineAdded", { description });
            }
            return event.action;
          }}
        />
      </section>
    </main>
  );
}
