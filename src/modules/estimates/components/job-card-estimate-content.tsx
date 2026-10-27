import { getTranslations } from "next-intl/server";
import { computeLineGst } from "@/lib/gst";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CreateEstimateForm } from "@/modules/estimates/components/create-estimate-form";
import { EstimateLineForm } from "@/modules/estimates/components/estimate-line-form";
import {
  EstimatePermissionLine,
  SmoothHistoryPanel,
} from "@/modules/estimates/components/estimate-permission-line";
import type {
  EstimateApprovalMethodValue,
  EstimateApprovalStateValue,
} from "@/modules/estimates/schema";
import type { getEstimateForOrder } from "@/modules/estimates/service";
import { LiveLinkStaffPanel } from "@/modules/live-link/components/live-link-staff-panel";

type EstimateData = Awaited<ReturnType<typeof getEstimateForOrder>>;

type Props = {
  orderId: string;
  canEdit: boolean;
  data: EstimateData;
  liveLinkActive: { id: string; expiresAt: Date | string } | null;
  canEditLiveLink: boolean;
};

export async function JobCardEstimateContent({
  orderId,
  canEdit,
  data,
  liveLinkActive,
  canEditLiveLink,
}: Props) {
  const t = await getTranslations("estimates");
  const { current, revisions, order } = data;
  const previewLines = order.lines;

  const approvedCount =
    current?.lines.filter((line) => line.approvalState === "APPROVED").length ??
    0;
  const pendingCount =
    current?.lines.filter((line) => line.approvalState === "PENDING").length ??
    0;

  return (
    <div className="space-y-5">
      {!current ? (
        <section className="space-y-5">
          <div className="rounded-[11px] border border-[#c9d8ff] bg-[#edf4ff]/70 px-4 py-4">
            <h3 className="text-[15px] font-semibold text-slate-900">
              {t("emptyTitle")}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {canEdit ? t("emptyHint") : t("emptyReadOnly")}
            </p>

            <div className="mt-4">
              <p className="text-[13px] font-semibold text-slate-800">
                {t("emptyPreviewTitle")}
              </p>
              {previewLines.length === 0 ? (
                <p className="mt-2 rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-[13px] text-slate-600">
                  {t("emptyPreviewEmpty")}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-200/80 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                  {previewLines.map((line) => {
                    const typeKey =
                      line.type === "PART" || line.type === "LABOUR"
                        ? line.type
                        : "LABOUR";
                    const lineTotal = multiplyByQuantity(
                      line.unitPricePaise,
                      line.quantity,
                    );
                    return (
                      <li
                        key={line.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-3"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                              typeKey === "PART"
                                ? "border-blue-200 bg-blue-50 text-blue-800"
                                : "border-orange-200 bg-orange-50 text-orange-800",
                            )}
                          >
                            {t(`lineTypes.${typeKey}`)}
                          </span>
                          <p className="truncate text-[14px] font-medium text-slate-900">
                            {line.description}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[12px] tabular-nums text-slate-500">
                            {t("emptyPreviewQtyPrice", {
                              quantity: line.quantity,
                              price: formatRupees(line.unitPricePaise),
                            })}
                          </p>
                          <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                            {formatRupees(lineTotal)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          {canEdit && previewLines.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-slate-800">
                {t("emptyCreateLead")}
              </p>
              <CreateEstimateForm orderId={orderId} mode="create" />
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <LiveLinkStaffPanel
            orderId={orderId}
            active={liveLinkActive}
            canEdit={canEditLiveLink}
            variant="embed"
          />

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="rounded-[11px] border border-slate-300 bg-blue-50/70 px-4 py-3.5">
              <strong className="text-[13px] font-semibold text-slate-900">
                {t("permissionHowTitle")}
              </strong>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                {t("permissionHowBody")}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-extrabold whitespace-nowrap text-emerald-800">
              {t("permissionCount", {
                agreed: approvedCount,
                waiting: pendingCount,
              })}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-[13px] text-slate-600">
            <span>
              <i className="mr-1.5 inline-block size-2 rounded-full bg-emerald-600" />
              {t("permissionLegendAgreed")}
            </span>
            <span>
              <i className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" />
              {t("permissionLegendWaiting")}
            </span>
            <span>
              <i className="mr-1.5 inline-block size-2 rounded-full bg-red-500" />
              {t("permissionLegendRejected")}
            </span>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-slate-900">
                {t("permissionListTitle")}
              </h3>
              <p className="text-[12px] text-slate-500">
                {t("revisionLabel", { number: current.revisionNumber })}
                <span className="ml-1 text-slate-400">
                  · {t("currentRevision")}
                </span>
              </p>
            </div>

            {current.lines.length === 0 ? (
              <p className="text-sm text-slate-600">{t("linesEmpty")}</p>
            ) : (
              <ul className="grid gap-3">
                {current.lines.map((line, index) => {
                  const amounts = computeLineGst(line);
                  const linkedPartId =
                    line.sourceOrderLineId != null
                      ? (order.lines.find(
                          (orderLine) => orderLine.id === line.sourceOrderLineId,
                        )?.partId ?? null)
                      : null;
                  return (
                    <EstimatePermissionLine
                      key={line.id}
                      orderId={orderId}
                      canEdit={canEdit}
                      index={index}
                      line={{
                        id: line.id,
                        description: line.description,
                        type: line.type,
                        quantity: line.quantity,
                        unitPricePaise: line.unitPricePaise,
                        hsnOrSac: line.hsnOrSac,
                        gstRatePercent: line.gstRatePercent,
                        approvalState: line.approvalState,
                        totalPaise: amounts.totalPaise,
                        partId: linkedPartId,
                      }}
                    />
                  );
                })}
              </ul>
            )}
          </div>

          <section className="overflow-hidden rounded-[11px] border border-slate-300">
            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-b border-slate-300 bg-slate-50/80 px-4 py-3.5 sm:border-r lg:border-b-0">
                <p className="text-[13px] text-slate-500">{t("totalsAll")}</p>
                <p className="mt-1 text-[15px] font-semibold text-slate-900">
                  {formatRupees(current.totals.all.totalPaise)}
                </p>
              </div>
              <div className="border-b border-slate-300 bg-slate-50/80 px-4 py-3.5 sm:border-r-0 lg:border-r lg:border-b-0">
                <p className="text-[13px] text-slate-500">
                  {t("totalsApproved")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-emerald-700">
                  {formatRupees(current.totals.approved.totalPaise)}
                </p>
              </div>
              <div className="border-b border-slate-300 bg-slate-50/80 px-4 py-3.5 sm:border-r sm:border-b-0 lg:border-b-0">
                <p className="text-[13px] text-slate-500">
                  {t("totalsPending")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-amber-700">
                  {formatRupees(current.totals.pending.totalPaise)}
                </p>
              </div>
              <div className="bg-blue-50 px-4 py-3.5">
                <p className="text-[13px] text-slate-500">
                  {t("totalsRejected")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-slate-800">
                  {formatRupees(current.totals.rejected.totalPaise)}
                </p>
              </div>
            </div>
          </section>

          {canEdit ? (
            <div className="space-y-3 border-t border-slate-300 pt-5">
              <EstimateLineForm orderId={orderId} />
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-950">
                {t("excludedFromBillNote")}
              </p>
            </div>
          ) : current.totals.pending.totalPaise > 0 ||
            current.totals.rejected.totalPaise > 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-950">
              {t("excludedFromBillNote")}
            </p>
          ) : null}

          {canEdit ? (
            <section className="space-y-2 rounded-[10px] border border-dashed border-slate-300 p-4">
              <p className="text-sm font-medium text-slate-800">
                {t("reviseTitle")}
              </p>
              <p className="text-[12px] text-slate-600">{t("reviseHint")}</p>
              <CreateEstimateForm
                orderId={orderId}
                mode="revision"
                nextRevision={current.revisionNumber + 1}
              />
            </section>
          ) : null}

          <SmoothHistoryPanel title={t("approvalHistory")} hint={t("seeEarlier")}>
            {current.approvals.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-600">
                {t("approvalHistoryEmpty")}
              </p>
            ) : (
              <ul>
                {current.approvals.map((entry) => {
                  const line = current.lines.find(
                    (candidate) => candidate.id === entry.estimateLineId,
                  );
                  const actor =
                    entry.recordedBy?.name?.trim() ||
                    entry.recordedBy?.email ||
                    t("unknownActor");
                  return (
                    <li
                      key={entry.id}
                      className="border-b border-slate-300 px-4 py-3.5 text-[12px] last:border-b-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <b className="font-semibold text-slate-900">
                          {line?.description ?? t("lineDescription")}
                        </b>
                        <span className="text-slate-400">
                          {entry.createdAt.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1.5 text-slate-600">
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
                        <p className="mt-1 text-slate-500">{entry.note}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </SmoothHistoryPanel>
        </>
      )}

      {revisions.length > 0 ? (
        <SmoothHistoryPanel title={t("revisionHistory")} hint={t("seeEarlier")}>
          <ul className="divide-y divide-slate-200">
            {revisions.map((rev) => (
              <li key={rev.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-slate-900">
                      {t("revisionLabel", { number: rev.revisionNumber })}
                      {rev.supersededAt == null
                        ? ` · ${t("currentRevision")}`
                        : ` · ${t("superseded")}`}
                    </p>
                    <p className="text-[13px] text-slate-500">
                      {`${t("lineCount", { count: rev.lines.length })} · ${rev.createdAt.toLocaleString()}`}
                    </p>
                    {rev.notes ? (
                      <p className="text-[13px] text-slate-600">{rev.notes}</p>
                    ) : null}
                  </div>
                </div>
                {rev.lines.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-[13px] text-slate-600">
                    {t("revisionLinesEmpty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200/80 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                    {rev.lines.map((line) => {
                      const typeKey =
                        line.type === "PART" || line.type === "LABOUR"
                          ? line.type
                          : "LABOUR";
                      const lineTotal = multiplyByQuantity(
                        line.unitPricePaise,
                        line.quantity,
                      );
                      return (
                        <li
                          key={line.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
                        >
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                                typeKey === "PART"
                                  ? "border-blue-200 bg-blue-50 text-blue-800"
                                  : "border-orange-200 bg-orange-50 text-orange-800",
                              )}
                            >
                              {t(`lineTypes.${typeKey}`)}
                            </span>
                            <p className="min-w-0 truncate text-[14px] font-medium text-slate-900">
                              {line.description}
                            </p>
                            <span
                              className={cn(
                                "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                line.approvalState === "APPROVED"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : line.approvalState === "REJECTED"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-amber-50 text-amber-800",
                              )}
                            >
                              {t(
                                `approvalStatesShort.${line.approvalState as EstimateApprovalStateValue}`,
                              )}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[12px] tabular-nums text-slate-500">
                              {t("emptyPreviewQtyPrice", {
                                quantity: line.quantity,
                                price: formatRupees(line.unitPricePaise),
                              })}
                            </p>
                            <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                              {formatRupees(lineTotal)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </SmoothHistoryPanel>
      ) : null}
    </div>
  );
}
