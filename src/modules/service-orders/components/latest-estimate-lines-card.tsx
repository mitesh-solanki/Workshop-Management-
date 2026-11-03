"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  deleteJobCardEstimateLineAction,
  updateJobCardEstimateLineAction,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import {
  formatRupees,
  isZeroRupeesInput,
  paiseToRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import { NoteSuggestInput } from "@/modules/inspections/components/note-suggest-input";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

export type LatestEstimateLine = {
  id: string;
  type: "LABOUR" | "PART" | "OUTSIDE";
  description: string;
  quantity: number;
  unitPricePaise: number;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  sourceOrderLineId?: string | null;
};

type Props = {
  orderId: string;
  lines: LatestEstimateLine[];
  hidePrices?: boolean;
  canEdit?: boolean;
  defaultOpen?: boolean;
  /** Outside work: description + amount only (quantity fixed at 1). */
  hideQuantity?: boolean;
  amountLabel?: string;
  /** Override the blue header hint (e.g. Outside Work wording). */
  hint?: string;
  /** Link to the full estimate page for deeper edits. */
  estimateHref?: string | null;
};

const actionBtnClass =
  "inline-flex size-11 min-h-11 min-w-11 items-center justify-center border border-slate-300 bg-white p-0 shadow-xs [&_svg]:size-5 [&_svg]:shrink-0";
const controlClass =
  "h-11 min-h-11 w-full rounded-lg border-slate-300 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-blue-600/25";
/** Same locked widths as Added Items so view ↔ edit does not reflow. */
const qtyColClass = "w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem]";
const priceColClass = "w-36 min-w-36 max-w-36";
const actionsColClass = "w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem]";

function parsePricePaise(raw: string, fallback: Paise): Paise {
  const parsed = parseRupeesToPaise(raw);
  return parsed === null ? fallback : parsed;
}

export function LatestEstimateLinesCard({
  orderId,
  lines,
  hidePrices = false,
  canEdit = false,
  defaultOpen = true,
  hideQuantity = false,
  amountLabel,
  hint,
  estimateHref = null,
}: Props) {
  const t = useTranslations("orders");
  const te = useTranslations("estimates");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteLine, setDeleteLine] = useState<LatestEstimateLine | null>(null);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftQty, setDraftQty] = useState(1);
  const [draftPricePaise, setDraftPricePaise] = useState<Paise>(0);
  const [priceInputKey, setPriceInputKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const priceColumnLabel = amountLabel ?? t("unitPrice");
  const headerHint = hint ?? t("latestEstimateHint");

  const approvedLines = useMemo(
    () => lines.filter((line) => line.approvalState === "APPROVED"),
    [lines],
  );

  if (approvedLines.length === 0) return null;

  function beginEdit(line: LatestEstimateLine) {
    setEditingId(line.id);
    setDraftDescription(line.description);
    setDraftQty(hideQuantity ? 1 : line.quantity);
    setDraftPricePaise(line.unitPricePaise as Paise);
    setPriceInputKey((key) => key + 1);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(line: LatestEstimateLine) {
    const formData = new FormData();
    formData.set("description", draftDescription.trim());
    formData.set("quantity", String(hideQuantity ? 1 : draftQty));
    formData.set("unitPriceRupees", paiseToRupeesInput(draftPricePaise));
    startTransition(async () => {
      const result = await updateJobCardEstimateLineAction(
        orderId,
        line.id,
        { ok: false },
        formData,
      );
      if (!result.ok) {
        toast.error(result.message ?? te("errors.createFailed"));
        return;
      }
      toast.success(t("latestEstimateLineSaved"));
      setEditingId(null);
      router.refresh();
    });
  }

  function onConfirmDelete() {
    if (!deleteLine) return;
    startTransition(async () => {
      const result = await deleteJobCardEstimateLineAction(
        orderId,
        deleteLine.id,
      );
      if (!result.ok) {
        toast.error(result.message ?? te("errors.lineBilled"));
        return;
      }
      toast.success(t("latestEstimateLineRemoved"));
      setDeleteLine(null);
      if (editingId === deleteLine.id) setEditingId(null);
      router.refresh();
    });
  }

  const cellPad = "align-middle py-2.5";

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-blue-200">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open ? t("latestEstimateCollapse") : t("latestEstimateExpand")
        }
        className="flex w-full cursor-pointer items-start gap-3 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100/60"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-blue-950">
            {t("latestEstimateTitle")}
          </span>
          <span className="mt-0.5 block text-[13px] font-medium text-blue-900/75">
            {headerHint}
          </span>
        </span>
        {estimateHref ? (
          <Link
            href={estimateHref}
            className="inline-flex h-11 min-h-11 shrink-0 items-center rounded-lg border border-blue-300 bg-white px-3 text-[13px] font-semibold text-blue-800 hover:bg-blue-50"
            onClick={(event) => event.stopPropagation()}
          >
            {t("openEstimate")}
          </Link>
        ) : null}
      </button>
      <SmoothAccordion open={open}>
        <div className="border-t border-slate-300 bg-white">
          <Table className="table-fixed">
            <TableHeader className="bg-slate-100 [&_tr]:border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-0 text-left text-slate-700">
                  {t("lineDescription")}
                </TableHead>
                {hideQuantity ? null : (
                  <TableHead
                    className={cn(
                      qtyColClass,
                      "whitespace-nowrap text-center text-slate-700",
                    )}
                  >
                    {t("quantity")}
                  </TableHead>
                )}
                {!hidePrices ? (
                  <TableHead
                    className={cn(priceColClass, "text-center text-slate-700")}
                  >
                    {priceColumnLabel}
                  </TableHead>
                ) : null}
                {canEdit ? (
                  <TableHead
                    className={cn(actionsColClass, "text-right text-slate-700")}
                  >
                    {t("actions")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedLines.map((line) => {
                const editing = canEdit && editingId === line.id;
                return (
                  <TableRow
                    key={line.id}
                    className={cn(
                      editing && "bg-blue-50/40 hover:bg-blue-50/40",
                    )}
                  >
                    <TableCell
                      className={cn("min-w-0 max-w-0 whitespace-normal", cellPad)}
                    >
                      {editing ? (
                        hideQuantity ? (
                          <NoteSuggestInput
                            id={`estimate-desc-${line.id}`}
                            required
                            maxLength={500}
                            value={draftDescription}
                            suggestionMode="outsideWork"
                            onValueChange={setDraftDescription}
                            className={controlClass}
                            placeholder={t("outsideWorkDescriptionPlaceholder")}
                          />
                        ) : (
                          <Input
                            id={`estimate-desc-${line.id}`}
                            required
                            maxLength={500}
                            value={draftDescription}
                            onChange={(event) =>
                              setDraftDescription(event.target.value)
                            }
                            className={controlClass}
                            aria-label={t("lineDescription")}
                          />
                        )
                      ) : (
                        <span className="truncate text-[14px] font-medium text-slate-900">
                          {line.description}
                        </span>
                      )}
                    </TableCell>
                    {hideQuantity ? null : (
                      <TableCell
                        className={cn(
                          qtyColClass,
                          cellPad,
                          "text-center tabular-nums text-slate-700",
                        )}
                      >
                        {editing ? (
                          <div className="flex h-11 min-h-11 items-center justify-center">
                            <QuantityStepper
                              id={`estimate-qty-${line.id}`}
                              name={`estimate-qty-${line.id}`}
                              label={t("quantity")}
                              defaultValue={line.quantity}
                              min={1}
                              hideLabel
                              onValueChange={setDraftQty}
                            />
                          </div>
                        ) : (
                          <span className="inline-flex h-11 min-h-11 w-full items-center justify-center tabular-nums">
                            {line.quantity}
                          </span>
                        )}
                      </TableCell>
                    )}
                    {!hidePrices ? (
                      <TableCell
                        className={cn(
                          priceColClass,
                          cellPad,
                          "tabular-nums text-slate-900",
                        )}
                      >
                        {editing ? (
                          <Input
                            key={`estimate-price-${line.id}-${priceInputKey}`}
                            id={`estimate-price-${line.id}`}
                            type="text"
                            inputMode="decimal"
                            required
                            defaultValue={paiseToRupeesInput(draftPricePaise)}
                            className={cn(controlClass, "tabular-nums")}
                            aria-label={priceColumnLabel}
                            onFocus={(event) => {
                              if (
                                isZeroRupeesInput(event.currentTarget.value)
                              ) {
                                event.currentTarget.select();
                              }
                            }}
                            onBeforeInput={(event) => {
                              const data = (event.nativeEvent as InputEvent)
                                .data;
                              if (data == null || data === "") return;
                              if (!/^[\d.]+$/.test(data)) event.preventDefault();
                            }}
                            onInput={(event) => {
                              const el = event.currentTarget;
                              const next = sanitizeRupeesTyping(el.value);
                              if (el.value !== next) el.value = next;
                              setDraftPricePaise(
                                parsePricePaise(next, draftPricePaise),
                              );
                            }}
                          />
                        ) : (
                          <span className="inline-flex h-11 min-h-11 w-full items-center justify-center text-[14px] font-bold tabular-nums">
                            {formatRupees(line.unitPricePaise, locale)}
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                    {canEdit ? (
                      <TableCell
                        className={cn(actionsColClass, cellPad, "text-right")}
                      >
                        <div className="flex h-11 min-h-11 items-center justify-end gap-3">
                          {editing ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                loading={pending}
                                disabled={!draftDescription.trim()}
                                className={cn(
                                  actionBtnClass,
                                  "text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
                                )}
                                aria-label={t("latestEstimateSave")}
                                title={t("latestEstimateSave")}
                                onClick={() => saveEdit(line)}
                              >
                                <Check className="size-5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={pending}
                                className={cn(
                                  actionBtnClass,
                                  "text-slate-700 hover:bg-slate-50",
                                )}
                                aria-label={t("cancelEdit")}
                                title={t("cancelEdit")}
                                onClick={cancelEdit}
                              >
                                <X className="size-5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={pending || editingId != null}
                                className={cn(
                                  actionBtnClass,
                                  "text-blue-700 hover:border-blue-300 hover:bg-blue-50",
                                )}
                                aria-label={t("latestEstimateEdit")}
                                title={t("latestEstimateEdit")}
                                onClick={() => beginEdit(line)}
                              >
                                <Pencil className="size-5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={pending || editingId != null}
                                className={cn(
                                  actionBtnClass,
                                  "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                                )}
                                aria-label={t("latestEstimateDelete")}
                                title={t("latestEstimateDelete")}
                                onClick={() => setDeleteLine(line)}
                              >
                                <Trash2 className="size-5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SmoothAccordion>

      <Dialog
        open={deleteLine != null}
        onOpenChange={(next) => {
          if (pending) return;
          if (!next) setDeleteLine(null);
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>{t("latestEstimateDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("latestEstimateDeleteBody", {
                description: deleteLine?.description ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              onClick={onConfirmDelete}
            >
              {t("latestEstimateDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
