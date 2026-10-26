import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";
import { GarageSettingsForm } from "@/modules/settings/components/garage-settings-form";
import { getGarageSettings } from "@/modules/settings/service";

export const instant = false;

export default async function SettingsPage() {
  const session = await requireSession();
  const garage = await getGarageSettings(session);
  const t = await getTranslations("settings");
  const tImport = await getTranslations("dataImport");
  const canEdit = session.role === "OWNER" || session.role === "MANAGER";

  return (
    <main className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {/* {canEdit ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {tImport("settingsCardTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {tImport("settingsCardDescription")}
          </p>
          <Link
            href="/settings/import"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
          >
            {tImport("openImport")}
          </Link>
        </section>
      ) : null} */}
      <GarageSettingsForm
        key={`${garage.name}|${garage.address ?? ""}|${garage.gstin ?? ""}`}
        garage={garage}
        canEdit={canEdit}
      />
    </main>
  );
}
