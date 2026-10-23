import { getLocale, getTranslations } from "next-intl/server";
import { formatRupees } from "@/lib/money";
import { CreateInvoiceForm } from "@/modules/billing/components/create-invoice-form";
import { CreditNoteForm } from "@/modules/billing/components/credit-note-form";
import { DownloadInvoicePdfButton } from "@/modules/billing/components/download-invoice-pdf-button";
import { FinalizeInvoiceForm } from "@/modules/billing/components/finalize-invoice-form";
import { RecordPaymentForm } from "@/modules/billing/components/record-payment-form";
import { RecordRefundForm } from "@/modules/billing/components/record-refund-form";
import type { getInvoicesForOrder } from "@/modules/billing/service";

type InvoiceList = Awaited<ReturnType<typeof getInvoicesForOrder>>;

type Props = {
  orderId: string;
  canEdit: boolean;
  invoices: InvoiceList;
  /** True when the current estimate has at least one approved line. */
  hasApprovedEstimateLines: boolean;
  /** GST state code from the vehicle — default place of supply. */
  defaultPlaceOfSupplyStateCode: string;
};

export async function JobCardBillingContent({
  orderId,
  canEdit,
  invoices,
  hasApprovedEstimateLines,
  defaultPlaceOfSupplyStateCode,
}: Props) {
  const t = await getTranslations("billing");
  const locale = await getLocale();
  const pdfLocale =
    locale === "hi" || locale === "gu" ? locale : "en";

  return (
    <div className="space-y-5 px-5 py-4 sm:px-6">
      <p className="text-caption text-slate-500">{t("notEInvoice")}</p>

      {invoices.length === 0 ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-600">
            {canEdit
              ? hasApprovedEstimateLines
                ? t("emptyHint")
                : t("emptyNeedApproval")
              : t("emptyReadOnly")}
          </p>
          {canEdit && hasApprovedEstimateLines ? (
            <CreateInvoiceForm
              orderId={orderId}
              defaultPlaceOfSupplyStateCode={defaultPlaceOfSupplyStateCode}
            />
          ) : null}
        </section>
      ) : (
        <ul className="space-y-4">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="space-y-3 rounded-lg border border-slate-200 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {invoice.invoiceNumber ?? t("draftLabel")}
                  </p>
                  <p className="text-caption text-slate-500">
                    {t(`statuses.${invoice.status}`)}
                    {" · "}
                    {t(`gstSplit.${invoice.gstSplit}`)}
                    {" · "}
                    {formatRupees(invoice.totalPaise)}
                  </p>
                </div>
                {invoice.status === "FINALIZED" ? (
                  <DownloadInvoicePdfButton
                    orderId={orderId}
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    locale={pdfLocale}
                  />
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-caption text-slate-500">{t("taxable")}</dt>
                  <dd className="font-medium text-slate-900">
                    {formatRupees(invoice.taxablePaise)}
                  </dd>
                </div>
                {invoice.gstSplit === "CGST_SGST" ? (
                  <>
                    <div>
                      <dt className="text-caption text-slate-500">{t("cgst")}</dt>
                      <dd className="font-medium text-slate-900">
                        {formatRupees(invoice.cgstPaise)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-slate-500">{t("sgst")}</dt>
                      <dd className="font-medium text-slate-900">
                        {formatRupees(invoice.sgstPaise)}
                      </dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt className="text-caption text-slate-500">{t("igst")}</dt>
                    <dd className="font-medium text-slate-900">
                      {formatRupees(invoice.igstPaise)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-caption text-slate-500">
                    {t("pendingBalance")}
                  </dt>
                  <dd className="font-medium text-slate-900">
                    {formatRupees(invoice.pendingBalancePaise)}
                  </dd>
                </div>
                {invoice.refundDuePaise > 0 ? (
                  <div>
                    <dt className="text-caption text-slate-500">{t("refundDue")}</dt>
                    <dd className="font-medium text-amber-800">
                      {formatRupees(invoice.refundDuePaise)}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {invoice.lines.length > 0 ? (
                <ul className="divide-y overflow-hidden rounded-md border border-slate-100">
                  {invoice.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 text-slate-800">
                        {line.description}
                        <span className="ml-1 text-caption text-slate-500">
                          · {line.quantity} × {formatRupees(line.unitPricePaise)}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium text-slate-900">
                        {formatRupees(line.totalPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {canEdit && invoice.status === "DRAFT" ? (
                <FinalizeInvoiceForm invoiceId={invoice.id} orderId={orderId} />
              ) : null}

              {canEdit && invoice.status === "FINALIZED" ? (
                <div className="space-y-4 border-t border-slate-100 pt-3">
                  <RecordPaymentForm
                    invoiceId={invoice.id}
                    orderId={orderId}
                    pendingPaise={invoice.pendingBalancePaise}
                  />
                  <RecordRefundForm
                    invoiceId={invoice.id}
                    orderId={orderId}
                    refundDuePaise={invoice.refundDuePaise}
                  />
                  <CreditNoteForm invoiceId={invoice.id} orderId={orderId} />
                </div>
              ) : null}

              {invoice.payments.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-caption font-medium text-slate-600">
                    {t("payments")}
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {invoice.payments.map((payment) => (
                      <li key={payment.id}>
                        {payment.isRefund ? t("refundPaymentLabel") : t(`methods.${payment.method}`)}
                        {" · "}
                        {formatRupees(payment.amountPaise)}
                        {payment.isRefund
                          ? ` · ${t(`methods.${payment.method}`)}`
                          : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {invoice.creditNotes.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-caption font-medium text-slate-600">
                    {t("creditNotes")}
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {invoice.creditNotes.map((note) => (
                      <li key={note.id}>
                        {note.creditNoteNumber} · {t(`reasons.${note.reason}`)} ·{" "}
                        {formatRupees(note.totalPaise)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && invoices.length > 0 && hasApprovedEstimateLines ? (
        <section className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm text-slate-600">{t("createAnotherHint")}</p>
          <CreateInvoiceForm
            orderId={orderId}
            defaultPlaceOfSupplyStateCode={defaultPlaceOfSupplyStateCode}
          />
        </section>
      ) : null}
    </div>
  );
}
