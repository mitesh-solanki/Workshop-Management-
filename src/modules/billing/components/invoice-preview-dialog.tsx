"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRupees } from "@/lib/money";

export type InvoicePreviewLine = {
  id: string;
  description: string;
  typeLabel: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
};

export type InvoicePreviewWarranty = {
  partName: string;
  expiresAtLabel: string;
};

export type InvoicePreviewData = {
  heading: string;
  invoiceNumber: string | null;
  issuedAtLabel: string;
  garageName: string;
  garageAddress: string | null;
  garagePhone: string | null;
  garageGstin: string | null;
  customerName: string;
  customerPhone: string;
  customerGstin: string | null;
  vehicleLabel: string;
  jobLabel: string;
  notes: string | null;
  warranties?: InvoicePreviewWarranty[];
  lines: InvoicePreviewLine[];
  taxablePaise: number;
  taxLabel: string;
  taxPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  pendingBalancePaise: number;
  isPreview: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: InvoicePreviewData | null;
  onPrint?: () => void;
};

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  data,
  onPrint,
}: Props) {
  const t = useTranslations("billing");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[920px] gap-0 overflow-hidden border-0 bg-[#eff3f8] p-0 shadow-[0_25px_70px_rgba(5,16,27,0.32)] sm:max-w-[920px] sm:rounded-[14px]"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-4 sm:px-[22px]">
          <div className="min-w-0 text-left">
            <DialogTitle className="text-[15px] font-semibold text-[#172a42]">
              {data?.heading ?? t("previewTitle")}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-[#6c7a8b]">
              {t("previewHint")}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {onPrint ? (
              <Button type="button" variant="outline" size="sm" onClick={onPrint}>
                {t("printPdf")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t("closePreview")}
            </Button>
          </div>
        </DialogHeader>

        {data ? (
          <div className="max-h-[calc(95dvh-5rem)] overflow-y-auto px-[17px] pb-6">
            <article
              id="invoice-preview-paper"
              className="mx-auto w-full max-w-[790px] rounded-[5px] bg-white px-[18px] py-[22px] text-[#172a42] shadow-[0_4px_18px_rgba(33,48,74,0.09)] sm:px-11 sm:py-[38px] print:shadow-none"
            >
              <div className="flex flex-wrap items-start justify-between gap-[15px] border-b-2 border-[#2559df] pb-6">
                <div>
                  <div className="mb-[9px] grid size-[43px] place-items-center rounded-[10px] bg-[#285de5] text-lg font-black text-white">
                    {data.garageName.slice(0, 2).toUpperCase()}
                  </div>
                  <h2 className="m-0 text-[19px] font-semibold tracking-[0.5px]">
                    {data.garageName.toUpperCase()}
                  </h2>
                  {data.garageAddress ? (
                    <p className="mt-1 text-[11px] text-[#6c7a8b]">
                      {data.garageAddress}
                    </p>
                  ) : null}
                  {data.garagePhone ? (
                    <p className="mt-1 text-[11px] text-[#6c7a8b]">
                      {data.garagePhone}
                    </p>
                  ) : null}
                  {data.garageGstin ? (
                    <p className="mt-1 text-[11px] font-semibold text-[#172a42]">
                      {t("paperGstin", { gstin: data.garageGstin })}
                    </p>
                  ) : null}
                </div>
                <div className="text-left sm:text-right">
                  <h1 className="m-0 mb-2.5 text-[25px] font-semibold tracking-[1.3px] text-[#2254cd]">
                    {t("paperInvoiceTitle")}
                  </h1>
                  <span className="block text-[11px] font-extrabold text-[#172a42]">
                    {data.invoiceNumber ?? t("previewNotIssued")}
                  </span>
                  <p className="mt-1 text-[11px] text-[#6c7a8b]">
                    {data.issuedAtLabel}
                  </p>
                </div>
              </div>

              <div className="my-[27px] grid gap-5 sm:grid-cols-2">
                <div>
                  <small className="mb-2 block text-[10px] font-extrabold tracking-[1px] text-[#7a8899]">
                    {t("paperBillTo")}
                  </small>
                  <strong className="block text-[13px]">{data.customerName}</strong>
                  <p className="mt-1 text-[11px] text-[#67788c]">
                    {data.customerPhone}
                  </p>
                  {data.customerGstin ? (
                    <p className="mt-1 text-[11px] text-[#67788c]">
                      {t("paperGstin", { gstin: data.customerGstin })}
                    </p>
                  ) : null}
                </div>
                <div>
                  <small className="mb-2 block text-[10px] font-extrabold tracking-[1px] text-[#7a8899]">
                    {t("paperVehicleJob")}
                  </small>
                  <strong className="block text-[13px]">{data.vehicleLabel}</strong>
                  <p className="mt-1 text-[11px] text-[#67788c]">{data.jobLabel}</p>
                </div>
              </div>

              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#eff4ff] text-left text-[11px] text-[#354e73]">
                    <th className="px-2.5 py-[13px] font-semibold">
                      {t("lineDescription")}
                    </th>
                    <th className="px-2.5 py-[13px] text-right font-semibold">
                      {t("quantity")}
                    </th>
                    <th className="px-2.5 py-[13px] text-right font-semibold">
                      {t("unitPrice")}
                    </th>
                    <th className="px-2.5 py-[13px] text-right font-semibold">
                      {t("paperAmount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.id} className="border-b border-[#e7ebf2]">
                      <td className="px-2.5 py-3.5">
                        <b className="font-semibold">{line.description}</b>
                        <small className="mt-1 block text-[#8491a3]">
                          {line.typeLabel}
                        </small>
                      </td>
                      <td className="px-2.5 py-3.5 text-right">{line.quantity}</td>
                      <td className="px-2.5 py-3.5 text-right">
                        {formatRupees(line.unitPricePaise)}
                      </td>
                      <td className="px-2.5 py-3.5 text-right">
                        {formatRupees(line.totalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-[23px] grid gap-6 sm:grid-cols-[1fr_265px] sm:gap-[25px]">
                <div className="text-[11px]">
                  {data.notes?.trim() ? (
                    <>
                      <b className="font-semibold">{t("paperCustomerNote")}</b>
                      <p className="mt-1 text-[#617187]">{data.notes.trim()}</p>
                    </>
                  ) : null}
                  {data.warranties && data.warranties.length > 0 ? (
                    <div className={data.notes?.trim() ? "mt-4" : undefined}>
                      <b className="font-semibold">{t("paperWarranty")}</b>
                      <ul className="mt-1 space-y-1 text-[#617187]">
                        {data.warranties.map((row) => (
                          <li key={`${row.partName}-${row.expiresAtLabel}`}>
                            {row.partName}
                            {" · "}
                            {t("paperWarrantyExpires", {
                              date: row.expiresAtLabel,
                            })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {data.isPreview ? (
                    <p
                      className={
                        data.notes?.trim() ||
                        (data.warranties && data.warranties.length > 0)
                          ? "mt-[30px] text-[10px] text-[#9ba7b5]"
                          : "text-[10px] text-[#9ba7b5]"
                      }
                    >
                      {t("paperPreviewTaxNote")}
                    </p>
                  ) : (
                    <p
                      className={
                        data.notes?.trim() ||
                        (data.warranties && data.warranties.length > 0)
                          ? "mt-[30px] text-[10px] text-[#9ba7b5]"
                          : "text-[10px] text-[#9ba7b5]"
                      }
                    >
                      {t("notEInvoice")}
                    </p>
                  )}
                </div>
                <div className="text-[12px]">
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-[#6d7c8d]">{t("taxable")}</span>
                    <b>{formatRupees(data.taxablePaise)}</b>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-[#6d7c8d]">{data.taxLabel}</span>
                    <b>{formatRupees(data.taxPaise)}</b>
                  </div>
                  <div className="flex justify-between gap-3 border-y border-[#dfe7f4] py-[13px] text-[#2454c9]">
                    <b>{t("paperTotal")}</b>
                    <strong className="text-[17px]">
                      {formatRupees(data.totalPaise)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-[#6d7c8d]">{t("amountPaidLabel")}</span>
                    <b>{formatRupees(data.amountPaidPaise)}</b>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-[#6d7c8d]">{t("pendingBalance")}</span>
                    <b>{formatRupees(data.pendingBalancePaise)}</b>
                  </div>
                </div>
              </div>

              <footer className="mt-[35px] border-t border-[#e1e7ef] pt-5 text-center text-[10px] text-[#8491a3]">
                {t("paperFooter")}
              </footer>
            </article>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
