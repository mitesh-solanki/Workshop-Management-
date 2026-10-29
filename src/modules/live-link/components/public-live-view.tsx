import { getLocale, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupees } from "@/lib/money";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { cn } from "@/lib/utils";
import { LiveApproveButtons } from "@/modules/live-link/components/live-approve-buttons";
import { LiveMediaGallery } from "@/modules/live-link/components/live-media-gallery";
import { LivePayPanel } from "@/modules/live-link/components/live-pay-panel";
import type { PublicLiveView } from "@/modules/live-link/service";

type Props = {
  token: string;
  view: PublicLiveView;
  paidReturn?: boolean;
};

function approvalBadgeClass(state: string) {
  if (state === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (state === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export async function PublicLiveViewPanel({
  token,
  view,
  paidReturn,
}: Props) {
  const t = await getTranslations("liveLink");
  const to = await getTranslations("orders");
  const locale = await getLocale();

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 min-[360px]:px-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="space-y-2 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-sm font-medium text-blue-800">{view.garageName}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title text-slate-900">
              {view.vehicleRegistration}
            </h1>
            <StatusBadge
              status={view.status as ServiceOrderStatus}
              label={to(`statuses.${view.status as ServiceOrderStatus}`)}
            />
          </div>
          <p className="text-sm text-slate-600">{view.vehicleLabel}</p>
          {view.expectedCompletion ? (
            <p className="text-caption text-slate-500">
              {t("expectedCompletion", {
                when: new Date(view.expectedCompletion).toLocaleString(locale),
              })}
            </p>
          ) : null}
          {paidReturn ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {t("paymentReturnHint")}
            </p>
          ) : null}
        </header>

        <div className="flex flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
          <section className="space-y-3">
            <h2 className="text-section-title text-slate-900">
              {t("inspectionTitle")}
            </h2>
            {view.media.length === 0 ? (
              <p className="text-sm text-slate-500">{t("mediaEmpty")}</p>
            ) : (
              <LiveMediaGallery items={view.media} />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-section-title text-slate-900">
              {t("estimateTitle")}
            </h2>
            {!view.estimate || view.estimate.lines.length === 0 ? (
              <p className="text-sm text-slate-500">{t("estimateEmpty")}</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border border-slate-200 bg-white">
                {view.estimate.lines.map((line) => {
                  const showDecide =
                    view.estimate?.canCustomerApprove &&
                    line.approvalState === "PENDING";
                  return (
                    <li
                      key={line.id}
                      className="space-y-2 px-3 py-3.5 min-[400px]:px-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 text-sm font-medium text-slate-900">
                              {line.description}
                            </p>
                            <span
                              className={cn(
                                "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
                                approvalBadgeClass(line.approvalState),
                              )}
                            >
                              {t(`approval.${line.approvalState}`)}
                            </span>
                          </div>
                          <p className="text-caption tabular-nums text-slate-500">
                            {`${line.quantity} × ${formatRupees(line.unitPricePaise)} = ${formatRupees(line.lineTotalPaise)}`}
                          </p>
                        </div>
                        {showDecide ? (
                          <LiveApproveButtons token={token} lineId={line.id} />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-section-title text-slate-900">
              {t("invoiceTitle")}
            </h2>
            {!view.invoice ? (
              <p className="text-sm text-slate-500">{t("invoiceEmpty")}</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {view.invoice.invoiceNumber ?? t("invoiceDraft")}
                    </p>
                    <p className="text-caption text-slate-500">
                      {t("invoiceTotal")}:{" "}
                      {formatRupees(view.invoice.totalPaise)}
                    </p>
                  </div>
                  {view.invoice.paid ? (
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                      {t("paidBadge")}
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-1.5">
                  {view.invoice.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-start justify-between gap-3 text-sm text-slate-700"
                    >
                      <span className="min-w-0 break-words">
                        {line.description}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatRupees(line.totalPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
                <LivePayPanel
                  token={token}
                  invoiceId={view.invoice.id}
                  pendingPaise={view.invoice.pendingPaise}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
