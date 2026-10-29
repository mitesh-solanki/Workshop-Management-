"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText, Trash2 } from "lucide-react";
import { deleteWarrantyAction } from "@/app/actions/warranties";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { getDateStatus, type DateStatus } from "@/lib/date-status";

export type WarrantyDocListItem = {
  id: string;
  partName: string;
  vehicleId: string;
  customerId: string;
  warrantyExpiresAt: Date | string | null;
  storageKey: string | null;
  contentType: string | null;
  fileName: string | null;
  url: string | null;
  vehicle: {
    id: string;
    registrationNumber: string;
    make: string;
    model: string;
  };
};

type Props = {
  docs: WarrantyDocListItem[];
  canWrite: boolean;
  locale: string;
  showVehicle?: boolean;
  emptyTitle: string;
  emptyDescription: string;
};

function formatDate(value: Date | string | null, locale: string, empty: string) {
  if (!value) return empty;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function looksLikeImage(
  contentType: string | null,
  fileName: string | null,
  url: string | null,
) {
  if (contentType?.startsWith("image/")) return true;
  const source = `${fileName ?? ""} ${url ?? ""}`.toLowerCase();
  return /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(source);
}

function statusVariant(
  status: DateStatus,
): "success" | "warning" | "danger" | "secondary" {
  switch (status) {
    case "ok":
      return "success";
    case "soon":
      return "warning";
    case "expired":
      return "danger";
    default:
      return "secondary";
  }
}

function PhotoThumb({
  doc,
  viewLabel,
  size = "table",
}: {
  doc: WarrantyDocListItem;
  viewLabel: string;
  size?: "table" | "card";
}) {
  const [broken, setBroken] = useState(false);
  const preferImage =
    Boolean(doc.url) &&
    !broken &&
    (looksLikeImage(doc.contentType, doc.fileName, doc.url) ||
      Boolean(doc.storageKey));
  const frameClass =
    size === "card"
      ? "relative block h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100"
      : "relative block h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100";

  if (!doc.url) {
    return (
      <div
        className={`${frameClass} flex items-center justify-center border border-dashed border-slate-200`}
      >
        <FileText className="size-4 text-slate-400" aria-hidden />
      </div>
    );
  }

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className={`${frameClass} border border-slate-200`}
      title={viewLabel}
    >
      {preferImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={doc.url}
          alt={doc.fileName ?? doc.partName}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <FileText className="size-4 text-slate-400" aria-hidden />
        </span>
      )}
    </a>
  );
}

function WarrantyDocRowActions({
  doc,
  canWrite,
}: {
  doc: WarrantyDocListItem;
  canWrite: boolean;
}) {
  const t = useTranslations("warranties");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function downloadDoc() {
    if (!doc.url || downloading) return;
    setDownloading(true);
    const fileName =
      doc.fileName?.trim() ||
      `${doc.partName.replace(/\s+/g, "-").toLowerCase()}-warranty`;
    try {
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(doc.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteWarrantyAction({
        warrantyId: doc.id,
        vehicleId: doc.vehicleId,
        customerId: doc.customerId,
      });
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(t("deleted"));
      setDeleteOpen(false);
    });
  }

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {doc.url ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          loading={downloading}
          aria-label={downloading ? t("downloading") : t("download")}
          title={downloading ? t("downloading") : t("download")}
          onClick={() => void downloadDoc()}
        >
          <Download className="size-3.5" aria-hidden />
        </Button>
      ) : null}
      {canWrite ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(next) => {
            if (pending && !next) return;
            setDeleteOpen(next);
          }}
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: doc.partName })}
          confirmLabel={t("delete")}
          variant="danger"
          loading={pending && deleteOpen}
          onConfirm={onConfirmDelete}
          trigger={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending}
              className="text-danger hover:bg-danger/5 hover:text-danger"
              aria-label={t("delete")}
              title={t("delete")}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

export function WarrantyDocsList({
  docs,
  canWrite,
  locale,
  showVehicle = false,
  emptyTitle,
  emptyDescription,
}: Props) {
  const t = useTranslations("warranties");

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={emptyTitle}
        description={emptyDescription}
        className="border-0 bg-transparent py-10"
      />
    );
  }

  function rowMeta(doc: WarrantyDocListItem) {
    const expiry =
      doc.warrantyExpiresAt instanceof Date
        ? doc.warrantyExpiresAt
        : doc.warrantyExpiresAt
          ? new Date(doc.warrantyExpiresAt)
          : null;
    return {
      expiry,
      status: getDateStatus(expiry),
    };
  }

  return (
    <>
      <ul className="space-y-3 p-3 md:hidden">
        {docs.map((doc) => {
          const { expiry, status } = rowMeta(doc);
          return (
            <li
              key={doc.id}
              className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <PhotoThumb doc={doc} viewLabel={t("viewCard")} size="card" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {doc.partName}
                  </p>
                  {showVehicle ? (
                    <p className="text-caption text-slate-600">
                      <Link
                        href={`/vehicles/${doc.vehicle.id}`}
                        className="font-medium text-blue-700 underline-offset-2 hover:underline"
                      >
                        {doc.vehicle.registrationNumber}
                      </Link>
                      <span className="text-slate-300"> · </span>
                      {`${doc.vehicle.make} ${doc.vehicle.model}`.trim()}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-caption text-slate-600">
                    <span>
                      {`${t("expires")}: ${formatDate(expiry, locale, t("noExpiry"))}`}
                    </span>
                    {expiry ? (
                      <Badge variant={statusVariant(status)}>
                        {t(`status.${status}`)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end border-t border-border pt-3">
                <WarrantyDocRowActions doc={doc} canWrite={canWrite} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader className="bg-slate-100 [&_tr]:border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">
                <span className="sr-only">{t("columns.photo")}</span>
              </TableHead>
              <TableHead className="text-slate-700">
                {t("columns.part")}
              </TableHead>
              {showVehicle ? (
                <TableHead className="text-slate-700">
                  {t("columns.vehicle")}
                </TableHead>
              ) : null}
              <TableHead className="whitespace-nowrap text-slate-700">
                {t("columns.expires")}
              </TableHead>
              <TableHead className="text-slate-700">
                {t("columns.status")}
              </TableHead>
              <TableHead className="w-[1%] text-right text-slate-700">
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => {
              const { expiry, status } = rowMeta(doc);
              return (
                <TableRow key={doc.id} className="hover:bg-muted/50">
                  <TableCell className="align-middle">
                    <PhotoThumb doc={doc} viewLabel={t("viewCard")} size="table" />
                  </TableCell>
                  <TableCell className="max-w-[16rem] font-medium text-foreground">
                    {doc.partName}
                  </TableCell>
                  {showVehicle ? (
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/vehicles/${doc.vehicle.id}`}
                        className="font-medium tracking-wide text-blue-700 underline-offset-2 hover:underline"
                      >
                        {doc.vehicle.registrationNumber}
                      </Link>
                      <p className="text-caption text-muted-foreground">
                        {`${doc.vehicle.make} ${doc.vehicle.model}`.trim()}
                      </p>
                    </TableCell>
                  ) : null}
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(expiry, locale, t("noExpiry"))}
                  </TableCell>
                  <TableCell>
                    {expiry ? (
                      <Badge variant={statusVariant(status)}>
                        {t(`status.${status}`)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("status.unset")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right align-middle">
                    <WarrantyDocRowActions doc={doc} canWrite={canWrite} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
