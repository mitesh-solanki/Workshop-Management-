"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, FileText, Ticket, Upload, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import {
  LiveMediaLightbox,
  type LiveMediaItem,
} from "@/modules/live-link/components/live-media-gallery";
import {
  JobSlipCard,
  type JobSlipCardData,
} from "@/modules/job-slips/components/job-slip-card";
import { JobCardRowActions } from "@/modules/service-orders/components/job-card-row-actions";
import { uploadPaperJobCardFiles } from "@/modules/service-orders/components/upload-paper-job-card";
import { formatTechniciansList } from "@/modules/service-orders/technicians";

const HARD_COPY_MAX_FILES = 5;

export type ServiceHistoryPaperCopy = {
  id: string;
  contentType: string;
  fileName: string | null;
  url: string | null;
};

export type ServiceHistoryRow = JobSlipCardData & {
  paperCopyCount: number;
  paperCopies: ServiceHistoryPaperCopy[];
  vehicleId: string;
};

type Props = {
  slips: ServiceHistoryRow[];
  customerId: string;
  canWrite: boolean;
  canDelete?: boolean;
  canUploadPaper?: boolean;
  emptyTitle: string;
  emptyBody: string;
  showRegistration: boolean;
  emptyAction?: ReactNode;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatKms(value: number | null, locale: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

function hardCopyMediaItems(copies: ServiceHistoryPaperCopy[]): LiveMediaItem[] {
  return copies
    .filter(
      (copy) =>
        Boolean(copy.url) && copy.contentType.toLowerCase().startsWith("image/"),
    )
    .map((copy) => ({
      id: copy.id,
      kind: "PHOTO" as const,
      url: copy.url as string,
      itemLabel: copy.fileName?.trim() || copy.id,
    }));
}

function hardCopyPdfs(copies: ServiceHistoryPaperCopy[]) {
  return copies.filter(
    (copy) =>
      Boolean(copy.url) &&
      (copy.contentType.toLowerCase() === "application/pdf" ||
        (copy.fileName ?? "").toLowerCase().endsWith(".pdf")),
  );
}

function HistoryRowActions({
  slip,
  customerId,
  canWrite,
  canDelete,
  canUploadPaper,
  onOpenSlip,
  onOpenHardCopy,
}: {
  slip: ServiceHistoryRow;
  customerId: string;
  canWrite: boolean;
  canDelete: boolean;
  canUploadPaper: boolean;
  onOpenSlip: () => void;
  onOpenHardCopy: () => void;
}) {
  const t = useTranslations("orders");
  const tj = useTranslations("jobSlips");

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="outline" size="icon-sm">
            <Link href={`/orders/${slip.id}`} aria-label={t("view")}>
              <Eye className="size-4" aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{t("viewJobCardTooltip")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={tj("viewSlip")}
            onClick={onOpenSlip}
          >
            <Ticket className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{tj("viewSlipTooltip")}</TooltipContent>
      </Tooltip>
      {slip.paperCopyCount > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("paperView")}
              onClick={onOpenHardCopy}
            >
              <FileText className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("paperViewTooltip")}</TooltipContent>
        </Tooltip>
      ) : null}
      <JobCardRowActions
        orderId={slip.id}
        customerId={customerId}
        vehicleId={slip.vehicleId}
        label={slip.vehicle.registrationNumber}
        canWrite={canWrite}
        canDelete={canDelete}
        canUploadPaper={canUploadPaper && slip.paperCopyCount === 0}
        hasPaperCopy={false}
        status={slip.status}
        mode="delete-only"
      />
    </div>
  );
}

