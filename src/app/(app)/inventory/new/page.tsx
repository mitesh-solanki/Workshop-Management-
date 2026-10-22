import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { PartForm } from "@/modules/inventory/components/part-form";

export default async function NewPartPage() {
  const session = await requireSession();
  requireRole(session, ["OWNER", "MANAGER"]);
  const t = await getTranslations("inventory");

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/inventory"
          className="text-sm text-muted-foreground underline"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="text-base text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <PartForm mode="create" />
    </main>
  );
}
