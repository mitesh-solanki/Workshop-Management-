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
  const canEdit = session.role === "OWNER" || session.role === "MANAGER";

  return (
    <main className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <GarageSettingsForm
        key={`${garage.name}|${garage.address ?? ""}|${garage.gstin ?? ""}|${garage.allowNegativeStock}`}
        garage={garage}
        canEdit={canEdit}
      />
    </main>
  );
}
