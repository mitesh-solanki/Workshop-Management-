"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PricingLinesTable } from "@/modules/billing/components/pricing-lines-table";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import { InvoiceLineWarrantyModal } from "@/modules/warranties/components/invoice-line-warranty-modal";

export type InvoiceWarrantyLine = {
  id: string;
  description: string;
  type: "LABOUR" | "PART";
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
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
  emptyLabel?: string;
  /** Fires when required battery rows are complete on saved docs. */
  onRequiredValidityChange?: (complete: boolean) => void;
};

function formatExpiryDate(
  value: Date | string | null,
  locale: string,
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function docSignature(doc: InvoiceWarrantyDoc | null | undefined) {
  if (!doc) return "";
  const expiry =
    doc.warrantyExpiresAt instanceof Date
      ? doc.warrantyExpiresAt.toISOString()
      : (doc.warrantyExpiresAt ?? "");
  return `${doc.id}:${expiry}:${doc.storageKey ?? ""}`;
}

export function InvoiceWarrantyPanel({
  orderId,
  invoiceId,
  vehicleId,
  lines,
  docs,
  canEdit,
  emptyLabel,
  onRequiredValidityChange,
}: Props) {
  const t = useTranslations("warranties");
  const locale = useLocale();
  const router = useRouter();
  const [modalLineId, setModalLineId] = useState<string | null>(null);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [savingBaseline, setSavingBaseline] = useState<string>("");

  const docsByLine = useMemo(() => {
    const map = new Map<string, InvoiceWarrantyDoc>();
    for (const doc of docs) {
      if (doc.invoiceLineId) map.set(doc.invoiceLineId, doc);
    }
    return map;
  }, [docs]);

  const requiredLineIds = useMemo(
    () =>
      lines
        .filter(
          (line) =>
            line.type === "PART" && partRequiresWarrantyCard(line.description),
        )
        .map((line) => line.id),
    [lines],
  );

  const allRequiredValid =
    requiredLineIds.length === 0 ||
    requiredLineIds.every((id) => {
      const doc = docsByLine.get(id);
      return Boolean(doc?.storageKey && doc.warrantyExpiresAt);
    });

  useEffect(() => {
    onRequiredValidityChange?.(allRequiredValid);
  }, [allRequiredValid, onRequiredValidityChange]);

  useEffect(() => {
    if (!savingLineId) return;
    const next = docSignature(docsByLine.get(savingLineId));
    if (next !== savingBaseline) {
      setSavingLineId(null);
      setSavingBaseline("");
    }
  }, [docsByLine, savingLineId, savingBaseline]);

  useEffect(() => {
    if (!savingLineId) return;
    const timer = window.setTimeout(() => {
      setSavingLineId(null);
      setSavingBaseline("");
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [savingLineId]);

  const warrantyByLineId = useMemo(() => {
    const map: Record<
      string,
      {
        label: string | null;
        required: boolean;
        incomplete: boolean;
        hasCard: boolean;
        photoUrl: string | null;
      }
    > = {};

    for (const line of lines) {
      if (line.type !== "PART") continue;
      const doc = docsByLine.get(line.id) ?? null;
      const required = partRequiresWarrantyCard(line.description);
      const expiryLabel = formatExpiryDate(
        doc?.warrantyExpiresAt ?? null,
        locale,
      );
      const hasCard = Boolean(
        doc && (doc.storageKey || doc.warrantyExpiresAt),
      );
      const incomplete =
        required && !(doc?.storageKey && doc.warrantyExpiresAt);
      map[line.id] = {
        label: expiryLabel
          ? t("lineExpiresOn", { date: expiryLabel })
          : hasCard
            ? t("lineWarrantySaved")
            : null,
        required,
        incomplete,
        hasCard,
        photoUrl: doc?.url ?? null,
      };
    }
    return map;
  }, [lines, docsByLine, locale, t]);

  const modalLine = lines.find((line) => line.id === modalLineId) ?? null;
  const modalDoc = modalLine
    ? (docsByLine.get(modalLine.id) ?? null)
    : null;

  return (
    <>
      <PricingLinesTable
        showType
        emptyLabel={emptyLabel}
        lines={lines}
        warranty={{
          byLineId: warrantyByLineId,
          canEdit,
          columnLabel: t("columnWarranty"),
          addLabel: t("addLine"),
          editLabel: t("editLine"),
          viewCardLabel: t("viewCard"),
          savingLabel: t("saving"),
          savingLineId,
          onOpen: (lineId) => {
            if (savingLineId === lineId) return;
            setModalLineId(lineId);
          },
        }}
      />
      {modalLine ? (
        <InvoiceLineWarrantyModal
          open
          onOpenChange={(open) => {
            if (!open) setModalLineId(null);
          }}
          orderId={orderId}
          invoiceId={invoiceId}
          vehicleId={vehicleId}
          lineId={modalLine.id}
          lineDescription={modalLine.description}
          doc={modalDoc}
          onSaveStart={() => {
            setSavingLineId(modalLine.id);
            setSavingBaseline(docSignature(modalDoc));
          }}
          onSaveSuccess={() => {
            setModalLineId(null);
            router.refresh();
          }}
          onSaveError={() => {
            setSavingLineId(null);
            setSavingBaseline("");
          }}
        />
      ) : null}
    </>
  );
}
