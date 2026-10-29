import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { NotFoundError } from "@/lib/errors";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { CustomerDetailPanel } from "@/modules/customers/components/customer-detail-panel";
import { getCustomer } from "@/modules/customers/service";
import { listCustomerServiceHistory } from "@/modules/service-orders/service";
import { listCustomerWarranties } from "@/modules/warranties/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function CustomerDetailPage({ params }: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("customers");

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const [serviceHistory, warrantyDocs] = await Promise.all([
    listCustomerServiceHistory(session, customer.id),
    listCustomerWarranties(session, customer.id).catch(() => []),
  ]);

  const canWrite =
    session.role === "OWNER" || session.role === "MANAGER";
  const canCreateOrder = canWrite;
  const canDeleteOrder = canWrite;
  const canWriteWarranty =
    canWrite || session.role === "ACCOUNTANT";

  return (
    <main className="w-full space-y-4">
      <Link
        href="/customers"
        className="hidden h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700 lg:inline-flex"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <CustomerDetailPanel
        customer={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          notes: customer.notes,
        }}
        vehicles={customer.vehicles.map((vehicle) => ({
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
          stateCode: vehicle.stateCode,
          year: vehicle.year,
          odometer: vehicle.odometer,
          insuranceExpiry: vehicle.insuranceExpiry,
          pucExpiry: vehicle.pucExpiry,
          fitnessExpiry: vehicle.fitnessExpiry,
        }))}
        serviceHistory={serviceHistory}
        warrantyDocs={warrantyDocs}
        canWrite={canWrite}
        canWriteWarranty={canWriteWarranty}
        canCreateOrder={canCreateOrder}
        canDeleteOrder={canDeleteOrder}
        locale={locale}
      />
    </main>
  );
}
