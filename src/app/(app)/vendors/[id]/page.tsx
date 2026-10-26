import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listParts } from "@/modules/inventory/service";
import {
  canWritePurchaseOps,
  canWriteVendorMoney,
  getOpenPartsRequests,
} from "@/modules/purchases/service";
import { VendorDetailPanel } from "@/modules/vendors/components/vendor-detail-panel";
import {
  VENDOR_SECTIONS,
  type VendorSection,
} from "@/modules/vendors/vendor-sections";
import {
  assertCanAccessVendors,
  canWriteVendors,
  getVendor,
} from "@/modules/vendors/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
};

function parseVendorSection(value: string | undefined): VendorSection {
  if (value && (VENDOR_SECTIONS as readonly string[]).includes(value)) {
    return value as VendorSection;
  }
  return "details";
}

export const instant = false;

export default async function VendorDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await requireSession();
  const { id } = await params;
  const { section } = await searchParams;
  const initialSection = parseVendorSection(section);
  const t = await getTranslations("vendors");

  try {
    assertCanAccessVendors(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={Truck}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  let vendor: Awaited<ReturnType<typeof getVendor>>;
  try {
    vendor = await getVendor(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const canCreatePurchaseOrder = canWritePurchaseOps(session);
  const canCreateBill = canWriteVendorMoney(session);

  const [openRequests, parts] = await Promise.all([
    canCreatePurchaseOrder
      ? getOpenPartsRequests(session)
      : Promise.resolve([]),
    canCreatePurchaseOrder || canCreateBill
      ? listParts(session)
      : Promise.resolve([]),
  ]);

  return (
    <main className="w-full space-y-4">
      <Link
        href="/vendors"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <VendorDetailPanel
        vendor={{
          id: vendor.id,
          name: vendor.name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          gstin: vendor.gstin,
          notes: vendor.notes,
        }}
        outstandingPaise={vendor.outstandingPaise}
        purchaseOrders={vendor.purchaseOrders}
        bills={vendor.vendorBills}
        returns={vendor.purchaseReturns}
        openRequests={openRequests}
        parts={parts.map((part) => ({
          id: part.id,
          name: part.name,
          sku: part.sku,
          unit: part.unit,
        }))}
        canWrite={canWriteVendors(session)}
        canCreatePurchaseOrder={canCreatePurchaseOrder}
        canCreateBill={canCreateBill}
        initialSection={initialSection}
      />
    </main>
  );
}
