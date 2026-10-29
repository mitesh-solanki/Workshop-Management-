import { getLocale, getTranslations } from "next-intl/server";
import { formatRupees } from "@/lib/money";
import {
  BillingInvoiceWorkspace,
  type BillingInvoiceCardModel,
} from "@/modules/billing/components/billing-invoice-workspace";
import { CreateInvoiceForm } from "@/modules/billing/components/create-invoice-form";
import { InvoicePreviewButton } from "@/modules/billing/components/invoice-preview-button";
import type { InvoicePreviewData } from "@/modules/billing/components/invoice-preview-dialog";
import type { getInvoicesForOrder } from "@/modules/billing/service";
import { LiveLinkStaffPanel } from "@/modules/live-link/components/live-link-staff-panel";
import { listInvoiceWarranties } from "@/modules/warranties/service";
import { requireSession } from "@/lib/session";

type InvoiceList = Awaited<ReturnType<typeof getInvoicesForOrder>>;

export type BillingPreviewContext = {
  garageName: string;
  garageAddress: string | null;
  garageGstin: string | null;
  customerName: string;
  customerPhone: string;
  vehicleRegistration: string;
  vehicleLabel: string;
  jobLabel: string;
  placeOfSupplyLabel: string;
  approvedLines: Array<{
    id: string;
    description: string;
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
  hasApprovedEstimateLines: boolean;
  hasUnbilledApprovedLines: boolean;
  defaultPlaceOfSupplyStateCode: string;
  preview: BillingPreviewContext;
  liveLinkActive: { id: string; expiresAt: Date | string } | null;
  canEditLiveLink: boolean;
  hasEstimate: boolean;
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
  hasApprovedEstimateLines,
  hasUnbilledApprovedLines,
  defaultPlaceOfSupplyStateCode,
  preview,
  liveLinkActive,
  canEditLiveLink,
  hasEstimate,
}: Props) {
  const t = await getTranslations("billing");
  const tGst = await getTranslations("gst");
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

  function stateName(code: string) {
    try {
      return tGst(`states.${code}`);
    } catch {
      return code;
    }
  }

  const draftPreview: InvoicePreviewData | null =
    hasUnbilledApprovedLines && preview.approvedLines.length > 0
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
          customerGstin: null,
          vehicleLabel: preview.vehicleRegistration,
          jobLabel: `${preview.vehicleLabel} · ${preview.jobLabel}`,
          placeOfSupplyLabel: preview.placeOfSupplyLabel,
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
        customerGstin: null,
        vehicleLabel:
          invoice.serviceOrder.vehicle?.registrationNumber ??
          preview.vehicleRegistration,
        jobLabel: preview.jobLabel,
        placeOfSupplyLabel: `${t("placeOfSupply")}: ${stateName(invoice.placeOfSupplyStateCode)}`,
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

  return (
    <div className="space-y-5">
      {hasEstimate ? (
        <LiveLinkStaffPanel
          orderId={orderId}
          active={liveLinkActive}
          canEdit={canEditLiveLink}
          variant="embed"
        />
      ) : null}

      <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-[17px] font-black text-emerald-700">
          ✓
        </span>
        <div>
          <strong className="text-[13px] font-semibold text-slate-900">
            {hasUnbilledApprovedLines
              ? t("readyForBilling", { count: preview.approvedLines.length })
              : hasApprovedEstimateLines
                ? t("createAnotherEmpty")
                : t("emptyNeedApproval")}
          </strong>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            {t("notEInvoice")}
          </p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <section className="space-y-5">
          {hasUnbilledApprovedLines ? (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]">
                <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3.5">
                  <strong className="block text-[15px] text-slate-900">
                    {t("stepCheckWork")}
                  </strong>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {t("stepCheckWorkHint")}
                  </p>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-[13px]">
                  <b className="text-slate-800">{t("workIncluded")}</b>
                  <small className="text-slate-500">
                    {t("itemCount", { count: preview.approvedLines.length })}
                  </small>
                </div>
                {preview.approvedLines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 text-[14px] text-slate-800">
                      {line.description}
                      <span className="text-slate-500">
                        {" "}
                        · {line.quantity} × {formatRupees(line.unitPricePaise)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold text-slate-900">
                      {formatRupees(line.totalPaise)}
                    </span>
                  </div>
                ))}
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
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]">
                <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3.5">
                  <strong className="block text-[15px] text-slate-900">
                    {t("stepConfirmBill")}
                  </strong>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {t("stepConfirmBillHint")}
                  </p>
                </div>
                <div className="p-4 sm:p-5">
                  {canEdit ? (
                    <CreateInvoiceForm
                      orderId={orderId}
                      defaultPlaceOfSupplyStateCode={
                        defaultPlaceOfSupplyStateCode
                      }
                    />
                  ) : (
                    <p className="text-sm text-slate-600">{t("emptyReadOnly")}</p>
                  )}
                </div>
              </div>

              {draftPreview && canEdit ? (
                <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="text-[13px] text-slate-900">
                      {t("previewBeforeCreate")}
                    </strong>
                    <p className="mt-1 text-[13px] text-slate-600">
                      {t("previewBeforeCreateHint")}
                    </p>
                  </div>
                  <InvoicePreviewButton data={draftPreview} variant="soft" />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {canEdit ? t("emptyNeedApproval") : t("emptyReadOnly")}
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
