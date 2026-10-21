import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { GarageSettingsForm } from "@/modules/settings/components/garage-settings-form";
import { getGarageSettings } from "@/modules/settings/service";

export default async function SettingsPage() {
  const session = await requireSession();
  const garage = await getGarageSettings(session);
  const t = await getTranslations("settings");
  const canEdit = session.role === "OWNER" || session.role === "MANAGER";

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </div>
      <GarageSettingsForm garage={garage} canEdit={canEdit} />
    </main>
  );
}
