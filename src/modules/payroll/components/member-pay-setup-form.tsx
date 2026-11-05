"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  savePayProfileAction,
  type PayrollActionState,
} from "@/app/actions/payroll";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { paiseToRupeesInput } from "@/lib/money";

const initial: PayrollActionState = { ok: false };

type Props = {
  userId: string;
  basicSalaryPaise: number;
};

export function MemberPaySetupForm({ userId, basicSalaryPaise }: Props) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    savePayProfileAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4" id={formId}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="payMode" value="FULL_BASIC" />
      <FormField id={`${formId}-basic`} label={t("basicSalary")}>
        <Input
          id={`${formId}-basic`}
          name="basicRupees"
          defaultValue={paiseToRupeesInput(basicSalaryPaise)}
          inputMode="decimal"
          placeholder="20000"
          className="h-11 min-h-11 w-full"
        />
      </FormField>
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? tc("loading") : t("savePaySetup")}
      </Button>
    </form>
  );
}
