"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { saveInvoiceLineWarrantyAction } from "@/app/actions/warranties";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import { WarrantyCardPhotoField } from "@/modules/warranties/components/warranty-card-photo-field";
import { uploadWarrantyCardFile } from "@/modules/warranties/components/upload-warranty-file";

export type InvoiceWarrantyLine = {
  id: string;
  description: string;
  type: "LABOUR" | "PART";
};

export type InvoiceWarrantyDoc = {
  id: string;
  invoiceLineId: string | null;
  partName?: string | null;
  warrantyExpiresAt: Date | string | null;
  storageKey: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  fileName: string | null;
  url: string | null;
};

type Props = {
  orderId: string;
  invoiceId: string;
  vehicleId: string;
  lines: InvoiceWarrantyLine[];
  docs: InvoiceWarrantyDoc[];
  canEdit: boolean;
  /** Fires when any required battery row is incomplete in the form (not only saved). */
  onRequiredValidityChange?: (complete: boolean) => void;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const EXPIRY_DEBOUNCE_MS = 450;

function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function LineWarrantyRow({
  orderId,
  invoiceId,
  vehicleId,
  line,
  doc,
  canEdit,
  onLocalValidChange,
}: {
  orderId: string;
  invoiceId: string;
  vehicleId: string;
  line: InvoiceWarrantyLine;
  doc: InvoiceWarrantyDoc | null;
  canEdit: boolean;
  onLocalValidChange?: (lineId: string, valid: boolean) => void;
}) {
  const t = useTranslations("warranties");
  const idPrefix = useId();
  const required = partRequiresWarrantyCard(line.description);
  const savedExpiry = toDateInput(doc?.warrantyExpiresAt ?? null);
  const [expiry, setExpiry] = useState(savedExpiry);
  const [file, setFile] = useState<File | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef(doc);
  const photoClearedRef = useRef(false);
  docRef.current = doc;
  photoClearedRef.current = photoCleared;

  useEffect(() => {
    setExpiry(savedExpiry);
  }, [savedExpiry]);

  useEffect(() => {
    if (!doc?.storageKey) {
      setPhotoCleared(false);
    }
  }, [doc?.storageKey]);

  useEffect(() => {
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, []);

  const showExistingPhoto = Boolean(doc?.storageKey) && !photoCleared && !file;
  const hasPhoto = Boolean(file || showExistingPhoto);
  const hasExpiry = Boolean(expiry.trim());
  const savedComplete = Boolean(doc?.storageKey && doc?.warrantyExpiresAt);
  const localComplete = hasExpiry && hasPhoto;
  const ready = required
    ? savedComplete && (!canEdit || localComplete)
    : false;
  const optionalSaved = Boolean(doc?.storageKey || doc?.warrantyExpiresAt);
  const cardIncomplete = required && (!hasExpiry || !hasPhoto);

  useEffect(() => {
    if (!required || !onLocalValidChange) return;
    onLocalValidChange(line.id, localComplete && savedComplete);
  }, [
    required,
    localComplete,
    savedComplete,
    line.id,
    onLocalValidChange,
  ]);

  function persist(next: {
    expiry: string;
    storageKey: string | null;
    contentType?: string | null;
    byteSize?: number | null;
    fileName?: string | null;
  }) {
    const hasAnything = Boolean(next.expiry.trim() || next.storageKey);
    if (!hasAnything && !docRef.current) {
      return;
    }

    setStatus("saving");
    startTransition(async () => {
      try {
        const result = await saveInvoiceLineWarrantyAction({
          orderId,
          invoiceId,
          invoiceLineId: line.id,
          warrantyExpiresAt: next.expiry || undefined,
          storageKey: next.storageKey,
          contentType: next.contentType ?? null,
          byteSize: next.byteSize ?? null,
          fileName: next.fileName ?? null,
        });

        if (!result.ok) {
          setStatus("error");
          toast.error(result.message ?? t("error"));
          return;
        }
        setStatus("saved");
        window.setTimeout(() => {
          setStatus((current) => (current === "saved" ? "idle" : current));
        }, 1500);
      } catch (error) {
        setStatus("error");
        toast.error(
          error instanceof Error ? error.message : t("uploadFailed"),
        );
      }
    });
  }

  function scheduleExpirySave(nextExpiry: string) {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(() => {
      const current = docRef.current;
      const keepPhoto =
        Boolean(current?.storageKey) && !photoClearedRef.current;
      persist({
        expiry: nextExpiry,
        storageKey: keepPhoto ? (current?.storageKey ?? null) : null,
        contentType: keepPhoto ? (current?.contentType ?? null) : null,
        byteSize: keepPhoto ? (current?.byteSize ?? null) : null,
        fileName: keepPhoto ? (current?.fileName ?? null) : null,
      });
    }, EXPIRY_DEBOUNCE_MS);
  }

  function onExpiryChange(value: string) {
    setExpiry(value);
    scheduleExpirySave(value);
  }

  function onPhotoChange(nextFile: File | null) {
    if (!nextFile) {
      const hadSavedPhoto = Boolean(docRef.current?.storageKey);
      setFile(null);
      setPhotoCleared(true);
      if (hadSavedPhoto || expiry.trim()) {
        persist({
          expiry,
          storageKey: null,
          contentType: null,
          byteSize: null,
          fileName: null,
        });
      }
      return;
    }

    setPhotoCleared(false);
    setFile(nextFile);
    setStatus("saving");
    startTransition(async () => {
      try {
        const uploaded = await uploadWarrantyCardFile({
          vehicleId,
          file: nextFile,
          uploadFailedMessage: t("uploadFailed"),
        });
        const result = await saveInvoiceLineWarrantyAction({
          orderId,
          invoiceId,
          invoiceLineId: line.id,
          warrantyExpiresAt: expiry || undefined,
          storageKey: uploaded.storageKey,
          contentType: uploaded.contentType,
          byteSize: uploaded.byteSize,
          fileName: uploaded.fileName,
        });
        if (!result.ok) {
          setStatus("error");
          toast.error(result.message ?? t("error"));
          return;
        }
        setFile(null);
        setStatus("saved");
        window.setTimeout(() => {
          setStatus((current) => (current === "saved" ? "idle" : current));
        }, 1500);
      } catch (error) {
        setStatus("error");
        toast.error(
          error instanceof Error ? error.message : t("uploadFailed"),
        );
      }
    });
  }

  return (
    <div
      data-warranty-line={line.id}
      data-incomplete={required && !ready ? "true" : "false"}
      className={cn(
        "space-y-3 rounded-lg border bg-slate-50/60 p-3",
        cardIncomplete
          ? "border-danger ring-1 ring-danger/25"
          : "border-slate-200",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {line.description}
          </p>
          <p className="text-caption text-slate-600">
            {required ? t("batteryHint") : t("optionalHint")}
          </p>
        </div>
        {status === "saving" || pending ? (
          <Badge variant="secondary">{t("saving")}</Badge>
        ) : status === "saved" ? (
          <Badge variant="secondary">{t("saved")}</Badge>
        ) : required ? (
          <Badge variant={ready ? "success" : "warning"}>
            {ready ? t("ready") : t("required")}
          </Badge>
        ) : optionalSaved ? (
          <Badge variant="secondary">{t("optionalSaved")}</Badge>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex max-w-56 flex-col gap-5">
          <FormField
            id={`${idPrefix}-expiry`}
            label={required ? `${t("expiry")} *` : t("expiry")}
          >
            <Input
              id={`${idPrefix}-expiry`}
              type="date"
              value={expiry}
              onChange={(event) => onExpiryChange(event.target.value)}
            />
          </FormField>
          <WarrantyCardPhotoField
            id={`${idPrefix}-file`}
            label={required ? `${t("cardPhoto")} *` : t("cardPhoto")}
            file={file}
            onChange={onPhotoChange}
            existingUrl={showExistingPhoto ? doc?.url : null}
            existingFileName={showExistingPhoto ? doc?.fileName : null}
            existingContentType={
              showExistingPhoto ? doc?.contentType : null
            }
          />
        </div>
      ) : (
        <div className="flex max-w-56 flex-col gap-5">
          {doc?.url ? (
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="relative h-28 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doc.url}
                alt={doc.fileName ?? t("cardPhoto")}
                className="size-full object-cover"
              />
            </a>
          ) : null}
          <p className="text-caption text-slate-600">
            {`${t("expires")}: ${
              savedExpiry || t("noExpiry")
            } · ${doc?.url ? t("photoOnFile") : t("noPhoto")}`}
          </p>
        </div>
      )}
    </div>
  );
}

export function InvoiceWarrantyPanel({
  orderId,
  invoiceId,
  vehicleId,
  lines,
  docs,
  canEdit,
  onRequiredValidityChange,
}: Props) {
  const t = useTranslations("warranties");
  const partLines = useMemo(
    () => lines.filter((line) => line.type === "PART"),
    [lines],
  );
  const requiredLineIds = useMemo(
    () =>
      partLines
        .filter((line) => partRequiresWarrantyCard(line.description))
        .map((line) => line.id),
    [partLines],
  );
  const docsByLine = useMemo(() => {
    const map = new Map<string, InvoiceWarrantyDoc>();
    for (const doc of docs) {
      if (doc.invoiceLineId) map.set(doc.invoiceLineId, doc);
    }
    return map;
  }, [docs]);

  const [localValidByLine, setLocalValidByLine] = useState<
    Record<string, boolean>
  >({});

  const handleLocalValidChange = useMemo(() => {
    return (lineId: string, valid: boolean) => {
      setLocalValidByLine((prev) => {
        if (prev[lineId] === valid) return prev;
        return { ...prev, [lineId]: valid };
      });
    };
  }, []);

  const allRequiredValid =
    requiredLineIds.length === 0 ||
    requiredLineIds.every((id) => localValidByLine[id] === true);

  useEffect(() => {
    onRequiredValidityChange?.(allRequiredValid);
  }, [allRequiredValid, onRequiredValidityChange]);

  const missingBattery = partLines.some((line) => {
    if (!partRequiresWarrantyCard(line.description)) return false;
    const doc = docsByLine.get(line.id);
    return !(doc?.storageKey && doc.warrantyExpiresAt);
  });

  if (partLines.length === 0) {
    return null;
  }

  return (
    <div
      id="invoice-warranty-panel"
      data-incomplete={
        missingBattery || !allRequiredValid ? "true" : "false"
      }
      className="space-y-3 rounded-xl border border-slate-200 bg-card p-4"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("invoicePanelTitle")}
        </h3>
        <p className="text-caption text-slate-600">{t("invoicePanelHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {partLines.map((line) => (
          <LineWarrantyRow
            key={line.id}
            orderId={orderId}
            invoiceId={invoiceId}
            vehicleId={vehicleId}
            line={line}
            doc={docsByLine.get(line.id) ?? null}
            canEdit={canEdit}
            onLocalValidChange={
              canEdit ? handleLocalValidChange : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
