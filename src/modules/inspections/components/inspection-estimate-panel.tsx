"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { syncInspectionEstimateFromItemsAction } from "@/app/actions/estimates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { formatRupees, type Paise } from "@/lib/money";
import { AgreeAllPendingCheckbox } from "@/modules/estimates/components/agree-all-pending-checkbox";
import { CompactLineApproval } from "@/modules/estimates/components/compact-line-approval";
import { CreateInspectionEstimateForm } from "@/modules/inspections/components/create-inspection-estimate-form";
import { LiveLinkStaffPanel } from "@/modules/live-link/components/live-link-staff-panel";

type EstimateLine = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
};

type CurrentEstimate = {
  id: string;
  revisionNumber: number;
  askPermission: boolean;
  permissionVia: "MANUAL" | "LIVE_LINK" | null;
  notes: string | null;
  lines: EstimateLine[];
  totals: {
    all: { taxablePaise: number; totalPaise: number };
    approved: { totalPaise: number };
    pending: { totalPaise: number };
  };
};

type DraftPayload = {
  customerId: string;
  vehicleId: string;
  complaint: string;
  recommendedNotes: string;
  itemsJson: string;
};

type PendingSource = {
  description: string;
  quantity: number;
  unitPricePaise: number;
};

type Props = {
  inspectionId: string;
  canEdit: boolean;
  canEditLiveLink: boolean;
  liveLinkActive: { id: string; expiresAt: Date | string } | null;
  pricedLineCount: number;
  draft: DraftPayload;
  pendingSources: PendingSource[];
  current: CurrentEstimate | null;
};

function estimateApprovalSummary(current: CurrentEstimate) {
  if (!current.askPermission) {
    return "notRequired" as const;
  }
  if (current.lines.length === 0) {
    return "pending" as const;
  }
  if (current.lines.every((line) => line.approvalState === "APPROVED")) {
    return "approved" as const;
  }
  if (current.lines.some((line) => line.approvalState === "REJECTED")) {
    return "rejected" as const;
  }
  return "pending" as const;
}

