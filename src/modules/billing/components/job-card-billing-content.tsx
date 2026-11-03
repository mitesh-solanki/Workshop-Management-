import { getLocale, getTranslations } from "next-intl/server";
import { formatRupees } from "@/lib/money";
import {
  BillingInvoiceWorkspace,
  type BillingInvoiceCardModel,
} from "@/modules/billing/components/billing-invoice-workspace";
import { InvoicePreviewButton } from "@/modules/billing/components/invoice-preview-button";
import type { InvoicePreviewData } from "@/modules/billing/components/invoice-preview-dialog";
import { PricingLinesTable } from "@/modules/billing/components/pricing-lines-table";
import type { getInvoicesForOrder } from "@/modules/billing/service";
import { listInvoiceWarranties } from "@/modules/warranties/service";
import { requireSession } from "@/lib/session";

type InvoiceList = Awaited<ReturnType<typeof getInvoicesForOrder>>;

export type BillingPreviewContext = {
  garageName: string;
  garageAddress: string | null;
  garageGstin: string | null;
  customerName: string;
  customerPhone: string;
  customerGstin: string | null;
  vehicleRegistration: string;
  vehicleLabel: string;
  jobLabel: string;
  approvedLines: Array<{
    id: string;
    description: string;
    type: "LABOUR" | "PART" | "OUTSIDE";
    typeLabel: string;
    quantity: number;
    unitPricePaise: number;
    taxablePaise: number;
    taxPaise: number;
    totalPaise: number;
  }>;
  approvedTaxablePaise: number;
  approvedTaxPaise: number;
  approvedTotalPaise: number;
  approvedTaxLabel: string;
};

type Props = {
  orderId: string;
  vehicleId: string;
  canEdit: boolean;
  invoices: InvoiceList;
  hasUnbilledApprovedLines: boolean;
  defaultPlaceOfSupplyStateCode: string;
  draftSyncError?: string | null;
  preview: BillingPreviewContext;
};

