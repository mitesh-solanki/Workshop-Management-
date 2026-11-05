"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  AddPayrollForm,
  type AddPayrollMember,
} from "@/modules/payroll/components/add-payroll-form";

type Props = {
  yearMonth: string;
  payrollMember: AddPayrollMember | null;
  disabled?: boolean;
  defaultOpen?: boolean;
};

export function AddMemberPayrollModal({
  yearMonth,
  payrollMember,
  disabled = false,
  defaultOpen = false,
}: Props) {
  const t = useTranslations("payroll");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen && !disabled);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (defaultOpen && !disabled) setOpen(true);
  }, [defaultOpen, yearMonth, disabled]);

  function changeMonth(next: string) {
    if (!/^\d{4}-\d{2}$/.test(next) || next === yearMonth) return;
    startTransition(() => {
      router.replace(`${pathname}?month=${next}&addPayroll=1`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next && defaultOpen) {
          startTransition(() => {
            router.replace(`${pathname}?month=${yearMonth}`);
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size="md"
          className="min-h-11"
          disabled={disabled}
          title={disabled ? t("addPayrollDisabledHint") : undefined}
        >
          {t("addPayroll")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("addPayrollTitle")}</DialogTitle>
          <DialogDescription>
            {t("memberAddPayrollDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <FormField id="member-add-payroll-month" label={t("filterMonth")}>
            <Input
              id="member-add-payroll-month"
              type="month"
              value={yearMonth}
              disabled={pending}
              onChange={(e) => changeMonth(e.target.value)}
              className="min-h-11 max-w-56"
            />
          </FormField>

          {payrollMember ? (
            <AddPayrollForm
              key={`${yearMonth}-${payrollMember.id}`}
              yearMonth={yearMonth}
              members={[payrollMember]}
              lockedMemberId={payrollMember.id}
              embedded
            />
          ) : (
            <p className="py-8 text-center text-body text-muted-foreground">
              {t("memberAlreadyOnPayrollDescription")}
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
