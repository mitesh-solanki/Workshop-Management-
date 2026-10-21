import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { CustomerForm } from "@/modules/customers/components/customer-form";

export default async function NewCustomerPage() {
  const session = await requireSession();
  const t = await getTranslations("customers");

  try {
    requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("newTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("forbidden")}</p>
          <Link href="/customers" className="text-sm underline">
            {t("back")}
          </Link>
        </main>
      );
    }
    throw error;
  }

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link href="/customers" className="text-sm text-muted-foreground underline">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="text-base text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <CustomerForm mode="create" />
    </main>
  );
}
