import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { PartPageForm } from "@/modules/inventory/components/part-page-form";

export const instant = false;

export default async function NewPartPage() {
  const session = await requireSession();
  const t = await getTranslations("inventory");

  try {
    requireRole(session, ["OWNER", "MANAGER"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="w-full space-y-6">
          <PageHeader title={t("newTitle")} />
          <EmptyState
            icon={ShieldAlert}
            title={t("forbidden")}
            action={
              <Link
                href="/inventory"
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

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href="/inventory"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />

      <PartPageForm mode="create" />
    </main>
  );
}
