import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";

export default async function OrdersPage() {
  await requireSession();
  const t = await getTranslations("orders");

  return (
    <main className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-base text-muted-foreground">{t("empty")}</p>
    </main>
  );
}
