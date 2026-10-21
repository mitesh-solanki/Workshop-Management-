import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { DeleteCustomerButton } from "@/modules/customers/components/delete-customer-button";
import { getCustomer } from "@/modules/customers/service";
import { DeleteVehicleButton } from "@/modules/vehicles/components/delete-vehicle-button";
import { listCustomerServiceHistory } from "@/modules/service-orders/service";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(value: Date | null, empty: string) {
  if (!value) {
    return empty;
  }
  return value.toLocaleDateString();
}

export default async function CustomerDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("customers");
  const tv = await getTranslations("vehicles");
  const to = await getTranslations("orders");

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  let serviceHistory: Awaited<ReturnType<typeof listCustomerServiceHistory>>;
  try {
    customer = await getCustomer(session, id);
    serviceHistory = await listCustomerServiceHistory(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";
  const canCreateOrder =
    session.role === "OWNER" || session.role === "MANAGER";

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <Link href="/customers" className="text-sm text-muted-foreground underline">
          {t("back")}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {customer.name}
            </h1>
            <p className="text-base text-muted-foreground">{customer.phone}</p>
          </div>
          {canWrite && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Link
                href={`/customers/${customer.id}/edit`}
                className="inline-flex min-h-12 items-center justify-center rounded-md border px-4 text-base font-medium"
              >
                {t("edit")}
              </Link>
              <DeleteCustomerButton customerId={customer.id} />
            </div>
          )}
        </div>
        {customer.address && (
          <p className="text-sm text-muted-foreground">{customer.address}</p>
        )}
        {customer.notes && (
          <p className="rounded-md bg-secondary/60 p-3 text-sm">{customer.notes}</p>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{t("vehicles")}</h2>
          {canWrite && (
            <Link
              href={`/customers/${customer.id}/vehicles/new`}
              className="inline-flex min-h-12 items-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground"
            >
              {tv("add")}
            </Link>
          )}
        </div>
        {customer.vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noVehicles")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {customer.vehicles.map((vehicle) => (
              <li
                key={vehicle.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{vehicle.registrationNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.make} {vehicle.model}
                    {vehicle.year ? ` · ${vehicle.year}` : ""}
                    {vehicle.odometer != null
                      ? ` · ${vehicle.odometer} ${tv("km")}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tv("insuranceExpiry")}:{" "}
                    {formatDate(vehicle.insuranceExpiry, t("notSet"))}
                    {" · "}
                    {tv("pucExpiry")}: {formatDate(vehicle.pucExpiry, t("notSet"))}
                    {" · "}
                    {tv("fitnessExpiry")}:{" "}
                    {formatDate(vehicle.fitnessExpiry, t("notSet"))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {canCreateOrder && (
                    <Link
                      href={`/vehicles/${vehicle.id}/orders/new`}
                      className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                      {to("createShort")}
                    </Link>
                  )}
                  {canWrite && (
                    <>
                      <Link
                        href={`/vehicles/${vehicle.id}/edit`}
                        className="inline-flex min-h-12 items-center justify-center rounded-md border px-4 text-sm font-medium"
                      >
                        {tv("edit")}
                      </Link>
                      <DeleteVehicleButton
                        vehicleId={vehicle.id}
                        customerId={customer.id}
                        className="text-sm"
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("serviceHistory")}</h2>
        {serviceHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("serviceHistoryEmpty")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {serviceHistory.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex min-h-14 flex-col gap-1 px-3 py-3 hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {order.vehicle.registrationNumber}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {to(`statuses.${order.status}`)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {order.complaint}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.createdAt.toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t("communicationHistory")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("communicationHistoryPlaceholder")}
        </p>
      </section>
    </main>
  );
}
