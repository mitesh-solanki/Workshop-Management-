"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  giveAdvanceAction,
  giveBonusAction,
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useStripCreateQuery } from "@/hooks/use-open-create-query";
import { todayDateInputValue } from "@/modules/payroll/date";

const initial: PayrollActionState = { ok: false };

type MemberOption = { id: string; label: string };

type Props = {
  kind: "advance" | "bonus";
  members: MemberOption[];
  defaultUserId?: string;
  trigger?: React.ReactNode;
  /** Primary for page CTAs; outline for secondary placements. */
  variant?: "default" | "outline";
  size?: "sm" | "md";
  defaultOpen?: boolean;
};

export function MoneyEntryModal({
  kind,
  members,
  defaultUserId,
  trigger,
  variant = "default",
  size = "md",
  defaultOpen = false,
}: Props) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  useStripCreateQuery(defaultOpen);
  const [userId, setUserId] = useState(defaultUserId ?? members[0]?.id ?? "");
  const [method, setMethod] = useState("CASH");
  const [givenOn, setGivenOn] = useState(todayDateInputValue());
  const action = kind === "advance" ? giveAdvanceAction : giveBonusAction;
  const [state, formAction, pending] = useActionState(action, initial);
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

  const title = kind === "advance" ? t("giveAdvance") : t("giveBonus");
  const description =
    kind === "advance" ? t("giveAdvanceDescription") : t("giveBonusDescription");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setGivenOn(todayDateInputValue());
          setUserId(defaultUserId ?? members[0]?.id ?? "");
          setMethod("CASH");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size={size} className="min-h-11">
            {title}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={formId} action={formAction} className="space-y-6">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="method" value={method} />
            {!defaultUserId ? (
              <FormField id={`${formId}-user`} label={t("columns.member")}>
                <SearchableSelect
                  id={`${formId}-user`}
                  mode="single"
                  trigger="field"
                  value={userId}
                  onChange={setUserId}
                  options={members.map((m) => ({
                    value: m.id,
                    label: m.label,
                  }))}
                  clearable={false}
                  disabled={pending}
                  placeholder={t("membersPlaceholder")}
                  searchPlaceholder={t("membersSearchPlaceholder")}
                  emptyLabel={t("membersEmpty")}
                  className="w-full"
                />
              </FormField>
            ) : null}
            <FormField id={`${formId}-amount`} label={t("amount")}>
              <Input
                id={`${formId}-amount`}
                name="amountRupees"
                inputMode="decimal"
                required
                placeholder="5000"
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
              <Select value={method} onValueChange={setMethod}>
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
            disabled={pending || !userId}
            className="min-h-11"
          >
            {pending ? tc("loading") : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
