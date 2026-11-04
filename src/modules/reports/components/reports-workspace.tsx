"use client";

import { DetailReportsPanel } from "@/modules/reports/components/detail-reports-panel";
import { ReportCard } from "@/modules/reports/components/report-card";
import type { DetailReportsDashboard } from "@/modules/reports/detail-types";
import { toMoneyReportCardState } from "@/modules/reports/money-card-state";
import type { ReportsDashboard } from "@/modules/reports/service";

type Props = {
  dashboard: ReportsDashboard;
  detailDashboard: DetailReportsDashboard;
  exportUserSlug: string;
};

export function ReportsWorkspace({
  dashboard,
  detailDashboard,
  exportUserSlug,
}: Props) {
  const cards = [
    toMoneyReportCardState(dashboard.sales),
    toMoneyReportCardState(dashboard.payments),
    toMoneyReportCardState(dashboard.outstanding),
    toMoneyReportCardState(dashboard.creditNotes),
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <ReportCard
            key={card.key}
            initialCard={card}
            exportUserSlug={exportUserSlug}
            garageGstin={detailDashboard.parts_stock.garage.gstin}
          />
        ))}
      </div>

      <DetailReportsPanel
        dashboard={detailDashboard}
        exportUserSlug={exportUserSlug}
      />
    </div>
  );
}
