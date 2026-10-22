import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { computeLineGst } from "@/lib/gst";
import { formatRupees } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { CreateEstimateForm } from "@/modules/estimates/components/create-estimate-form";
import { EstimateLineForm } from "@/modules/estimates/components/estimate-line-form";
import { LineApprovalForm } from "@/modules/estimates/components/line-approval-form";
import { getEstimateForOrder } from "@/modules/estimates/service";
import type {
  EstimateApprovalMethodValue,
  EstimateApprovalStateValue,
  EstimateLineTypeValue,
} from "@/modules/estimates/schema";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderEstimatePage({ params }: Props) {
  const session = await requireSession();
  const { id: orderId } = await params;
  const t = await getTranslations("estimates");
  const to = await getTranslations("orders");

  let data: Awaited<ReturnType<typeof getEstimateForOrder>>;
  try {
    data = await getEstimateForOrder(session, orderId);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const { order, current, revisions } = data;

  const canEdit =
    (session.role === "OWNER" ||
      session.role === "MANAGER" ||
      (session.role === "TECHNICIAN" &&
        order.technicianId === session.userId)) &&
    order.status !== "COMPLETED";

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <Link
          href={`/orders/${orderId}`}
          className="text-sm text-muted-foreground underline"
        >
          {t("backToOrder")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">
          {order.vehicle.registrationNumber} · {order.customer.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {to(`statuses.${order.status}`)}
        </p>
      </div>

      {!current ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
          {canEdit ? (
            <CreateEstimateForm orderId={orderId} mode="create" />
          ) : (
            <p className="text-sm text-muted-foreground">{t("emptyReadOnly")}</p>
          )}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium">
                {t("revisionLabel", { number: current.revisionNumber })}
              </h2>
              <span className="text-sm text-muted-foreground">
                {t("currentRevision")}
              </span>
            </div>
            {current.notes && (
              <p className="whitespace-pre-wrap text-sm">{current.notes}</p>
            )}

            {current.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("linesEmpty")}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {current.lines.map((line) => {
                  const amounts = computeLineGst(line);
                  return (
                    <li key={line.id} className="space-y-3 px-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium">{line.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {t(`lineTypes.${line.type as EstimateLineTypeValue}`)}{" "}
                            · {t("hsnOrSac")}: {line.hsnOrSac} · {t("gstRate")}:{" "}
                            {line.gstRatePercent}%
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {line.quantity} × {formatRupees(line.unitPricePaise)}{" "}
                            = {formatRupees(amounts.taxablePaise)} +{" "}
                            {t("gstShort")} {formatRupees(amounts.gstPaise)} ={" "}
                            {formatRupees(amounts.totalPaise)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium">
                          {t(
                            `approvalStates.${line.approvalState as EstimateApprovalStateValue}`,
                          )}
                        </span>
                      </div>
                      {canEdit && (
                        <LineApprovalForm
                          orderId={orderId}
                          lineId={line.id}
                          currentState={line.approvalState}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-md border p-4">
            <h2 className="text-lg font-medium">{t("totals")}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("totalsAll")}</dt>
                <dd className="font-medium">
                  {formatRupees(current.totals.all.totalPaise)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("totalsApproved")}</dt>
                <dd>
                  {formatRupees(current.totals.approved.totalPaise)}
                  <span className="text-muted-foreground">
                    {" "}
                    ({t("taxable")}{" "}
                    {formatRupees(current.totals.approved.taxablePaise)} +{" "}
                    {t("gstShort")}{" "}
                    {formatRupees(current.totals.approved.gstPaise)})
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("totalsPending")}</dt>
                <dd>{formatRupees(current.totals.pending.totalPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("totalsRejected")}</dt>
                <dd>{formatRupees(current.totals.rejected.totalPaise)}</dd>
              </div>
            </dl>
          </section>

          {canEdit && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium">{t("addLineTitle")}</h2>
              <EstimateLineForm orderId={orderId} />
            </section>
          )}

          {canEdit && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium">{t("reviseTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("reviseHint")}</p>
              <CreateEstimateForm
                orderId={orderId}
                mode="revision"
                nextRevision={current.revisionNumber + 1}
              />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-medium">{t("approvalHistory")}</h2>
            {current.approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("approvalHistoryEmpty")}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {current.approvals.map((entry) => {
                  const line = current.lines.find((l) => {
                    return l.id === entry.estimateLineId;
                  });
                  const actor =
                    entry.recordedBy?.name?.trim() ||
                    entry.recordedBy?.email ||
                    t("unknownActor");
                  return (
                    <li key={entry.id} className="space-y-1 px-3 py-3 text-sm">
                      <p className="font-medium">
                        {line?.description ?? t("lineDescription")}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.fromState
                          ? t("historyChange", {
                              from: t(
                                `approvalStates.${entry.fromState as EstimateApprovalStateValue}`,
                              ),
                              to: t(
                                `approvalStates.${entry.toState as EstimateApprovalStateValue}`,
                              ),
                            })
                          : t(
                              `approvalStates.${entry.toState as EstimateApprovalStateValue}`,
                            )}{" "}
                        ·{" "}
                        {t(
                          `approvalMethods.${entry.method as EstimateApprovalMethodValue}`,
                        )}{" "}
                        · {actor}
                      </p>
                      {entry.note && (
                        <p className="text-muted-foreground">{entry.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {entry.createdAt.toLocaleString()}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {revisions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{t("revisionHistory")}</h2>
          <ul className="divide-y rounded-md border">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {t("revisionLabel", { number: rev.revisionNumber })}
                    {rev.supersededAt == null
                      ? ` · ${t("currentRevision")}`
                      : ` · ${t("superseded")}`}
                  </p>
                  <p className="text-muted-foreground">
                    {t("lineCount", { count: rev._count.lines })} ·{" "}
                    {rev.createdAt.toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
