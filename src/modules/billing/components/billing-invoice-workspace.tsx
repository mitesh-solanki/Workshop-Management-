"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BillingCollapsibleCard } from "@/modules/billing/components/billing-collapsible-card";
import { CreditNoteForm } from "@/modules/billing/components/credit-note-form";
import { DeleteInvoiceForm } from "@/modules/billing/components/delete-invoice-form";
import { DownloadInvoicePdfButton } from "@/modules/billing/components/download-invoice-pdf-button";
import {
  EditInvoicePanel,
  EditInvoiceTrigger,
  type InvoiceDraftTotals,
} from "@/modules/billing/components/edit-invoice-panel";
import { FinalizeInvoiceForm } from "@/modules/billing/components/finalize-invoice-form";
import { InvoicePreviewButton } from "@/modules/billing/components/invoice-preview-button";
import type { InvoicePreviewData } from "@/modules/billing/components/invoice-preview-dialog";
import { PaymentHistoryList } from "@/modules/billing/components/payment-history-list";
import { RecordPaymentForm } from "@/modules/billing/components/record-payment-form";
import { RecordRefundForm } from "@/modules/billing/components/record-refund-form";
import type { PdfLocale } from "@/modules/billing/schema";
import { InvoiceWarrantyPanel } from "@/modules/warranties/components/invoice-warranty-panel";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";

export type BillingInvoiceCardModel = {
  id: string;
  status: "DRAFT" | "FINALIZED";
  invoiceNumber: string | null;
  gstSplit: "CGST_SGST" | "IGST";
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  pendingBalancePaise: number;
  refundDuePaise: number;
  placeOfSupplyStateCode: string;
  notes: string | null;
  lines: Array<{
    id: string;
    description: string;
    type: "LABOUR" | "PART" | "OUTSIDE";
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    totalPaise: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountPaise: number;
    isRefund: boolean;
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
    provider: string;
    status: string;
  }>;
  creditNotes: Array<{
    id: string;
    creditNoteNumber: string;
    reason: string;
    notes: string | null;
    totalPaise: number;
    lines: Array<{ id: string; description: string; totalPaise: number }>;
  }>;
  warrantyDocs: Array<{
    id: string;
    invoiceLineId: string | null;
    partName: string;
    warrantyExpiresAt: Date | string | null;
    storageKey: string | null;
    contentType: string | null;
    byteSize: number | null;
    fileName: string | null;
    url: string | null;
  }>;
  preview: InvoicePreviewData;
};

type OutsideWorkLineRef = {
  id: string;
  description: string;
  unitPricePaise: number;
  vendorId: string | null;
  vendorName: string | null;
  gstSplit: "CGST_SGST" | "IGST" | null;
  gstRatePercent: number | null;
  billStorageKey: string | null;
  billFileName: string | null;
};

type Props = {
  orderId: string;
  vehicleId: string;
  jobCardNumber: number;
  canEdit: boolean;
  pdfLocale: PdfLocale;
  invoices: BillingInvoiceCardModel[];
  outsideWorkLines?: OutsideWorkLineRef[];
};

function tabLabel(
  invoice: BillingInvoiceCardModel,
  draftLabel: string,
  labels: {
    draft: (amount: string) => string;
    paid: (number: string) => string;
    due: (number: string, amount: string) => string;
  },
) {
  const number = invoice.invoiceNumber ?? draftLabel;
  if (invoice.status === "DRAFT") {
    return labels.draft(formatRupees(invoice.totalPaise));
  }
  if (invoice.pendingBalancePaise <= 0) {
    return labels.paid(number);
  }
  return labels.due(number, formatRupees(invoice.pendingBalancePaise));
}

