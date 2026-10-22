import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";

export const instant = false;

export default async function OrdersPage() {
  await requireSession();
  const t = await getTranslations("orders");

  return (
    <main className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EmptyState
        icon={ClipboardList}
        title={t("emptyTitle")}
        description={t("empty")}
      />
    </main>
  );
}
