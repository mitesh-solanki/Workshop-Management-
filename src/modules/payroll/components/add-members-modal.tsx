"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  generateMonthPayrollAction,
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
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import { useStripCreateQuery } from "@/hooks/use-open-create-query";
import { paiseToRupeesInput, sanitizeRupeesTyping } from "@/lib/money";

const initial: PayrollActionState = { ok: false };

type MemberOption = {
  id: string;
  label: string;
  basicSalaryPaise: number;
  openAdvancePaise: number;
};

type Row = {
  key: string;
  userId: string;
  amountRupees: string;
};

type Props = {
  yearMonth: string;
  members: MemberOption[];
  alreadyAddedIds: string[];
  defaultOpen?: boolean;
  size?: "sm" | "md";
};

function newRow(member?: MemberOption): Row {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: member?.id ?? "",
    amountRupees: paiseToRupeesInput(member?.basicSalaryPaise ?? 0),
  };
}

export function AddMembersModal({
  yearMonth,
  members,
  alreadyAddedIds,
  defaultOpen = false,
  size = "md",
}: Props) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  useStripCreateQuery(defaultOpen);
  const available = useMemo(
    () => members.filter((m) => !alreadyAddedIds.includes(m.id)),
    [members, alreadyAddedIds],
  );
  const [lines, setLines] = useState<Row[]>(() =>
    available.length > 0 ? [newRow(available[0])] : [newRow()],
  );
  const [state, formAction, pending] = useActionState(
    generateMonthPayrollAction,
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

  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.userId).filter(Boolean)),
    [lines],
  );

  const canSubmit =
    !pending &&
    available.length > 0 &&
    lines.length > 0 &&
    lines.every((line) => line.userId && line.amountRupees.trim() !== "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setLines(available.length > 0 ? [newRow(available[0])] : [newRow()]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          size={size}
          className="min-h-11 gap-2"
          disabled={available.length === 0}
        >
          <Plus className="size-4" aria-hidden />
          {t("addMembers")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addMembers")}</DialogTitle>
          <DialogDescription>{t("addMembersDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={formId} action={formAction} className="space-y-4">
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <div className="rounded-lg border border-border">
              <div className="max-h-[min(20rem,45vh)] overflow-y-auto">
                <table className="w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr className="border-b border-border">
                      <th className="h-10 w-[55%] px-3 text-left font-medium text-slate-700">
                        {t("columns.member")}
                      </th>
                      <th className="h-10 w-[30%] px-3 text-left font-medium text-slate-700">
                        {t("amount")}
                      </th>
                      <th className="h-10 w-14 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const options = available
                        .filter(
                          (m) =>
                            m.id === line.userId || !selectedIds.has(m.id),
                        )
                        .map((m) => ({ value: m.id, label: m.label }));
                      return (
                        <tr
                          key={line.key}
                          className="border-b border-border last:border-0"
                        >
                          <td className="min-w-0 overflow-hidden px-3 py-2 align-top">
                            <SearchableSelect
                              id={`add-member-${line.key}`}
                              name="userIds"
                              form={formId}
                              mode="single"
                              trigger="field"
                              value={line.userId}
                              onChange={(userId) => {
                                const member = available.find(
                                  (m) => m.id === userId,
                                );
                                setLines((prev) =>
                                  prev.map((row) =>
                                    row.key === line.key
                                      ? {
                                          ...row,
                                          userId,
                                          amountRupees:
                                            row.amountRupees.trim() !== ""
                                              ? row.amountRupees
                                              : paiseToRupeesInput(
                                                  member?.basicSalaryPaise ?? 0,
                                                ),
                                        }
                                      : row,
                                  ),
                                );
                              }}
                              options={options}
                              clearable={false}
                              disabled={pending}
                              placeholder={t("membersPlaceholder")}
                              searchPlaceholder={t("membersSearchPlaceholder")}
                              emptyLabel={t("membersEmpty")}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <Input
                              name={
                                line.userId
                                  ? `basic_${line.userId}`
                                  : undefined
                              }
                              inputMode="decimal"
                              required
                              placeholder="20000"
                              className="min-h-11 w-full"
                              disabled={pending || !line.userId}
                              value={line.amountRupees}
                              onChange={(e) => {
                                const next = sanitizeRupeesTyping(
                                  e.target.value,
                                );
                                setLines((prev) =>
                                  prev.map((row) =>
                                    row.key === line.key
                                      ? { ...row, amountRupees: next }
                                      : row,
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="p-2 text-right align-top">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-11"
                              disabled={pending || lines.length <= 1}
                              onClick={() =>
                                setLines((prev) =>
                                  prev.filter((row) => row.key !== line.key),
                                )
                              }
                              aria-label={t("removeMemberLine")}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 gap-1.5"
              disabled={pending || selectedIds.size >= available.length}
              onClick={() => setLines((prev) => [...prev, newRow()])}
            >
              <Plus className="size-4" aria-hidden />
              {t("addMemberLine")}
            </Button>
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
            disabled={!canSubmit}
            className="min-h-11"
          >
            {pending ? t("addingMembers") : t("addMembers")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
