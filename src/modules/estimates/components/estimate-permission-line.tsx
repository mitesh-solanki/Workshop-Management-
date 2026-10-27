"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteEstimateLineAction } from "@/app/actions/estimates";
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
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { toast } from "@/components/ui/toast";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CompactLineApproval } from "@/modules/estimates/components/compact-line-approval";
import { LineApprovalForm } from "@/modules/estimates/components/line-approval-form";
import type {
  EstimateApprovalStateValue,
  EstimateLineTypeValue,
} from "@/modules/estimates/schema";

type Props = {
  orderId: string;
  canEdit: boolean;
  index: number;
  line: {
    id: string;
    description: string;
    type: string;
    quantity: number;
    unitPricePaise: number;
    hsnOrSac: string | null;
    gstRatePercent: number;
    approvalState: EstimateApprovalStateValue;
    totalPaise: number;
    partId?: string | null;
  };
};

const actionBtnClass =
  "size-9 min-h-9 min-w-9 border border-slate-300 bg-white shadow-xs";

function approvalTone(state: string) {
  if (state === "APPROVED") return "agreed";
  if (state === "REJECTED") return "rejected";
  return "waiting";
}

export function EstimatePermissionLine({
  orderId,
  canEdit,
  index,
  line,
}: Props) {
  const t = useTranslations("estimates");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, startRemove] = useTransition();
  const tone = approvalTone(line.approvalState);
  const typeKey =
    line.type === "PART" || line.type === "LABOUR" ? line.type : "LABOUR";

  function openDelete(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDeleteOpen(true);
  }

  function onConfirmDelete() {
    startRemove(async () => {
      const result = await deleteEstimateLineAction(orderId, line.id);
      if (result.ok) {
        setDeleteOpen(false);
        toast.success(t("lineRemoved"));
        return;
      }
      toast.error(result.message ?? t("errors.lineBilled"));
    });
  }

  function toggleOpen() {
    if (!canEdit) return;
    setOpen((value) => !value);
  }

  return (
    <li className="list-none">
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        aria-expanded={canEdit ? open : undefined}
        className={cn(
          "flex w-full flex-wrap items-center gap-3 px-4 py-3.5",
          open && "bg-blue-50/70",
          canEdit && "cursor-pointer",
        )}
        onClick={canEdit ? toggleOpen : undefined}
        onKeyDown={
          canEdit
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleOpen();
                }
              }
            : undefined
        }
      >
        <span className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-slate-100 text-[13px] font-extrabold text-slate-600">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <b className="block text-[14px] font-semibold text-slate-900">
            {line.description}
          </b>
          <small className="mt-0.5 block text-[13px] text-slate-500">
            {`${t(`lineTypes.${typeKey as EstimateLineTypeValue}`)} · ${line.quantity} × ${formatRupees(line.unitPricePaise)}`}
            {line.hsnOrSac ? ` · ${line.hsnOrSac}` : null}
            {` · GST ${line.gstRatePercent}%`}
          </small>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
          <strong className="text-[15px] font-semibold text-slate-900">
            {formatRupees(line.totalPaise)}
          </strong>
          <span
            className={
              tone === "agreed"
                ? "rounded-full bg-emerald-50 px-2.5 py-1.5 text-[12px] font-bold text-emerald-800"
                : tone === "rejected"
                  ? "rounded-full bg-red-50 px-2.5 py-1.5 text-[12px] font-bold text-red-700"
                  : "rounded-full bg-amber-50 px-2.5 py-1.5 text-[12px] font-bold text-amber-800"
            }
          >
            {t(`approvalStatesShort.${line.approvalState}`)}
          </span>
          {canEdit && !open && line.approvalState === "PENDING" ? (
            <CompactLineApproval
              orderId={orderId}
              lineId={line.id}
              approvalState={line.approvalState}
              description={line.description}
              quantity={line.quantity}
              unitPricePaise={line.unitPricePaise}
            />
          ) : null}
          {canEdit ? (
            <div
              className="flex items-center gap-1.5"
              data-row-stop
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {open ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={cn(
                    actionBtnClass,
                    "text-slate-600 hover:bg-slate-50",
                  )}
                  aria-label={t("cancelEdit")}
                  title={t("cancelEdit")}
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={cn(
                      actionBtnClass,
                      "text-blue-700 hover:border-blue-300 hover:bg-blue-50",
                    )}
                    aria-label={t("editPermissionDetails")}
                    title={t("editPermissionDetails")}
                    aria-expanded={open}
                    onClick={() => setOpen(true)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={cn(
                      actionBtnClass,
                      "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                    )}
                    aria-label={t("removeLine")}
                    title={t("removeLine")}
                    disabled={removing}
                    onClick={openDelete}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <SmoothAccordion open={open}>
          <div className="border-t border-slate-300 bg-[#fbfcff] px-3 py-3 sm:px-4">
            <LineApprovalForm
              orderId={orderId}
              lineId={line.id}
              lineType={typeKey as EstimateLineTypeValue}
              currentState={line.approvalState}
              description={line.description}
              quantity={line.quantity}
              unitPricePaise={line.unitPricePaise}
              initialPartId={line.partId}
              onSaved={() => setOpen(false)}
            />
          </div>
        </SmoothAccordion>
      ) : null}
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (removing) return;
          setDeleteOpen(next);
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>{t("deleteLineTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteLineConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={removing}
              >
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={removing}
              onClick={onConfirmDelete}
            >
              {t("removeLine")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

type HistoryProps = {
  title: string;
  hint: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function SmoothHistoryPanel({
  title,
  hint,
  children,
  defaultOpen = false,
}: HistoryProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[13px] border border-slate-300">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3.5 text-left text-[13px] font-semibold text-slate-800"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="inline-flex items-center gap-1 font-normal text-slate-600">
          {hint}
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <SmoothAccordion open={open}>
        <div className="border-t border-slate-300">{children}</div>
      </SmoothAccordion>
    </div>
  );
}
