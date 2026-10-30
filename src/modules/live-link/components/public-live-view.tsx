import { getLocale, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupees, type Paise } from "@/lib/money";
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
  const ti = await getTranslations("inspections");
  const to = await getTranslations("orders");
  const locale = await getLocale();

  const estimateLines = view.estimate?.lines ?? [];
  const grandTotal = estimateLines.reduce(
    (sum, line) => sum + line.lineTotalPaise,
    0,
  );
  const documentTitle =
    view.kind === "inspection" ? ti("reportTitle") : t("estimateTitle");

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 min-[360px]:px-4 sm:px-6 sm:py-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="space-y-4 border-b border-slate-200 bg-slate-50/80 px-4 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
          <div>
            <p className="text-[20px] font-bold text-blue-800 sm:text-[22px]">
              {view.garageName}
            </p>
            <h1 className="mt-4 text-[17px] font-semibold text-slate-900">
              {documentTitle}
            </h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {ti("reportNameLabel")}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-slate-900">
                {view.customerName}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {ti("selectVehicle")}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-slate-900">
                  {view.vehicleRegistration}
                  {view.vehicleLabel ? ` · ${view.vehicleLabel}` : ""}
                </p>
                {view.status ? (
                  <StatusBadge
                    status={view.status as ServiceOrderStatus}
                    label={to(`statuses.${view.status as ServiceOrderStatus}`)}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {view.complaint ? (
              <div>
                <p className="text-[12px] font-medium text-slate-500">
                  {ti("complaint")}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[15px] font-semibold text-slate-900">
                  {view.complaint}
                </p>
              </div>
            ) : (
              <div />
            )}
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {t("dateLabel")}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-slate-900">
                {new Date(view.date).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {view.recommendedNotes ? (
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {ti("recommendedNotes")}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[15px] font-semibold text-slate-900">
                {view.recommendedNotes}
              </p>
            </div>
          ) : null}

          {view.expectedCompletion ? (
            <p className="text-caption text-slate-500">
              {t("expectedCompletion", {
                when: new Date(view.expectedCompletion).toLocaleString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </p>
          ) : null}

          {paidReturn ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {t("paymentReturnHint")}
            </p>
          ) : null}
        </header>

        <div className="flex flex-col gap-6 p-4 sm:gap-7 sm:p-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900">
                {t("estimateTitle")}
              </h2>
              {estimateLines.length > 0 ? (
                <p className="text-[14px] font-semibold text-blue-700">
                  {ti("reportGrandTotal", {
                    amount: formatRupees(grandTotal as Paise),
                  })}
                </p>
              ) : null}
            </div>

            {!view.estimate || estimateLines.length === 0 ? (
              <p className="text-sm text-slate-500">{t("estimateEmpty")}</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border border-slate-200 bg-white">
                {estimateLines.map((line) => {
                  const showDecide =
                    view.estimate?.canCustomerApprove &&
                    line.approvalState === "PENDING";
                  return (
                    <li
                      key={line.id}
                      className="flex flex-col gap-3 px-3 py-3.5 min-[400px]:px-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 text-[15px] font-semibold text-slate-900">
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
                        <p className="text-[13px] tabular-nums text-slate-600">
                          {`${line.quantity} × ${formatRupees(line.unitPricePaise)} = `}
                          <span className="font-semibold text-slate-900">
                            {formatRupees(line.lineTotalPaise)}
                          </span>
                        </p>
                      </div>
                      {showDecide ? (
                        <LiveApproveButtons token={token} lineId={line.id} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {view.media.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold text-slate-900">
                {t("inspectionTitle")}
              </h2>
              <LiveMediaGallery items={view.media} />
            </section>
          ) : null}

          {view.kind !== "inspection" ? (
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold text-slate-900">
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
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
          <p className="text-[12px] font-medium text-red-600">
            {ti("reportSuggestionLabel")}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
            {view.kind === "inspection"
              ? ti("reportClosingNote")
              : t("orderClosingNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
