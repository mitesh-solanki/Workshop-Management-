import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { getVehicle } from "@/modules/vehicles/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

/** Vehicle-scoped create redirects into the shared create page with vehicle preselected. */
export default async function NewServiceOrderFromVehiclePage({
  params,
}: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("orders");

  try {
    requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
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

  try {
    await getVehicle(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  redirect(`/orders/new?vehicleId=${encodeURIComponent(id)}`);
}