export function ServiceHistoryList({
  slips,
  customerId,
  canWrite,
  canDelete = false,
  canUploadPaper = false,
  emptyTitle,
  emptyBody,
  showRegistration,
  emptyAction,
}: Props) {
  const t = useTranslations("orders");
  const tj = useTranslations("jobSlips");
  const locale = useLocale();
  const router = useRouter();
  const hardCopyInputRef = useRef<HTMLInputElement>(null);
  const [slipDialogOpen, setSlipDialogOpen] = useState(false);
  const [hardCopyDialogOpen, setHardCopyDialogOpen] = useState(false);
  const [activeSlip, setActiveSlip] = useState<ServiceHistoryRow | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadPending, startUpload] = useTransition();

  useEffect(() => {
    if (!activeSlip) return;
    const next = slips.find((slip) => slip.id === activeSlip.id);
    if (next) setActiveSlip(next);
  }, [slips, activeSlip?.id]);

  const hardCopyImages = useMemo(
    () => (activeSlip ? hardCopyMediaItems(activeSlip.paperCopies) : []),
    [activeSlip],
  );
  const hardCopyPdfFiles = useMemo(
    () => (activeSlip ? hardCopyPdfs(activeSlip.paperCopies) : []),
    [activeSlip],
  );
  const hardCopyRemaining = Math.max(
    0,
    HARD_COPY_MAX_FILES - (activeSlip?.paperCopyCount ?? 0),
  );
  const canAddHardCopy =
    canUploadPaper && hardCopyRemaining > 0 && Boolean(activeSlip);

  function openSlipPreview(slip: ServiceHistoryRow) {
    setActiveSlip(slip);
    setSlipDialogOpen(true);
  }

  function openHardCopy(slip: ServiceHistoryRow) {
    setActiveSlip(slip);
    setLightboxIndex(null);
    setHardCopyDialogOpen(true);
  }

  function onHardCopyFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!activeSlip || selected.length === 0 || hardCopyRemaining === 0) return;
    const files = selected.slice(0, hardCopyRemaining);
    startUpload(async () => {
      try {
        const result = await uploadPaperJobCardFiles({
          serviceOrderId: activeSlip.id,
          files,
          uploadFailedMessage: t("paperUploadFailed"),
          customerId,
          vehicleId: activeSlip.vehicleId,
          maxFiles: hardCopyRemaining,
        });
        toast.success(
          result.uploaded > 1
            ? t("paperUploadedMany", { count: result.uploaded })
            : (result.message ?? t("paperUploaded")),
        );
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("paperUploadFailed");
        toast.error(message);
      }
    });
  }

  if (slips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Wrench className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <p className="text-section-title text-slate-900">{emptyTitle}</p>
          <p className="max-w-md text-body text-slate-600">{emptyBody}</p>
        </div>
        {emptyAction}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 p-3 md:hidden">
        {slips.map((slip) => {
          const tech = formatTechniciansList(slip, "").trim();
          const kmsLabel = formatKms(slip.odometerIn, locale);
          return (
            <li
              key={slip.id}
              className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  {showRegistration ? (
                    <p className="truncate text-sm font-semibold tracking-wide text-foreground">
                      {slip.vehicle.registrationNumber}
                    </p>
                  ) : (
                    <p className="truncate text-sm font-semibold text-foreground">
                      {formatDate(slip.createdAt, locale)}
                    </p>
                  )}
                  <p className="font-mono text-caption font-semibold text-foreground">
                    {slip.jobCardNumber}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {showRegistration
                      ? `${formatDate(slip.createdAt, locale)} · ${tj("fields.deliveryDate")}: ${formatDate(slip.expectedCompletion, locale)}`
                      : `${tj("fields.kmsCovered")}: ${kmsLabel} · ${tj("fields.deliveryDate")}: ${formatDate(slip.expectedCompletion, locale)}`}
                    {tech ? ` · ${tech}` : ""}
                  </p>
                  <StatusBadge
                    status={slip.status as ServiceOrderStatus}
                    label={t(`statuses.${slip.status}`)}
                  />
                </div>
                <HistoryRowActions
                  slip={slip}
                  customerId={customerId}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  canUploadPaper={canUploadPaper}
                  onOpenSlip={() => openSlipPreview(slip)}
                  onOpenHardCopy={() => openHardCopy(slip)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.jobCardNumber")}</TableHead>
              <TableHead>{t("columns.issueDate")}</TableHead>
              {showRegistration ? (
                <TableHead>{tj("fields.registration")}</TableHead>
              ) : (
                <TableHead>{tj("fields.kmsCovered")}</TableHead>
              )}
              <TableHead>{tj("fields.deliveryDate")}</TableHead>
              <TableHead>{tj("fields.mechanic")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.map((slip) => {
              const tech = formatTechniciansList(slip, "").trim();
              return (
                <TableRow key={slip.id}>
                  <TableCell className="font-mono text-sm font-semibold">
                    {slip.jobCardNumber}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(slip.createdAt, locale)}
                  </TableCell>
                  {showRegistration ? (
                    <TableCell className="font-medium">
                      {slip.vehicle.registrationNumber}
                    </TableCell>
                  ) : (
                    <TableCell className="font-medium tabular-nums">
                      {formatKms(slip.odometerIn, locale)}
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(slip.expectedCompletion, locale)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tech || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={slip.status as ServiceOrderStatus}
                      label={t(`statuses.${slip.status}`)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <HistoryRowActions
                      slip={slip}
                      customerId={customerId}
                      canWrite={canWrite}
                      canDelete={canDelete}
                      canUploadPaper={canUploadPaper}
                      onOpenSlip={() => openSlipPreview(slip)}
                      onOpenHardCopy={() => openHardCopy(slip)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={slipDialogOpen} onOpenChange={setSlipDialogOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-[min(96vw,720px)]">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle>{tj("viewSlipTitle")}</DialogTitle>
              {activeSlip ? (
                <Button asChild variant="secondary" size="md">
                  <Link href={`/orders/${activeSlip.id}`}>{t("view")}</Link>
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          <DialogBody className="px-5 py-4">
            {activeSlip ? (
              <JobSlipCard slip={activeSlip} linked={false} />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        open={hardCopyDialogOpen}
        onOpenChange={(open) => {
          if (!open && (lightboxIndex !== null || uploadPending)) return;
          setHardCopyDialogOpen(open);
          if (!open) setLightboxIndex(null);
        }}
      >
        <DialogContent
          className="gap-0 p-0 sm:max-w-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (lightboxIndex !== null || uploadPending) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (lightboxIndex !== null || uploadPending) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <DialogTitle>{t("paperTitle")}</DialogTitle>
            {activeSlip ? (
              <DialogDescription>
                {t("paperUploadDescription", {
                  label: activeSlip.vehicle.registrationNumber,
                })}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogBody className="space-y-3 px-5 py-4">
            <p className="text-sm text-muted-foreground">{t("paperHint")}</p>
            {hardCopyImages.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {hardCopyImages.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      aria-label={item.itemLabel}
                      className="relative size-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:size-32"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.itemLabel}
                        className="size-full object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {hardCopyPdfFiles.length > 0 ? (
              <ul className="space-y-2">
                {hardCopyPdfFiles.map((copy) => (
                  <li key={copy.id}>
                    <a
                      href={copy.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {copy.fileName?.trim() || t("paperTitle")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {hardCopyImages.length === 0 && hardCopyPdfFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("paperEmpty")}</p>
            ) : null}
            {canAddHardCopy ? (
              <input
                ref={hardCopyInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                disabled={uploadPending}
                onChange={onHardCopyFiles}
              />
            ) : null}
          </DialogBody>
          <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={uploadPending}
              >
                {t("cancelEdit")}
              </Button>
            </DialogClose>
            {canAddHardCopy ? (
              <Button
                type="button"
                size="md"
                loading={uploadPending}
                onClick={() => hardCopyInputRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden />
                {uploadPending ? t("paperUploading") : t("paperUpload")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightboxIndex !== null && hardCopyImages.length > 0 ? (
        <LiveMediaLightbox
          items={hardCopyImages}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  );
}
