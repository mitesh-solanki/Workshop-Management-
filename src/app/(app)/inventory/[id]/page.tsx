import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { PartDetailPanel } from "@/modules/inventory/components/part-detail-panel";
import { getPartHistory } from "@/modules/inventory/service";
import {
  canWritePurchaseOps,
  getPartsRequestsForPart,
} from "@/modules/purchases/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function PartDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("inventory");

  let data: Awaited<ReturnType<typeof getPartHistory>>;
  try {
    data = await getPartHistory(session, id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const { part, movements } = data;
  const canWrite = session.role === "OWNER" || session.role === "MANAGER";
  const canManageRequests = canWritePurchaseOps(session);
  const partsRequests = canManageRequests
    ? await getPartsRequestsForPart(session, part.id)
    : [];

  const unitLabel =
    part.unit === "pcs" ||
    part.unit === "set" ||
    part.unit === "pair" ||
    part.unit === "litre" ||
    part.unit === "ml" ||
    part.unit === "kg" ||
    part.unit === "g" ||
    part.unit === "metre"
      ? t(`units.${part.unit}`)
      : part.unit;

  return (
    <main className="w-full space-y-4">
      <Link
        href="/inventory"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <PartDetailPanel
        part={{
          id: part.id,
          name: part.name,
          sku: part.sku,
          unit: part.unit,
          purchasePricePaise: part.purchasePricePaise,
          sellingPricePaise: part.sellingPricePaise,
          gstRatePercent: part.gstRatePercent,
          hsn: part.hsn,
          lowStockLevel: part.lowStockLevel,
          quantityOnHand: part.quantityOnHand,
        }}
        unitLabel={unitLabel}
        movements={movements.map((m) => ({
          id: m.id,
          type: m.type,
          quantityChange: m.quantityChange,
          note: m.note,
          createdAt: m.createdAt,
        }))}
        partsRequests={partsRequests.map((request) => ({
          id: request.id,
          status: request.status,
          quantity: request.quantity,
          notes: request.notes,
          createdAt: request.createdAt,
          purchaseOrder: request.purchaseOrder
            ? {
                id: request.purchaseOrder.id,
                number: request.purchaseOrder.number,
                vendor: request.purchaseOrder.vendor,
              }
            : null,
          serviceOrder: request.serviceOrder,
        }))}
        canWrite={canWrite}
        canManageRequests={canManageRequests}
        locale={locale}
      />
    </main>
  );
}
