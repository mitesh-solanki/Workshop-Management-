import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { AddChecklistItemForm } from "@/modules/inspections/components/add-checklist-item-form";
import { ChecklistItemCard } from "@/modules/inspections/components/checklist-item-card";
import { SuggestedRepairSection } from "@/modules/inspections/components/suggested-repair-form";
import { getOrCreateInspection } from "@/modules/inspections/service";
import { getOrder } from "@/modules/service-orders/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderInspectionPage({ params }: Props) {
  const session = await requireSession();
  const { id: orderId } = await params;
  const t = await getTranslations("inspections");
  const to = await getTranslations("orders");

  let order: Awaited<ReturnType<typeof getOrder>>;
  let inspection: Awaited<ReturnType<typeof getOrCreateInspection>>;
  try {
    order = await getOrder(session, orderId);
    inspection = await getOrCreateInspection(session, orderId);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  if (!inspection) {
    return (
      <main className="space-y-4">
        <Link
          href={`/orders/${orderId}`}
          className="text-sm text-muted-foreground underline"
        >
          {t("backToOrder")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("emptyReadOnly")}</p>
      </main>
    );
  }

  const canEdit =
    (session.role === "OWNER" ||
      session.role === "MANAGER" ||
      (session.role === "TECHNICIAN" &&
        order.technicianId === session.userId)) &&
    order.status !== "COMPLETED";

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <Link
          href={`/orders/${orderId}`}
          className="text-sm text-muted-foreground underline"
        >
          {t("backToOrder")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">
          {order.vehicle.registrationNumber} · {order.customer.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {to(`statuses.${order.status}`)}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("checklist")}</h2>
        <p className="text-sm text-muted-foreground">{t("checklistHint")}</p>
        <div className="space-y-4">
          {inspection.items.map((item) => (
            <ChecklistItemCard
              key={item.id}
              orderId={orderId}
              canEdit={canEdit}
              item={{
                id: item.id,
                key: item.key,
                label: item.label,
                result: item.result,
                notes: item.notes,
                media: item.media.map((m) => ({
                  id: m.id,
                  kind: m.kind,
                  url: m.url,
                  contentType: m.contentType,
                })),
              }}
            />
          ))}
        </div>
        {canEdit && <AddChecklistItemForm orderId={orderId} />}
      </section>

      <SuggestedRepairSection
        orderId={orderId}
        canEdit={canEdit}
        repairs={inspection.suggestedRepairs.map((r) => ({
          id: r.id,
          type: r.type,
          description: r.description,
          quantity: r.quantity,
          unitPricePaise: r.unitPricePaise,
        }))}
      />
    </main>
  );
}
