"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateBonusAction,
  type PayrollActionState,
} from "@/app/actions/payroll";
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
import { paiseToRupeesInput } from "@/lib/money";
import { toDateInputValue } from "@/modules/payroll/date";

const initial: PayrollActionState = { ok: false };

type Props = {
  bonus: {
    id: string;
    amountPaise: number;
    givenOn: Date | string;
    method: "CASH" | "UPI" | "CARD" | "MIXED";
    note: string | null;
  };
  disabled?: boolean;
};

export function EditBonusModal({ bonus, disabled = false }: Props) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(bonus.method);
  const [givenOn, setGivenOn] = useState(toDateInputValue(bonus.givenOn));
  const [state, formAction, pending] = useActionState(
    updateBonusAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(state.message);
      const id = window.setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setMethod(bonus.method);
          setGivenOn(toDateInputValue(bonus.givenOn));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled}
          aria-label={t("editBonus")}
          title={disabled ? t("bonusLockedIncluded") : undefined}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editBonus")}</DialogTitle>
          <DialogDescription>{t("editBonusDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={formId} action={formAction} className="space-y-6">
            <input type="hidden" name="bonusId" value={bonus.id} />
            <input type="hidden" name="method" value={method} />
            <FormField id={`${formId}-amount`} label={t("amount")}>
              <Input
                id={`${formId}-amount`}
                name="amountRupees"
                inputMode="decimal"
                required
                defaultValue={paiseToRupeesInput(bonus.amountPaise)}
                className="h-11 min-h-11 w-full"
              />
            </FormField>
            <FormField id={`${formId}-date`} label={t("givenOn")}>
              <Input
                id={`${formId}-date`}
                name="givenOn"
                type="date"
                required
                value={givenOn}
                onChange={(e) => setGivenOn(e.target.value)}
                className="h-11 min-h-11 w-full"
              />
            </FormField>
            <FormField id={`${formId}-method`} label={t("paymentMethod")}>
              <Select
                value={method}
                onValueChange={(value) =>
                  setMethod(value as Props["bonus"]["method"])
                }
              >
                <SelectTrigger
                  id={`${formId}-method`}
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
            <FormField id={`${formId}-note`} label={t("note")}>
              <Textarea
                id={`${formId}-note`}
                name="note"
                rows={2}
                maxLength={500}
                defaultValue={bonus.note ?? ""}
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
            {pending ? tc("loading") : t("saveBonus")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
