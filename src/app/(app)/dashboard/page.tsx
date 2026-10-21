import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getGarageSettings } from "@/modules/settings/service";

export default async function DashboardPage() {
  const session = await requireSession();
  const garage = await getGarageSettings(session);
  const t = await getTranslations("dashboard");

  return (
    <main className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-base text-muted-foreground">
        {t("welcome", { garage: garage.name, role: session.role })}
      </p>
    </main>
  );
}