export function BillingInvoiceWorkspace({
  orderId,
  vehicleId,
  jobCardNumber,
  canEdit,
  pdfLocale,
  invoices,
  outsideWorkLines = [],
}: Props) {
  const t = useTranslations("billing");
  const tw = useTranslations("warranties");
  const tGst = useTranslations("gst");

  function stateName(code: string) {
    try {
      return tGst(`states.${code}`);
    } catch {
      return code;
    }
  }
  const tabLabels = {
    draft: (amount: string) => t("tabDraft", { amount }),
    paid: (number: string) => t("tabPaid", { number }),
    due: (number: string, amount: string) => t("tabDue", { number, amount }),
  };
  const initialId = useMemo(() => {
    const due = invoices.find(
      (inv) => inv.status === "FINALIZED" && inv.pendingBalancePaise > 0,
    );
    if (due) return due.id;
    const draft = invoices.find((inv) => inv.status === "DRAFT");
    if (draft) return draft.id;
    return invoices[0]?.id ?? "";
  }, [invoices]);

  const [activeId, setActiveId] = useState(initialId);
  const [warrantyFormComplete, setWarrantyFormComplete] = useState(true);
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [draftTotals, setDraftTotals] = useState<InvoiceDraftTotals | null>(
    null,
  );
  const active =
    invoices.find((inv) => inv.id === activeId) ?? invoices[0] ?? null;
  const totals = draftTotals ?? {
    taxablePaise: active?.taxablePaise ?? 0,
    cgstPaise: active?.cgstPaise ?? 0,
    sgstPaise: active?.sgstPaise ?? 0,
    igstPaise: active?.igstPaise ?? 0,
    totalPaise: active?.totalPaise ?? 0,
    pendingBalancePaise: active?.pendingBalancePaise ?? 0,
  };

  function selectInvoice(id: string) {
    setActiveId(id);
    setWarrantyFormComplete(true);
    setEditingInvoice(false);
    setDraftTotals(null);
  }

  const warrantyIncomplete = useMemo(() => {
    if (!active) return false;
    return active.lines.some((line) => {
      if (line.type !== "PART") return false;
      if (!partRequiresWarrantyCard(line.description)) return false;
      const doc = active.warrantyDocs.find(
        (item) => item.invoiceLineId === line.id,
      );
      return !(doc?.storageKey && doc.warrantyExpiresAt);
    });
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[13px] font-semibold text-slate-700">
          {t("pickBill")}
        </p>
        <div className="flex flex-wrap gap-2">
          {invoices.map((invoice) => {
            const selected = invoice.id === active.id;
            return (
              <button
                key={invoice.id}
                type="button"
                onClick={() => selectInvoice(invoice.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-bold transition-colors",
                  selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
                )}
              >
                {tabLabel(invoice, t("draftLabel"), tabLabels)}
              </button>
            );
          })}
        </div>
      </div>

      <article className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[16px] font-semibold text-slate-900">
              {active.invoiceNumber ?? t("draftLabel")}
            </p>
            <p className="text-[13px] text-slate-500">
              {t(`statuses.${active.status}`)}
              {" · "}
              {t(`gstSplit.${active.gstSplit}`)}
              {" · "}
              {t("placeOfSupply")}: {stateName(active.placeOfSupplyStateCode)}
            </p>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-[12px] font-extrabold",
                active.status === "DRAFT"
                  ? "bg-amber-50 text-amber-800"
                  : active.pendingBalancePaise <= 0
                    ? "bg-blue-50 text-blue-700"
                    : "bg-emerald-50 text-emerald-800",
              )}
            >
              {active.status === "DRAFT"
                ? t("statusChipDraft")
                : active.pendingBalancePaise <= 0
                  ? t("statusChipPaid")
                  : t("statusChipDue", {
                      amount: formatRupees(active.pendingBalancePaise),
                    })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InvoicePreviewButton data={active.preview} />
            {active.status === "FINALIZED" ? (
              <DownloadInvoicePdfButton
                orderId={orderId}
                invoiceId={active.id}
                jobCardNumber={jobCardNumber}
                invoiceNumber={active.invoiceNumber}
                locale={pdfLocale}
              />
            ) : null}
            {canEdit ? (
              <>
                <EditInvoiceTrigger
                  editing={editingInvoice}
                  onEditingChange={setEditingInvoice}
                  iconOnly
                />
                <DeleteInvoiceForm
                  invoiceId={active.id}
                  orderId={orderId}
                  iconOnly
                  amountPaidPaise={active.payments
                    .filter((payment) => !payment.isRefund)
                    .reduce((sum, payment) => sum + payment.amountPaise, 0)}
                  creditNotesTotalPaise={active.creditNotes.reduce(
                    (sum, note) => sum + note.totalPaise,
                    0,
                  )}
                />
              </>
            ) : null}
          </div>
        </div>

        <div className="border-b border-slate-100 bg-[#eff4ff] px-4 py-2.5 text-[12px] font-bold tracking-wide text-[#354e73]">
          {editingInvoice ? t("editInvoiceTitle") : t("paperLinesHeading")}
        </div>
        {canEdit ? (
          <EditInvoicePanel
            orderId={orderId}
            invoiceId={active.id}
            vehicleId={vehicleId}
            notes={active.notes}
            gstSplit={active.gstSplit}
            amountPaidPaise={active.amountPaidPaise}
            creditNotesTotalPaise={active.creditNotes.reduce(
              (sum, note) => sum + note.totalPaise,
              0,
            )}
            lines={active.lines}
            outsideWorkLines={outsideWorkLines}
            warrantyDocs={active.warrantyDocs}
            editing={editingInvoice}
            onEditingChange={(next) => {
              setEditingInvoice(next);
              if (!next) setDraftTotals(null);
            }}
            onDraftTotalsChange={setDraftTotals}
          />
        ) : null}
        {!editingInvoice ? (
          <InvoiceWarrantyPanel
            orderId={orderId}
            invoiceId={active.id}
            vehicleId={vehicleId}
            emptyLabel={t("invoiceEmpty")}
            lines={active.lines}
            docs={active.warrantyDocs}
            canEdit={canEdit}
            onRequiredValidityChange={setWarrantyFormComplete}
          />
        ) : null}

        <dl className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-slate-200 bg-slate-50 px-4 py-3.5 sm:flex-nowrap sm:justify-between">
          <div>
            <dt className="text-[13px] text-slate-500">{t("taxable")}</dt>
            <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {formatRupees(totals.taxablePaise)}
            </dd>
          </div>
          {active.gstSplit === "CGST_SGST" ? (
            <>
              <div>
                <dt className="text-[13px] text-slate-500">{t("cgst")}</dt>
                <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
                  {formatRupees(totals.cgstPaise)}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-slate-500">{t("sgst")}</dt>
                <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
                  {formatRupees(totals.sgstPaise)}
                </dd>
              </div>
            </>
          ) : (
            <div>
              <dt className="text-[13px] text-slate-500">{t("igst")}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
                {formatRupees(totals.igstPaise)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[13px] text-slate-500">{t("pendingBalance")}</dt>
            <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {formatRupees(totals.pendingBalancePaise)}
            </dd>
          </div>
          {!editingInvoice && active.refundDuePaise > 0 ? (
            <div>
              <dt className="text-[13px] text-slate-500">{t("refundDue")}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold text-amber-800">
                {formatRupees(active.refundDuePaise)}
              </dd>
            </div>
          ) : null}
          <div className="sm:ml-auto sm:text-right">
            <dt className="text-[13px] text-slate-500">{t("paperTotal")}</dt>
            <dd className="mt-0.5 text-[18px] font-bold text-blue-700">
              {formatRupees(totals.totalPaise)}
            </dd>
          </div>
        </dl>

        {canEdit && active.status === "DRAFT" && !editingInvoice ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-4">
            <FinalizeInvoiceForm
              invoiceId={active.id}
              orderId={orderId}
              disabled={warrantyIncomplete || !warrantyFormComplete}
            />
            {warrantyIncomplete || !warrantyFormComplete ? (
              <p className="basis-full text-sm text-amber-800">
                {tw("finalizeBlocked")}
              </p>
            ) : null}
            <p className="basis-full text-[13px] leading-relaxed text-slate-700">
              {t("draftNextStepFinalize")}
            </p>
          </div>
        ) : null}
      </article>

      {active.status === "FINALIZED" ? (
        <div className="space-y-3">
          <div>
            <strong className="block text-[14px] font-semibold text-slate-900">
              {t("afterBillDivider")}
            </strong>
            <p className="mt-1 text-[13px] text-slate-500">
              {t("afterBillHintSelected")}
            </p>
          </div>

          {canEdit || active.payments.length > 0 ? (
            <BillingCollapsibleCard
              title={t("paymentReceivedTitle")}
              hint={t("paymentReceivedHint")}
              defaultOpen={
                active.pendingBalancePaise > 0 || active.payments.length > 0
              }
            >
              <div className="max-w-2xl space-y-4">
                {canEdit ? (
                  <RecordPaymentForm
                    invoiceId={active.id}
                    orderId={orderId}
                    pendingPaise={active.pendingBalancePaise}
                  />
                ) : null}
                <PaymentHistoryList
                  orderId={orderId}
                  invoiceId={active.id}
                  canEdit={canEdit}
                  pendingPaise={active.pendingBalancePaise}
                  payments={active.payments}
                />
              </div>
            </BillingCollapsibleCard>
          ) : null}

          {canEdit &&
          active.amountPaidPaise > 0 &&
          active.refundDuePaise > 0 ? (
            <BillingCollapsibleCard
              title={t("refundCardTitle")}
              hint={t("refundHint")}
              defaultOpen={false}
            >
              <RecordRefundForm
                invoiceId={active.id}
                orderId={orderId}
                refundDuePaise={active.refundDuePaise}
              />
            </BillingCollapsibleCard>
          ) : null}

          {canEdit ? (
            <BillingCollapsibleCard
              title={t("creditNoteCardTitle")}
              hint={t("creditNoteHint")}
              defaultOpen={false}
            >
              <CreditNoteForm
                invoiceId={active.id}
                orderId={orderId}
                gstSplit={active.gstSplit}
              />
            </BillingCollapsibleCard>
          ) : null}

          {active.creditNotes.length > 0 ? (
            <BillingCollapsibleCard
              title={t("creditNotesHistoryTitle")}
              hint={t("creditNotesHistoryHint")}
              defaultOpen={false}
            >
              <ul className="space-y-3">
                {active.creditNotes.map((note) => {
                  const reasonKey =
                    note.reason as "CORRECTION" | "REFUND" | "OTHER";
                  const reasonTone =
                    note.reason === "REFUND"
                      ? "border-sky-200 bg-sky-50 text-sky-800"
                      : note.reason === "OTHER"
                        ? "border-slate-200 bg-slate-100 text-slate-700"
                        : "border-amber-200 bg-amber-50 text-amber-900";
                  return (
                    <li
                      key={note.id}
                      className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50/80 to-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-100/80 px-3.5 py-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[14px] font-bold tabular-nums text-slate-900">
                            {note.creditNoteNumber}
                          </p>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-bold ${reasonTone}`}
                          >
                            {t(`reasons.${reasonKey}`)}
                          </span>
                        </div>
                        <p className="text-[16px] font-bold tabular-nums text-amber-800">
                          −{formatRupees(note.totalPaise)}
                        </p>
                      </div>
                      <div className="space-y-2.5 px-3.5 py-3">
                        {note.notes?.trim() ? (
                          <p className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2 text-[13px] leading-relaxed text-slate-800">
                            <span className="mb-0.5 block text-[11px] font-bold tracking-wide text-amber-700 uppercase">
                              {t("creditNoteMessageLabel")}
                            </span>
                            {note.notes.trim()}
                          </p>
                        ) : null}
                        {note.lines.length > 0 ? (
                          <ul className="space-y-1.5">
                            {note.lines.map((line) => (
                              <li
                                key={line.id}
                                className="flex items-start justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-[13px]"
                              >
                                <span className="min-w-0 font-medium text-slate-800">
                                  {line.description}
                                </span>
                                <span className="shrink-0 tabular-nums font-semibold text-slate-600">
                                  {formatRupees(line.totalPaise)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </BillingCollapsibleCard>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
