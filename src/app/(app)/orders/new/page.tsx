import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { listBaysForSelect } from "@/modules/bays/service";
import { listCustomers } from "@/modules/customers/service";
import { NewJobCardForm } from "@/modules/service-orders/components/new-job-card-form";
import { listAssignableTechnicians } from "@/modules/service-orders/service";

type Props = {
  searchParams: Promise<{ vehicleId?: string }>;
};

export const instant = false;

export default async function NewJobCardPage({ searchParams }: Props) {
  const session = await requireSession();
  const { vehicleId: initialVehicleId } = await searchParams;
  const t = await getTranslations("orders");

  try {
    requireRole(session, ["OWNER", "MANAGER"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="w-full space-y-6">
          <PageHeader title={t("newTitle")} />
          <EmptyState
            icon={ShieldAlert}
            title={t("forbiddenCreate")}
            action={
              <Link
                href="/orders"
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

  const [{ items: customers }, technicians, bays] = await Promise.all([
    listCustomers(session, { pageSize: 50 }),
    listAssignableTechnicians(session),
    listBaysForSelect(session),
  ]);

  const vehicles = customers.flatMap((customer) =>
    customer.vehicles.map((vehicle) => ({
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      odometer: vehicle.odometer,
      customerName: customer.name,
    })),
  );

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href="/orders"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <PageHeader
        title={t("newTitle")}
        description={t("newSubtitleGeneric")}
      />

      {vehicles.length === 0 ? (
        <EmptyState
          title={t("noVehiclesTitle")}
          description={t("noVehiclesDescription")}
          action={
            <Link
              href="/customers"
              className="text-sm text-teal-700 underline-offset-4 hover:underline"
            >
              {t("goToCustomers")}
            </Link>
          }
        />
      ) : (
        <NewJobCardForm
          vehicles={vehicles}
          technicians={technicians}
          bays={bays}
          initialVehicleId={initialVehicleId?.trim() ?? ""}
        />
      )}
    </main>
  );
}
