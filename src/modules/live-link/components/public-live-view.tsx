import { getLocale, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupees } from "@/lib/money";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { LiveApproveButtons } from "@/modules/live-link/components/live-approve-buttons";
import { LivePayPanel } from "@/modules/live-link/components/live-pay-panel";
import type { PublicLiveView } from "@/modules/live-link/service";

type Props = {
  token: string;
  view: PublicLiveView;
  paidReturn?: boolean;
};

export async function PublicLiveViewPanel({
  token,
  view,
  paidReturn,
}: Props) {
  const t = await getTranslations("liveLink");
  const to = await getTranslations("orders");
  const locale = await getLocale();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2 border-b border-border pb-4">
        <p className="text-sm font-medium text-teal-800">{view.garageName}</p>
        <h1 className="text-page-title text-slate-900">
          {view.vehicleRegistration}
        </h1>
        <p className="text-sm text-slate-600">{view.vehicleLabel}</p>
        <StatusBadge
          status={view.status as ServiceOrderStatus}
          label={to(`statuses.${view.status as ServiceOrderStatus}`)}
        />
        {view.expectedCompletion ? (
          <p className="text-caption text-slate-500">
            {t("expectedCompletion", {
              when: new Date(view.expectedCompletion).toLocaleString(locale),
            })}
          </p>
        ) : null}
        {paidReturn ? (
          <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
            {t("paymentReturnHint")}
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-section-title text-slate-900">{t("inspectionTitle")}</h2>
        {view.media.length === 0 ? (
          <p className="text-sm text-slate-500">{t("mediaEmpty")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {view.media.map((m) => (
              <li
                key={m.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                {m.kind === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.itemLabel}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <video
                    src={m.url}
                    controls
                    className="aspect-square w-full object-cover"
                  />
                )}
                <p className="truncate px-2 py-1 text-caption text-slate-600">
                  {m.itemLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-section-title text-slate-900">{t("estimateTitle")}</h2>
        {!view.estimate || view.estimate.lines.length === 0 ? (
          <p className="text-sm text-slate-500">{t("estimateEmpty")}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border border-slate-200">
            {view.estimate.lines.map((line) => (
              <li key={line.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {line.description}
                    </p>
                    <p className="text-caption text-slate-500">
                      {`${line.quantity} × ${formatRupees(line.unitPricePaise)} = ${formatRupees(line.lineTotalPaise)}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {t(`approval.${line.approvalState}`)}
                  </span>
                </div>
                {line.approvalState === "PENDING" ? (
                  <LiveApproveButtons token={token} lineId={line.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-section-title text-slate-900">{t("invoiceTitle")}</h2>
        {!view.invoice ? (
          <p className="text-sm text-slate-500">{t("invoiceEmpty")}</p>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {view.invoice.invoiceNumber ?? t("invoiceDraft")}
                </p>
                <p className="text-caption text-slate-500">
                  {t("invoiceTotal")}: {formatRupees(view.invoice.totalPaise)}
                </p>
              </div>
              {view.invoice.paid ? (
                <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
                  {t("paidBadge")}
                </span>
              ) : null}
            </div>
            <ul className="space-y-1">
              {view.invoice.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex justify-between gap-2 text-sm text-slate-700"
                >
                  <span className="min-w-0 truncate">{line.description}</span>
                  <span className="shrink-0">
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
  );
}
