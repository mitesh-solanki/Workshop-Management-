import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { JobSlipsBoard } from "@/modules/job-slips/components/job-slips-board";
import { toJobSlipCardData } from "@/modules/job-slips/to-job-slip-card";
import { listJobSlips } from "@/modules/job-slips/service";
import { getGarageSettings } from "@/modules/settings/service";

export const instant = false;

export default async function JobSlipsPage() {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }

  const t = await getTranslations("jobSlips");
  const [orders, garage] = await Promise.all([
    listJobSlips(session),
    getGarageSettings(session),
  ]);

  const slips = orders.map((order) =>
    toJobSlipCardData(order, {
      name: garage.name,
      address: garage.address,
    }),
  );

  return (
    <main className="space-y-4 sm:space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <JobSlipsBoard slips={slips} />
    </main>
  );
}
