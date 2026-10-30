"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatRupees, type Paise } from "@/lib/money";
import { DownloadInspectionReportPdfButton } from "@/modules/inspections/components/download-inspection-report-pdf-button";
import {
  buildInspectionReportCheckedOk,
  buildInspectionReportExternalOnly,
  buildInspectionReportPricedLines,
} from "@/modules/inspections/report-lines";
import {
  LiveMediaGallery,
  type LiveMediaItem,
} from "@/modules/live-link/components/live-media-gallery";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatExpectedCompletionDisplay(
  value: string | Date | null | undefined,
  locale: string,
): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type InspectionReportMedia = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
};

export type InspectionReportItem = {
  id: string;
  label: string;
  quantity: number;
  unitPricePaise: number;
  notes: string | null;
  externalCheck: boolean;
  result?: "OK" | "NEEDS_ATTENTION" | "URGENT" | null;
  media: InspectionReportMedia[];
};

type Props = {
  inspectionId: string;
  customerName: string;
  vehicle: {
    registrationNumber: string;
    make: string;
    model: string;
  };
  expectedCompletion: string | Date | null;
  complaint: string | null;
  recommendedNotes: string | null;
  items: InspectionReportItem[];
};

export function InspectionReportPanel({
  inspectionId,
  customerName,
  vehicle,
  expectedCompletion,
  complaint,
  recommendedNotes,
  items,
}: Props) {
  const t = useTranslations("inspections");
  const locale = useLocale();
  const vehicleLabel = `${vehicle.make} ${vehicle.model}`.trim();
  const complaintText = complaint?.trim() || "";
  const recommendedText = recommendedNotes?.trim() || "";
  const expectedText = formatExpectedCompletionDisplay(
    expectedCompletion,
    locale,
  );

  const sourceItems = items.map((item) => ({
    id: item.id,
    label: item.label,
    notes: item.notes,
    quantity: item.quantity,
    unitPricePaise: item.unitPricePaise,
    externalCheck: item.externalCheck,
    result: item.result,
  }));

  const subSpares = buildInspectionReportPricedLines(sourceItems);
  const grandTotal = subSpares.reduce(
    (sum, line) => sum + line.lineTotalPaise,
    0,
  );
  const checkedOk = buildInspectionReportCheckedOk(sourceItems);
  const externalOnly = buildInspectionReportExternalOnly(sourceItems);

  const mediaItems: LiveMediaItem[] = items.flatMap((item) =>
    item.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      url: m.url,
      itemLabel: item.label,
    })),
  );

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-[15px] font-semibold text-slate-900">
            {t("reportTitle")}
          </h3>
          <p className="text-[13px] text-slate-600">{t("reportHint")}</p>
        </div>
        <DownloadInspectionReportPdfButton
          inspectionId={inspectionId}
          registrationNumber={vehicle.registrationNumber}
          draft={{
            items: subSpares.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPricePaise: line.unitPricePaise,
              lineTotalPaise: line.lineTotalPaise,
            })),
            checkedOkLabels: checkedOk.map((item) => item.label),
            externalLabels: externalOnly.map((item) => item.label),
            expectedCompletion: expectedCompletion
              ? String(
                  expectedCompletion instanceof Date
                    ? expectedCompletion.toISOString()
                    : expectedCompletion,
                )
              : null,
            complaint: complaintText || null,
            recommendedNotes: recommendedText || null,
          }}
        />
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#d7deea] bg-white">
        <div className="space-y-3 border-b border-[#d7deea] px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {t("reportNameLabel")}
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
                {customerName}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {t("selectVehicle")}
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
                {vehicle.registrationNumber}
              </p>
              {vehicleLabel ? (
                <p className="text-[13px] text-slate-600">{vehicleLabel}</p>
              ) : null}
            </div>
          </div>

          {complaintText || expectedText ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {complaintText ? (
                <div>
                  <p className="text-[12px] font-medium text-slate-500">
                    {t("complaint")}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] text-slate-800">
                    {complaintText}
                  </p>
                </div>
              ) : (
                <div />
              )}
              {expectedText ? (
                <div>
                  <p className="text-[12px] font-medium text-slate-500">
                    {t("expectedCompletion")}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
                    {expectedText}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {recommendedText ? (
            <div>
              <p className="text-[12px] font-medium text-slate-500">
                {t("recommendedNotes")}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[14px] text-slate-800">
                {recommendedText}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-5 px-4 py-4 sm:px-5">
          <div>
            <p className="mb-3 text-[13px] font-semibold text-slate-800">
              {t("reportItemsTitle")}
            </p>
            {subSpares.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-[13px] text-slate-600">
                {t("reportItemsEmpty")}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-[10px] border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[50%]">
                          {t("reportDescriptionLabel")}
                        </TableHead>
                        <TableHead className="w-16 text-right">
                          {t("quantityShort")}
                        </TableHead>
                        <TableHead className="w-28 text-right">
                          {t("reportPriceLabel")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subSpares.map((line, index) => (
                        <TableRow key={`${line.description}-${index}`}>
                          <TableCell className="max-w-[14rem] whitespace-normal sm:max-w-[18rem]">
                            <span className="font-medium text-slate-900">
                              {line.description}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {line.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRupees(line.lineTotalPaise as Paise)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-3 text-right text-[14px] font-semibold text-blue-600">
                  {t("reportGrandTotal", {
                    amount: formatRupees(grandTotal as Paise),
                  })}
                </p>
              </>
            )}
          </div>

          {checkedOk.length > 0 ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-800">
                {t("reportCheckedOkTitle")}
              </p>
              <ul className="flex flex-wrap gap-2">
                {checkedOk.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[13px] font-medium text-emerald-800"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {externalOnly.length > 0 ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-800">
                {t("reportExternalTitle")}
              </p>
              <ul className="flex flex-wrap gap-2">
                {externalOnly.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[13px] font-medium text-violet-800"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-3 text-[13px] font-semibold text-slate-800">
              {t("reportPhotosTitle")}
            </p>
            {mediaItems.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-center text-[13px] text-slate-600">
                {t("reportPhotosEmpty")}
              </p>
            ) : (
              <LiveMediaGallery items={mediaItems} />
            )}
          </div>
        </div>

        <div className="border-t border-[#d7deea] px-4 py-4 sm:px-5">
          <p className="text-[12px] font-medium text-red-600">
            {t("reportSuggestionLabel")}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
            {t("reportClosingNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