export function InspectionEstimatePanel({
  inspectionId,
  canEdit,
  canEditLiveLink,
  liveLinkActive,
  pricedLineCount,
  draft,
  pendingSources,
  current,
}: Props) {
  const t = useTranslations("estimates");
  const ti = useTranslations("inspections");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const summary = current ? estimateApprovalSummary(current) : null;
  const showLiveLink =
    Boolean(current) &&
    current!.askPermission &&
    current!.permissionVia === "LIVE_LINK";
  const pendingApprovalCount =
    current?.lines.filter((line) => line.approvalState === "PENDING").length ??
    0;
  const approvedCount =
    current?.lines.filter((line) => line.approvalState === "APPROVED").length ??
    0;
  const rejectedCount =
    current?.lines.filter((line) => line.approvalState === "REJECTED").length ??
    0;

  function onAddPending() {
    startTransition(async () => {
      const result = await syncInspectionEstimateFromItemsAction(
        inspectionId,
        draft,
      );
      if (!result.ok) {
        toast.error(result.message ?? t("errors.createFailed"));
        return;
      }
      toast.success(
        result.message === "linesSynced"
          ? ti("estimateLinesSynced")
          : ti("estimateLinesAlreadySynced"),
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 border-t border-[#d7deea] pt-5">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-slate-900">
          {ti("estimateSectionTitle")}
        </h3>
        <p className="text-[13px] text-slate-600">
          {ti("estimateSectionHint")}
        </p>
      </div>

      {!current ? (
        <div className="space-y-4 rounded-[12px] border border-[#c9d8ff] bg-[#edf4ff]/70 px-4 py-4">
          <div>
            <p className="text-[14px] font-semibold text-slate-900">
              {t("emptyTitle")}
            </p>
            <p className="mt-1 text-[13px] text-slate-600">
              {canEdit ? ti("estimateEmptyHint") : t("emptyReadOnly")}
            </p>
          </div>
          {canEdit ? (
            <CreateInspectionEstimateForm
              inspectionId={inspectionId}
              pricedLineCount={pricedLineCount}
              draft={draft}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {showLiveLink ? (
            <LiveLinkStaffPanel
              inspectionId={inspectionId}
              active={liveLinkActive}
              canEdit={canEditLiveLink}
              variant="embed"
              estimateOnly
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {!current.askPermission ? (
                <Badge variant="secondary">{t("askPermissionNo")}</Badge>
              ) : current.permissionVia === "LIVE_LINK" ? (
                <Badge variant="outline">{t("permissionViaLiveLink")}</Badge>
              ) : (
                <Badge variant="outline">{t("permissionViaManual")}</Badge>
              )}
              {summary === "notRequired" ? (
                <Badge variant="success">{ti("estimateStatusNoApproval")}</Badge>
              ) : null}
              {current.askPermission && current.lines.length > 0 ? (
                <>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold tabular-nums text-emerald-800">
                    {t("permissionAgreedCount", { count: approvedCount })}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-[12px] font-semibold tabular-nums text-red-800">
                    {t("permissionDisagreedCount", { count: rejectedCount })}
                  </span>
                </>
              ) : null}
            </div>
            {current.askPermission &&
            canEdit &&
            current.lines.length > 0 ? (
              <AgreeAllPendingCheckbox
                inspectionId={inspectionId}
                pendingCount={pendingApprovalCount}
              />
            ) : null}
          </div>

          {current.askPermission ? (
            <p className="text-[13px] text-slate-600">
              {current.permissionVia === "LIVE_LINK"
                ? t("permissionHowBodyLiveLink")
                : t("permissionHowBody")}
            </p>
          ) : null}

          {canEdit && pendingSources.length > 0 ? (
            <div className="space-y-3 rounded-[12px] border border-[#c9d8ff] bg-[#edf4ff]/70 px-4 py-4">
              <div>
                <p className="text-[14px] font-semibold text-slate-900">
                  {ti("estimatePendingTitle", {
                    count: pendingSources.length,
                  })}
                </p>
                <p className="mt-1 text-[13px] text-slate-600">
                  {ti("estimatePendingBody")}
                </p>
              </div>
              <ul className="space-y-1.5">
                {pendingSources.map((source) => (
                  <li
                    key={source.description}
                    className="text-[15px] font-medium text-slate-800"
                  >
                    {source.description}{" "}
                    <span className="tabular-nums text-slate-600">
                      ({formatRupees(source.unitPricePaise as Paise)})
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                size="sm"
                loading={pending}
                className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                onClick={onAddPending}
              >
                <Plus className="size-4" aria-hidden />
                {ti("estimateAddNewItems", { count: pendingSources.length })}
              </Button>
            </div>
          ) : null}

          {current.notes?.trim() ? (
            <p className="text-[13px] text-slate-600">
              <span className="font-medium text-slate-800">{t("notes")}: </span>
              {current.notes.trim()}
            </p>
          ) : null}

          {current.lines.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-[13px] text-slate-600">
              {ti("estimateEmptyHint")}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-[10px] border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[40%]">
                        {ti("reportDescriptionLabel")}
                      </TableHead>
                      <TableHead className="w-20 text-right">
                        {ti("quantityShort")}
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        {ti("reportPriceLabel")}
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        {ti("reportLineTotal")}
                      </TableHead>
                      {current.askPermission ? (
                        <TableHead className="w-[5.5rem] text-right">
                          {t("approvalState")}
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="max-w-[14rem] whitespace-normal font-medium text-slate-900 sm:max-w-[18rem]">
                          {line.description}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRupees(line.unitPricePaise as Paise)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-slate-900">
                          {formatRupees(
                            (line.unitPricePaise * line.quantity) as Paise,
                          )}
                        </TableCell>
                        {current.askPermission ? (
                          <TableCell className="text-right">
                            {canEdit ? (
                              <CompactLineApproval
                                inspectionId={inspectionId}
                                lineId={line.id}
                                approvalState={line.approvalState}
                                description={line.description}
                                quantity={line.quantity}
                                unitPricePaise={line.unitPricePaise}
                                compact
                              />
                            ) : (
                              <Badge
                                variant={
                                  line.approvalState === "APPROVED"
                                    ? "success"
                                    : line.approvalState === "REJECTED"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {t(`approvalStates.${line.approvalState}`)}
                              </Badge>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-right text-[14px] font-semibold text-blue-600">
                {t("totalsAll")}:{" "}
                {formatRupees(current.totals.all.totalPaise as Paise)}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
