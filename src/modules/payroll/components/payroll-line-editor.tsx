"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Eye, Pencil, Trash2 } from "lucide-react";
import {
  deletePayrollLineAction,
  markPayrollLinePaidAction,
  updatePayrollLineAction,
  type PayrollActionState,
} from "@/app/actions/payroll";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import { todayDateInputValue } from "@/modules/payroll/date";

const initial: PayrollActionState = { ok: false };

export type PayrollLineEditorProps = {
  lineId: string;
  memberName: string;
  basicPaise: number;
  bonusPaise: number;
  commissionPaise: number;
  advanceDeductedPaise: number;
  openAdvancePaise: number;
  adjustmentPaise: number;
  adjustmentNote: string | null;
  netPaise: number;
  status: "DRAFT" | "PAID";
  locale: string;
  payrollRunId?: string;
};

function signedPaiseInput(paise: number): string {
  if (paise === 0) return "";
  if (paise < 0) return `-${paiseToRupeesInput(-paise)}`;
  return paiseToRupeesInput(paise);
}

export function PayrollLineActions(props: PayrollLineEditorProps) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [paidOn, setPaidOn] = useState(todayDateInputValue());
  const [advanceRupees, setAdvanceRupees] = useState(() =>
    paiseToRupeesInput(props.advanceDeductedPaise),
  );
  const [payPending, startPay] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [state, formAction, pending] = useActionState(
    updatePayrollLineAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const isPaid = props.status === "PAID";

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(state.message);
      const id = window.setTimeout(() => {
        setEditOpen(false);
        router.refresh();
      }, 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, router]);

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      {!isPaid ? (
        <Dialog
          open={payOpen}
          onOpenChange={(next) => {
            setPayOpen(next);
            if (next) {
              setMethod("CASH");
              setPaidOn(todayDateInputValue());
            }
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" size="default" variant="secondary">
              <Check className="size-4" aria-hidden />
              {t("markPaid")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("markPaid")}</DialogTitle>
              <DialogDescription>
                {t("markPaidConfirm", {
                  name: props.memberName,
                  amount: formatRupees(props.netPaise, props.locale),
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <FormField
                id={`${formId}-paid-on`}
                label={t("paidOn")}
              >
                <Input
                  id={`${formId}-paid-on`}
                  type="date"
                  required
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className="h-11 min-h-11 w-full"
                  disabled={payPending}
                />
              </FormField>
              <FormField
                id={`${formId}-pay-method`}
                label={t("paymentMethod")}
              >
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger
                    id={`${formId}-pay-method`}
                    className="min-h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["CASH", "UPI", "CARD", "MIXED"] as const).map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`methods.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={payPending}>
                  {tc("cancel")}
                </Button>
              </DialogClose>
              <Button
                className="min-h-11"
                disabled={payPending || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)}
                onClick={() => {
                  startPay(async () => {
                    const result = await markPayrollLinePaidAction(
                      props.lineId,
                      method as "CASH" | "UPI" | "CARD" | "MIXED",
                      paidOn,
                    );
                    if (result.ok) {
                      toast.success(result.message ?? t("linePaid"));
                      setPayOpen(false);
                      router.refresh();
                    } else {
                      toast.error(result.message ?? tc("error"));
                    }
                  });
                }}
              >
                {payPending ? t("paying") : t("markPaid")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {isPaid ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                disabled
                aria-label={t("editLockedPaid")}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{t("editLockedPaid")}</TooltipContent>
        </Tooltip>
      ) : (
        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (next) {
              handled.current = null;
              setAdvanceRupees(paiseToRupeesInput(props.advanceDeductedPaise));
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t("editLine")}
              title={t("editLine")}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editLine")}</DialogTitle>
              <DialogDescription>{props.memberName}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <form id={formId} action={formAction} className="space-y-6">
                <input type="hidden" name="lineId" value={props.lineId} />
                <input
                  type="hidden"
                  name="commissionRupees"
                  value={paiseToRupeesInput(props.commissionPaise)}
                />
                {props.openAdvancePaise > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-950">
                      {t("editOpenAdvanceCardTitle")}
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {t("editOpenAdvanceCard", {
                        amount: formatRupees(
                          props.openAdvancePaise,
                          props.locale,
                        ),
                      })}
                    </p>
                  </div>
                ) : null}
                <FormField id={`${formId}-basic`} label={t("basicSalary")}>
                  <Input
                    id={`${formId}-basic`}
                    name="basicRupees"
                    defaultValue={paiseToRupeesInput(props.basicPaise)}
                    inputMode="decimal"
                    className="h-11 min-h-11 w-full"
                  />
                </FormField>
                <FormField id={`${formId}-bonus`} label={t("bonusRupees")}>
                  <Input
                    id={`${formId}-bonus`}
                    name="bonusRupees"
                    defaultValue={paiseToRupeesInput(props.bonusPaise)}
                    inputMode="decimal"
                    className="h-11 min-h-11 w-full"
                  />
                </FormField>
                <FormField
                  id={`${formId}-advance`}
                  label={t("advanceDeductedRupees")}
                  hint={
                    props.openAdvancePaise > 0
                      ? t("advanceDeductHint", {
                          amount: formatRupees(
                            props.openAdvancePaise,
                            props.locale,
                          ),
                        })
                      : t("advanceDeductHintNone")
                  }
                >
                  <Input
                    id={`${formId}-advance`}
                    name="advanceDeductedRupees"
                    value={advanceRupees}
                    onChange={(e) => setAdvanceRupees(e.target.value)}
                    inputMode="decimal"
                    className="h-11 min-h-11 w-full"
                  />
                </FormField>
                <FormField
                  id={`${formId}-adj`}
                  label={t("adjustmentRupees")}
                  hint={t("adjustmentHint")}
                >
                  <Input
                    id={`${formId}-adj`}
                    name="adjustmentRupees"
                    defaultValue={signedPaiseInput(props.adjustmentPaise)}
                    inputMode="decimal"
                    className="h-11 min-h-11 w-full"
                  />
                </FormField>
                <FormField
                  id={`${formId}-adj-note`}
                  label={t("adjustmentNote")}
                >
                  <Textarea
                    id={`${formId}-adj-note`}
                    name="adjustmentNote"
                    rows={2}
                    defaultValue={props.adjustmentNote ?? ""}
                    maxLength={500}
                    className="min-h-16 w-full"
                  />
                </FormField>
              </form>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  {tc("cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                form={formId}
                disabled={pending}
                className="min-h-11"
              >
                {pending ? tc("loading") : t("saveLine")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (deletePending && !next) return;
          setDeleteOpen(next);
        }}
        title={t("deleteLineTitle")}
        description={t("deleteLineConfirm", { name: props.memberName })}
        confirmLabel={t("deleteLine")}
        variant="danger"
        loading={deletePending && deleteOpen}
        onConfirm={() => {
          startDelete(async () => {
            const result = await deletePayrollLineAction(props.lineId);
            if (result.ok) {
              toast.success(result.message ?? t("lineDeleted"));
              setDeleteOpen(false);
              router.refresh();
            } else {
              toast.error(result.message ?? tc("error"));
            }
          });
        }}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
            disabled={deletePending}
            aria-label={t("deleteLine")}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        }
      />

      {props.payrollRunId ? (
        <Button
          asChild
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
        >
          <Link
            href={`/payroll/${props.payrollRunId}`}
            aria-label={t("viewRun")}
            title={t("viewRun")}
          >
            <Eye className="size-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
