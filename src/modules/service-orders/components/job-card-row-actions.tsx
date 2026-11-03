"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, FileText, FileUp, Ticket, Trash2 } from "lucide-react";
import { getJobReportAction } from "@/app/actions/job-slips";
import { deleteServiceOrderAction } from "@/app/actions/service-orders";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  JobSlipCard,
  type JobSlipCardData,
} from "@/modules/job-slips/components/job-slip-card";
import { HardCopyDialog } from "@/modules/service-orders/components/hard-copy-dialog";
import { PaperJobCardUploadDialog } from "@/modules/service-orders/components/paper-job-card-upload-dialog";

type Props = {
  orderId: string;
  customerId: string;
  vehicleId?: string;
  label: string;
  canWrite: boolean;
  /** Owner / manager only — technicians never see delete. */
  canDelete?: boolean;
  /** Owner / manager — upload signed paper job card from the list. */
  canUploadPaper?: boolean;
  /** When true, row shows View Paper Job Card instead of Upload. */
  hasPaperCopy?: boolean;
  /** Completed cards are view-only (no edit). */
  status?: string;
  /** On the job-card hub, only show delete (view/edit are redundant). */
  mode?: "row" | "delete-only" | "view-delete";
  /** Where to go after a successful delete. Defaults to staying put + refresh. */
  redirectTo?: string;
  /** Show Open Report and load the job report modal on demand. */
  showReport?: boolean;
  /** Prefetched slip — skips the fetch when opening the modal. */
  reportSlip?: JobSlipCardData;
};

export function JobCardRowActions({
  orderId,
  customerId,
  vehicleId,
  label,
  canWrite,
  canDelete = false,
  canUploadPaper = false,
  hasPaperCopy = false,
  status,
  mode = "row",
  redirectTo,
  showReport = false,
  reportSlip: reportSlipProp,
}: Props) {
  const t = useTranslations("orders");
  const tj = useTranslations("jobSlips");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [hardCopyViewOpen, setHardCopyViewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<JobSlipCardData | null>(
    reportSlipProp ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [reportPending, startReportTransition] = useTransition();
  const showView = mode === "row" || mode === "view-delete";
  const showDelete = canDelete;
  const showPaper = canUploadPaper || hasPaperCopy;
  const canOpenReport =
    (showReport || Boolean(reportSlipProp)) && mode !== "delete-only";
  const isCompleted = status === "COMPLETED";
  /** One eye control: open details for work, or read-only when completed. */
  const viewHref =
    mode === "row" && canWrite && !isCompleted
      ? `/orders/${orderId}?section=details`
      : `/orders/${orderId}`;
  const viewLabel =
    mode === "row" && canWrite && !isCompleted ? t("edit") : t("view");
  const viewTooltip =
    mode === "row" && canWrite && !isCompleted
      ? t("editJobCardTooltip")
      : t("viewJobCardTooltip");
  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteServiceOrderAction(orderId, customerId);
      if (!result.ok) {
        toast.error(result.message ?? t("errors.deleteFailed"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setDeleteOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }
      router.refresh();
    });
  }

  function openReport() {
    if (reportSlipProp) {
      setActiveReport(reportSlipProp);
      setReportOpen(true);
      return;
    }
    if (activeReport?.id === orderId) {
      setReportOpen(true);
      return;
    }
    startReportTransition(async () => {
      const result = await getJobReportAction(orderId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setActiveReport(result.slip);
      setReportOpen(true);
    });
  }

  if (mode === "delete-only" && !showDelete && !showPaper) {
    return null;
  }

  if (!showView && !showDelete && !showPaper && !canOpenReport) {
    return null;
  }

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {showView ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="icon-sm">
                <Link href={viewHref} aria-label={viewLabel}>
                  <Eye className="size-4" aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{viewTooltip}</TooltipContent>
          </Tooltip>
        ) : null}
        {canOpenReport ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={reportPending}
                aria-label={tj("viewSlip")}
                onClick={openReport}
              >
                <Ticket className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{tj("viewSlipTooltip")}</TooltipContent>
          </Tooltip>
        ) : null}
        {showPaper ? (
          hasPaperCopy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("paperView")}
                  onClick={() => setHardCopyViewOpen(true)}
                >
                  <FileText className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("paperViewTooltip")}</TooltipContent>
            </Tooltip>
          ) : canUploadPaper ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={t("paperUpload")}
                  onClick={() => {
                    window.setTimeout(() => setPaperOpen(true), 0);
                  }}
                >
                  <FileUp className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("paperUploadTooltip")}
              </TooltipContent>
            </Tooltip>
          ) : null
        ) : null}
        {showDelete ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={pending}
                className="text-danger hover:bg-danger/5 hover:text-danger"
                aria-label={t("delete")}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t("deleteJobCardTooltip")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-[min(96vw,720px)]">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <DialogTitle>{tj("viewSlipTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="px-5 py-4">
            {activeReport ? (
              <JobSlipCard slip={activeReport} linked={false} />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {canUploadPaper && !hasPaperCopy ? (
        <PaperJobCardUploadDialog
          open={paperOpen}
          onOpenChange={setPaperOpen}
          serviceOrderId={orderId}
          customerId={customerId}
          vehicleId={vehicleId}
          label={label}
        />
      ) : null}

      {hasPaperCopy ? (
        <HardCopyDialog
          open={hardCopyViewOpen}
          onOpenChange={setHardCopyViewOpen}
          serviceOrderId={orderId}
          customerId={customerId}
          vehicleId={vehicleId}
          label={label}
          canUpload={canUploadPaper}
        />
      ) : null}

      {showDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!open && !pending) setDeleteOpen(false);
          }}
          title={t("deleteTitle")}
          description={t("deleteConfirm", { label })}
          confirmLabel={t("delete")}
          variant="danger"
          loading={pending && deleteOpen}
          onConfirm={onConfirmDelete}
        />
      ) : null}
    </>
  );
}
