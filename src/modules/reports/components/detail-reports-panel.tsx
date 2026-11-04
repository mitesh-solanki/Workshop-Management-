"use client";

import { useTranslations } from "next-intl";
import { DetailReportCard } from "@/modules/reports/components/detail-report-card";
import type { DetailReportsDashboard } from "@/modules/reports/detail-types";

type Props = {
  dashboard: DetailReportsDashboard;
  exportUserSlug: string;
};

export function DetailReportsPanel({ dashboard, exportUserSlug }: Props) {
  const t = useTranslations("reports");

  const cards = [
    dashboard.parts_stock,
    dashboard.stock_movements,
    dashboard.invoice_tax,
    dashboard.hsn,
  ] as const;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
          {t("detail.sectionTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t("detail.sectionSubtitle")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <DetailReportCard
            key={card.key}
            initialCard={card}
            exportUserSlug={exportUserSlug}
          />
        ))}
      </div>
    </section>
  );
}