function formatIssuedAt(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function JobCardBillingContent({
  orderId,
  vehicleId,
  canEdit,
  invoices,
  hasUnbilledApprovedLines,
  defaultPlaceOfSupplyStateCode,
  draftSyncError = null,
  preview,
}: Props) {
  const t = await getTranslations("billing");
  const locale = await getLocale();
  const pdfLocale = locale === "hi" || locale === "gu" ? locale : "en";
  const session = await requireSession();
  const warrantyLists = await Promise.all(
    invoices.map(async (invoice) => ({
      invoiceId: invoice.id,
      docs: await listInvoiceWarranties(session, invoice.id).catch(() => []),
    })),
  );
  const warrantyByInvoice = new Map(
    warrantyLists.map((row) => [row.invoiceId, row.docs]),
  );

  const livePreview: InvoicePreviewData | null =
    preview.approvedLines.length > 0
      ? {
          heading: t("previewTitle"),
          invoiceNumber: null,
          issuedAtLabel: formatIssuedAt(new Date(), locale),
          garageName: preview.garageName,
          garageAddress: preview.garageAddress,
          garagePhone: null,
          garageGstin: preview.garageGstin,
          customerName: preview.customerName,
          customerPhone: preview.customerPhone,
          customerGstin: preview.customerGstin,
          vehicleLabel: preview.vehicleRegistration,
          jobLabel: `${preview.vehicleLabel} · ${preview.jobLabel}`,
          notes: null,
          lines: preview.approvedLines.map((line) => ({
            id: line.id,
            description: line.description,
            typeLabel: line.typeLabel,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            totalPaise: line.totalPaise,
          })),
          taxablePaise: preview.approvedTaxablePaise,
          taxLabel: preview.approvedTaxLabel,
          taxPaise: preview.approvedTaxPaise,
          totalPaise: preview.approvedTotalPaise,
          amountPaidPaise: 0,
          pendingBalancePaise: preview.approvedTotalPaise,
          isPreview: true,
        }
      : null;

  const invoiceCards: BillingInvoiceCardModel[] = invoices.map((invoice) => {
    const taxPaise =
      invoice.gstSplit === "CGST_SGST"
        ? invoice.cgstPaise + invoice.sgstPaise
        : invoice.igstPaise;
    const taxLabel =
      invoice.gstSplit === "CGST_SGST"
        ? t("gstSplit.CGST_SGST")
        : t("gstSplit.IGST");

    return {
      id: invoice.id,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
      gstSplit: invoice.gstSplit,
      taxablePaise: invoice.taxablePaise,
      cgstPaise: invoice.cgstPaise,
      sgstPaise: invoice.sgstPaise,
      igstPaise: invoice.igstPaise,
      totalPaise: invoice.totalPaise,
      amountPaidPaise: invoice.amountPaidPaise,
      pendingBalancePaise: invoice.pendingBalancePaise,
      refundDuePaise: invoice.refundDuePaise,
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      notes: invoice.notes,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        description: line.description,
        type: line.type,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        totalPaise: line.totalPaise,
      })),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amountPaise: payment.amountPaise,
        isRefund: payment.isRefund,
      })),
      creditNotes: invoice.creditNotes.map((note) => ({
        id: note.id,
        creditNoteNumber: note.creditNoteNumber,
        reason: note.reason,
        notes: note.notes,
        totalPaise: note.totalPaise,
        lines: note.lines.map((line) => ({
          id: line.id,
          description: line.description,
          totalPaise: line.totalPaise,
        })),
      })),
      warrantyDocs: (warrantyByInvoice.get(invoice.id) ?? []).map((doc) => ({
        id: doc.id,
        invoiceLineId: doc.invoiceLineId,
        partName: doc.partName,
        warrantyExpiresAt: doc.warrantyExpiresAt,
        storageKey: doc.storageKey,
        contentType: doc.contentType,
        byteSize: doc.byteSize,
        fileName: doc.fileName,
        url: doc.url,
      })),
      preview: {
        heading:
          invoice.status === "FINALIZED"
            ? t("viewBillTitle")
            : t("previewTitle"),
        invoiceNumber: invoice.invoiceNumber,
        issuedAtLabel: formatIssuedAt(
          invoice.finalizedAt ?? invoice.createdAt,
          locale,
        ),
        garageName: preview.garageName,
        garageAddress: preview.garageAddress,
        garagePhone: null,
        garageGstin: preview.garageGstin,
        customerName: invoice.customer.name,
        customerPhone: invoice.customer.phone,
        customerGstin: invoice.customer.gstin,
        vehicleLabel:
          invoice.serviceOrder.vehicle?.registrationNumber ??
          preview.vehicleRegistration,
        jobLabel: preview.jobLabel,
        notes: invoice.notes,
        warranties: (warrantyByInvoice.get(invoice.id) ?? [])
          .filter((doc) => doc.warrantyExpiresAt != null)
          .map((doc) => {
            const expiresAt =
              doc.warrantyExpiresAt instanceof Date
                ? doc.warrantyExpiresAt
                : new Date(doc.warrantyExpiresAt!);
            return {
              partName: doc.partName,
              expiresAtLabel: formatIssuedAt(expiresAt, locale),
            };
          })
          .filter(
            (row) =>
              Boolean(row.partName.trim()) &&
              row.expiresAtLabel !== "Invalid Date",
          ),
        lines: invoice.lines.map((line) => ({
          id: line.id,
          description: line.description,
          typeLabel: line.type,
          quantity: line.quantity,
          unitPricePaise: line.unitPricePaise,
          totalPaise: line.totalPaise,
        })),
        taxablePaise: invoice.taxablePaise,
        taxLabel,
        taxPaise,
        totalPaise: invoice.totalPaise,
        amountPaidPaise: invoice.amountPaidPaise,
        pendingBalancePaise: invoice.pendingBalancePaise,
        isPreview: invoice.status !== "FINALIZED",
      },
    };
  });

  const showLiveDraft =
    invoices.length === 0 && preview.approvedLines.length > 0;

  return (
    <div className="space-y-5">
      {invoices.length === 0 ? (
        <section className="space-y-5">
          {showLiveDraft ? (
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-3.5">
                <div className="min-w-0">
                  <strong className="block text-[15px] text-slate-900">
                    {t("liveDraftTitle")}
                  </strong>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {t("liveDraftHint")}
                  </p>
                </div>
                {livePreview ? (
                  <InvoicePreviewButton data={livePreview} variant="soft" />
                ) : null}
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-[13px]">
                <b className="text-slate-800">{t("workIncluded")}</b>
                <small className="text-slate-500">
                  {t("itemCount", { count: preview.approvedLines.length })}
                </small>
              </div>
              <PricingLinesTable
                showType
                emptyLabel={t("invoiceEmpty")}
                lines={preview.approvedLines.map((line) => ({
                  id: line.id,
                  description: line.description,
                  type: line.type,
                  typeLabel: line.typeLabel,
                  quantity: line.quantity,
                  unitPricePaise: line.unitPricePaise,
                  totalPaise: line.totalPaise,
                }))}
              />
              <dl className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3.5">
                <div>
                  <dt className="text-[13px] text-slate-500">{t("taxable")}</dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
                    {formatRupees(preview.approvedTaxablePaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-slate-500">
                    {preview.approvedTaxLabel}
                  </dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-slate-900">
                    {formatRupees(preview.approvedTaxPaise)}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-[13px] text-slate-500">
                    {t("customerPays")}
                  </dt>
                  <dd className="mt-0.5 text-[15px] font-bold text-blue-700">
                    {formatRupees(preview.approvedTotalPaise)}
                  </dd>
                </div>
              </dl>
              {draftSyncError ? (
                <p
                  className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  {draftSyncError}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {canEdit ? t("emptyNeedPricedLines") : t("emptyReadOnly")}
            </p>
          )}
        </section>
      ) : (
        <BillingInvoiceWorkspace
          orderId={orderId}
          vehicleId={vehicleId}
          canEdit={canEdit}
          pdfLocale={pdfLocale}
          invoices={invoiceCards}
          unbilledLines={preview.approvedLines}
          hasUnbilledApprovedLines={hasUnbilledApprovedLines}
          defaultPlaceOfSupplyStateCode={defaultPlaceOfSupplyStateCode}
        />
      )}
    </div>
  );
}
