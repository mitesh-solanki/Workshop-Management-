import { getTranslations } from "next-intl/server";
import { computeLineGst } from "@/lib/gst";
import { formatRupees } from "@/lib/money";
import { CreateEstimateForm } from "@/modules/estimates/components/create-estimate-form";
import { EstimateLineForm } from "@/modules/estimates/components/estimate-line-form";
import { LineApprovalForm } from "@/modules/estimates/components/line-approval-form";
import type {
  EstimateApprovalMethodValue,
  EstimateApprovalStateValue,
  EstimateLineTypeValue,
} from "@/modules/estimates/schema";
import type { getEstimateForOrder } from "@/modules/estimates/service";

type EstimateData = Awaited<ReturnType<typeof getEstimateForOrder>>;

type Props = {
  orderId: string;
  canEdit: boolean;
  data: EstimateData;
};

export async function JobCardEstimateContent({
  orderId,
  canEdit,
  data,
}: Props) {
  const t = await getTranslations("estimates");
  const { current, revisions } = data;

  return (
    <div className="space-y-5 px-5 py-4 sm:px-6">
      {!current ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-600">
            {canEdit ? t("emptyHint") : t("emptyReadOnly")}
          </p>
          {canEdit ? (
            <CreateEstimateForm orderId={orderId} mode="create" />
          ) : null}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {t("revisionLabel", { number: current.revisionNumber })}
                <span className="ml-2 text-caption font-normal text-slate-500">
                  {t("currentRevision")}
                </span>
              </p>
            </div>
            {current.notes ? (
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {current.notes}
              </p>
            ) : null}

            {current.lines.length === 0 ? (
              <p className="text-sm text-slate-600">{t("linesEmpty")}</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-lg border border-slate-200">
                {current.lines.map((line) => {
                  const amounts = computeLineGst(line);
                  return (
                    <li key={line.id} className="space-y-2.5 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium text-slate-900">
                            {line.description}
                          </p>
                          <p className="text-caption text-slate-500">
                            {`${t(`lineTypes.${line.type as EstimateLineTypeValue}`)} · ${line.quantity} × ${formatRupees(line.unitPricePaise)} · ${formatRupees(amounts.totalPaise)}`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {t(
                            `approvalStates.${line.approvalState as EstimateApprovalStateValue}`,
                          )}
                        </span>
                      </div>
                      {canEdit ? (
                        <LineApprovalForm
                          orderId={orderId}
                          lineId={line.id}
                          currentState={line.approvalState}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-caption text-slate-500">{t("totalsAll")}</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatRupees(current.totals.all.totalPaise)}
              </p>
            </div>
            <div>
              <p className="text-caption text-slate-500">{t("totalsApproved")}</p>
              <p className="text-sm font-semibold text-emerald-700">
                {formatRupees(current.totals.approved.totalPaise)}
              </p>
            </div>
            <div>
              <p className="text-caption text-slate-500">{t("totalsPending")}</p>
              <p className="text-sm font-semibold text-amber-700">
                {formatRupees(current.totals.pending.totalPaise)}
              </p>
            </div>
            <div>
              <p className="text-caption text-slate-500">{t("totalsRejected")}</p>
              <p className="text-sm font-semibold text-slate-700">
                {formatRupees(current.totals.rejected.totalPaise)}
              </p>
            </div>
          </section>

          {canEdit ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-slate-800">
                {t("addLineTitle")}
              </p>
              <EstimateLineForm orderId={orderId} />
            </section>
          ) : null}

          {canEdit ? (
            <section className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">
                {t("reviseTitle")}
              </p>
              <p className="text-caption text-slate-600">{t("reviseHint")}</p>
              <CreateEstimateForm
                orderId={orderId}
                mode="revision"
                nextRevision={current.revisionNumber + 1}
              />
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-800">
              {t("approvalHistory")}
            </p>
            {current.approvals.length === 0 ? (
              <p className="text-sm text-slate-600">
                {t("approvalHistoryEmpty")}
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-lg border border-slate-200">
                {current.approvals.map((entry) => {
                  const line = current.lines.find(
                    (candidate) => candidate.id === entry.estimateLineId,
                  );
                  const actor =
                    entry.recordedBy?.name?.trim() ||
                    entry.recordedBy?.email ||
                    t("unknownActor");
                  return (
                    <li key={entry.id} className="space-y-0.5 px-3 py-2.5 text-sm">
                      <p className="font-medium text-slate-900">
                        {line?.description ?? t("lineDescription")}
                      </p>
                      <p className="text-caption text-slate-600">
                        {`${
                          entry.fromState
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
                              )
                        } · ${t(
                          `approvalMethods.${entry.method as EstimateApprovalMethodValue}`,
                        )} · ${actor}`}
                      </p>
                      {entry.note ? (
                        <p className="text-caption text-slate-600">{entry.note}</p>
                      ) : null}
                      <p className="text-[11px] text-slate-400">
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

      {revisions.length > 0 ? (
        <section className="space-y-2">
          <p className="text-sm font-medium text-slate-800">
            {t("revisionHistory")}
          </p>
          <ul className="divide-y overflow-hidden rounded-lg border border-slate-200">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {t("revisionLabel", { number: rev.revisionNumber })}
                    {rev.supersededAt == null
                      ? ` · ${t("currentRevision")}`
                      : ` · ${t("superseded")}`}
                  </p>
                  <p className="text-caption text-slate-500">
                    {`${t("lineCount", { count: rev._count.lines })} · ${rev.createdAt.toLocaleString()}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
