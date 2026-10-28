import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { PartPageForm } from "@/modules/inventory/components/part-page-form";
import { getPart } from "@/modules/inventory/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function EditPartPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("inventory");

  try {
    requireRole(session, ["OWNER", "MANAGER"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="w-full space-y-6">
          <PageHeader title={t("editTitle")} />
          <EmptyState
            icon={ShieldAlert}
            title={t("forbidden")}
            action={
              <Link
                href="/inventory"
                className="text-sm text-teal-700 underline-offset-4 hover:underline"
              >
                {t("back")}
              </Link>
            }
          />
        </main>
      );
    }
    throw error;
  }

  let part;
  try {
    part = await getPart(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href={`/inventory/${part.id}`}
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("backToPart", { name: part.name })}
      </Link>

      <PageHeader title={t("editTitle")} description={part.name} />

      <PartPageForm
        mode="edit"
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
      />
    </main>
  );
}
