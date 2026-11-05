"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  generateMonthPayrollAction,
  type PayrollActionState,
} from "@/app/actions/payroll";
import { Button } from "@/components/ui/button";
import { FormActionBar } from "@/components/ui/form-action-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  parseRupeesToPaise,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import { computePayrollNetPaise } from "@/modules/payroll/calc";

const initial: PayrollActionState = { ok: false };

export type AddPayrollMember = {
  id: string;
  label: string;
  basicSalaryPaise: number;
  openAdvancePaise: number;
  pendingBonusPaise: number;
  pendingBonusCount: number;
};

type Row = {
  key: string;
  userId: string;
  basicRupees: string;
  bonusRupees: string;
  advanceRupees: string;
  adjustmentRupees: string;
  adjustmentNote: string;
};

type Props = {
  yearMonth: string;
  members: AddPayrollMember[];
  /** When set, lock the form to this member (no add/remove/select). */
  lockedMemberId?: string;
  /** Nested in a dialog — less padding, stay on page after save. */
  embedded?: boolean;
};

function newRow(member?: AddPayrollMember): Row {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: member?.id ?? "",
    basicRupees: paiseToRupeesInput(member?.basicSalaryPaise ?? 0),
    bonusRupees: paiseToRupeesInput(member?.pendingBonusPaise ?? 0),
    advanceRupees: paiseToRupeesInput(member?.openAdvancePaise ?? 0),
    adjustmentRupees: "",
    adjustmentNote: "",
  };
}

function parseSignedRupees(value: string): number {
  const raw = value.trim();
  if (raw === "" || raw === "-" || raw === "+") return 0;
  const negative = raw.startsWith("-");
  const digits =
    negative || raw.startsWith("+") ? raw.slice(1).trim() : raw;
  const parsed = parseRupeesToPaise(digits);
  if (parsed == null) return 0;
  return negative ? -parsed : parsed;
}

function lineNetPaise(row: Row): number {
  return computePayrollNetPaise({
    basicPaise: parseRupeesToPaise(row.basicRupees) ?? 0,
    bonusPaise: parseRupeesToPaise(row.bonusRupees) ?? 0,
    commissionPaise: 0,
    advanceDeductedPaise: parseRupeesToPaise(row.advanceRupees) ?? 0,
    adjustmentPaise: parseSignedRupees(row.adjustmentRupees),
  });
}

export function AddPayrollForm({
  yearMonth,
  members,
  lockedMemberId,
  embedded = false,
}: Props) {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const formId = useId();
  const lockedMember = lockedMemberId
    ? members.find((member) => member.id === lockedMemberId)
    : undefined;
  const locked = Boolean(lockedMemberId);
  const [lines, setLines] = useState<Row[]>(() =>
    lockedMember
      ? [newRow(lockedMember)]
      : members.length > 0
        ? [newRow(members[0])]
        : [newRow()],
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
        if (embedded) {
          router.refresh();
        } else {
          router.push("/payroll");
          router.refresh();
        }
      }, 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, router, yearMonth, embedded]);

  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.userId).filter(Boolean)),
    [lines],
  );

  const canSubmit =
    !pending &&
    members.length > 0 &&
    lines.length > 0 &&
    lines.every((line) => line.userId && line.basicRupees.trim() !== "");

  function updateRow(rowKey: string, patch: Partial<Row>) {
    setLines((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  }

  function applyMemberDefaults(rowKey: string, userId: string) {
    const member = members.find((m) => m.id === userId);
    updateRow(rowKey, {
      userId,
      basicRupees: paiseToRupeesInput(member?.basicSalaryPaise ?? 0),
      bonusRupees: paiseToRupeesInput(member?.pendingBonusPaise ?? 0),
      advanceRupees: paiseToRupeesInput(member?.openAdvancePaise ?? 0),
    });
  }

  function removeRow(rowKey: string) {
    setLines((prev) => prev.filter((row) => row.key !== rowKey));
  }

  return (
    <div className={cn(embedded && locked ? "space-y-0" : "space-y-6", !embedded && "pb-24")}>
      <form id={formId} action={formAction} className="space-y-6">
        <input type="hidden" name="yearMonth" value={yearMonth} />
        {lines.map((line) =>
          line.userId ? (
            <div key={`submit-${line.key}`} className="hidden" aria-hidden>
              <input type="hidden" name="userIds" value={line.userId} />
              <input
                type="hidden"
                name={`basic_${line.userId}`}
                value={line.basicRupees}
              />
              <input
                type="hidden"
                name={`bonus_${line.userId}`}
                value={line.bonusRupees}
              />
              <input
                type="hidden"
                name={`advance_${line.userId}`}
                value={line.advanceRupees}
              />
              <input
                type="hidden"
                name={`adjustment_${line.userId}`}
                value={line.adjustmentRupees}
              />
              <input
                type="hidden"
                name={`adjustmentNote_${line.userId}`}
                value={line.adjustmentNote}
              />
            </div>
          ) : null,
        )}

        {locked ? (
          <div className="space-y-5">
            {lines.map((line) => {
              const netPaise = lineNetPaise(line);

              return (
                <div key={line.key} className="space-y-5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                    <FormField
                      id={`${line.key}-locked-basic`}
                      label={t("columns.basic")}
                    >
                      <Input
                        id={`${line.key}-locked-basic`}
                        inputMode="decimal"
                        required
                        disabled={pending}
                        value={line.basicRupees}
                        onChange={(e) =>
                          updateRow(line.key, {
                            basicRupees: sanitizeRupeesTyping(e.target.value),
                          })
                        }
                        className="min-h-11 tabular-nums"
                      />
                    </FormField>
                    <FormField
                      id={`${line.key}-locked-bonus`}
                      label={t("bonusShort")}
                    >
                      <Input
                        id={`${line.key}-locked-bonus`}
                        inputMode="decimal"
                        disabled={pending}
                        value={line.bonusRupees}
                        onChange={(e) =>
                          updateRow(line.key, {
                            bonusRupees: sanitizeRupeesTyping(e.target.value),
                          })
                        }
                        className="min-h-11 tabular-nums"
                      />
                    </FormField>
                    <FormField
                      id={`${line.key}-locked-advance`}
                      label={t("advanceShort")}
                    >
                      <Input
                        id={`${line.key}-locked-advance`}
                        inputMode="decimal"
                        disabled={pending}
                        value={line.advanceRupees}
                        onChange={(e) =>
                          updateRow(line.key, {
                            advanceRupees: sanitizeRupeesTyping(e.target.value),
                          })
                        }
                        className="min-h-11 tabular-nums"
                      />
                    </FormField>
                    <FormField
                      id={`${line.key}-locked-adj`}
                      label={t("adjustmentShort")}
                      hint={t("adjustmentShortHint")}
                    >
                      <Input
                        id={`${line.key}-locked-adj`}
                        inputMode="decimal"
                        disabled={pending}
                        value={line.adjustmentRupees}
                        onChange={(e) =>
                          updateRow(line.key, {
                            adjustmentRupees: e.target.value,
                          })
                        }
                        className="min-h-11 tabular-nums"
                        placeholder={t("adjustmentPlaceholder")}
                      />
                    </FormField>
                  </div>

                  <FormField
                    id={`${line.key}-locked-note`}
                    label={t("columns.note")}
                  >
                    <Textarea
                      id={`${line.key}-locked-note`}
                      rows={2}
                      maxLength={500}
                      disabled={pending}
                      value={line.adjustmentNote}
                      onChange={(e) =>
                        updateRow(line.key, {
                          adjustmentNote: e.target.value,
                        })
                      }
                      className="min-h-[4.5rem] resize-y"
                      placeholder={t("lineNotePlaceholder")}
                    />
                  </FormField>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-caption font-medium uppercase tracking-wide text-blue-700/70">
                          {t("netPayPreview")}
                        </p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-blue-800">
                          {formatRupees(netPaise, locale)}
                        </p>
                      </div>
                      {embedded ? (
                        <Button
                          type="submit"
                          form={formId}
                          size="md"
                          className="min-h-11 shrink-0"
                          disabled={!canSubmit}
                          loading={pending}
                        >
                          {pending ? t("addingPayroll") : t("addPayrollSubmit")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex justify-end border-b border-border px-3 py-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="min-h-11 gap-1.5"
                  disabled={pending || selectedIds.size >= members.length}
                  onClick={() => setLines((prev) => [...prev, newRow()])}
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addMemberLine")}
                </Button>
              </div>

              <div className="space-y-3 bg-muted/30 p-3 md:hidden">
                {lines.map((line) => {
                  const options = members
                    .filter(
                      (m) => m.id === line.userId || !selectedIds.has(m.id),
                    )
                    .map((m) => ({ value: m.id, label: m.label }));

                  return (
                    <div
                      key={line.key}
                      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label
                            htmlFor={`add-member-mobile-${line.key}`}
                            className="text-caption font-medium text-muted-foreground"
                          >
                            {t("columns.member")}
                          </label>
                          <SearchableSelect
                            id={`add-member-mobile-${line.key}`}
                            mode="single"
                            trigger="field"
                            value={line.userId}
                            onChange={(userId) =>
                              applyMemberDefaults(line.key, userId)
                            }
                            options={options}
                            clearable={false}
                            disabled={pending}
                            placeholder={t("membersPlaceholder")}
                            searchPlaceholder={t("membersSearchPlaceholder")}
                            emptyLabel={t("membersEmpty")}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mt-6 size-11 shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
                          disabled={pending || lines.length <= 1}
                          onClick={() => removeRow(line.key)}
                          aria-label={t("removeMemberLine")}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {(
                          [
                            {
                              id: "basic",
                              label: t("columns.basic"),
                              value: line.basicRupees,
                              onChange: (v: string) =>
                                updateRow(line.key, {
                                  basicRupees: sanitizeRupeesTyping(v),
                                }),
                              required: true,
                            },
                            {
                              id: "bonus",
                              label: t("bonusShort"),
                              value: line.bonusRupees,
                              onChange: (v: string) =>
                                updateRow(line.key, {
                                  bonusRupees: sanitizeRupeesTyping(v),
                                }),
                            },
                            {
                              id: "advance",
                              label: t("advanceShort"),
                              value: line.advanceRupees,
                              onChange: (v: string) =>
                                updateRow(line.key, {
                                  advanceRupees: sanitizeRupeesTyping(v),
                                }),
                            },
                            {
                              id: "adj",
                              label: t("adjustmentShort"),
                              value: line.adjustmentRupees,
                              onChange: (v: string) =>
                                updateRow(line.key, { adjustmentRupees: v }),
                              hint: t("adjustmentShortHint"),
                            },
                          ] as const
                        ).map((field) => (
                          <div key={field.id} className="space-y-1.5">
                            <label
                              htmlFor={`${line.key}-m-${field.id}`}
                              className="text-caption font-medium text-muted-foreground"
                            >
                              {field.label}
                            </label>
                            <Input
                              id={`${line.key}-m-${field.id}`}
                              inputMode="decimal"
                              required={
                                "required" in field ? field.required : false
                              }
                              disabled={pending || !line.userId}
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="tabular-nums"
                              placeholder={
                                field.id === "adj"
                                  ? t("adjustmentPlaceholder")
                                  : undefined
                              }
                            />
                            {"hint" in field && field.hint ? (
                              <p className="text-xs text-muted-foreground">
                                {field.hint}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor={`${line.key}-m-note`}
                          className="text-caption font-medium text-muted-foreground"
                        >
                          {t("columns.note")}
                        </label>
                        <Input
                          id={`${line.key}-m-note`}
                          maxLength={500}
                          disabled={pending || !line.userId}
                          value={line.adjustmentNote}
                          onChange={(e) =>
                            updateRow(line.key, {
                              adjustmentNote: e.target.value,
                            })
                          }
                          placeholder={t("lineNotePlaceholder")}
                        />
                      </div>

                      <p className="text-sm tabular-nums text-muted-foreground">
                        {t("columns.netPay")}:{" "}
                        <span className="font-semibold text-foreground">
                          {formatRupees(lineNetPaise(line), locale)}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <Table className="table-fixed">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[22%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <TableHeader className="bg-muted/60">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-2">
                        {t("columns.member")}
                      </TableHead>
                      <TableHead className="px-1.5">
                        {t("columns.basic")}
                      </TableHead>
                      <TableHead className="px-1.5">
                        {t("bonusShort")}
                      </TableHead>
                      <TableHead
                        className="px-1.5"
                        title={t("advanceColumnHint")}
                      >
                        {t("advanceShort")}
                      </TableHead>
                      <TableHead
                        className="px-1.5"
                        title={t("adjustmentHint")}
                      >
                        {t("adjustmentShort")}
                      </TableHead>
                      <TableHead className="px-1.5">
                        {t("columns.note")}
                      </TableHead>
                      <TableHead className="px-1.5">
                        {t("columns.netPay")}
                      </TableHead>
                      <TableHead className="px-1.5 text-center">
                        {t("columns.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => {
                      const options = members
                        .filter(
                          (m) =>
                            m.id === line.userId || !selectedIds.has(m.id),
                        )
                        .map((m) => ({ value: m.id, label: m.label }));

                      return (
                        <TableRow key={line.key} className="align-middle">
                          <TableCell className="px-2 py-2">
                            <SearchableSelect
                              id={`add-member-${line.key}`}
                              mode="single"
                              trigger="field"
                              value={line.userId}
                              onChange={(userId) =>
                                applyMemberDefaults(line.key, userId)
                              }
                              options={options}
                              clearable={false}
                              disabled={pending}
                              placeholder={t("membersPlaceholder")}
                              searchPlaceholder={t("membersSearchPlaceholder")}
                              emptyLabel={t("membersEmpty")}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <Input
                              id={`${line.key}-basic`}
                              inputMode="decimal"
                              required
                              disabled={pending || !line.userId}
                              value={line.basicRupees}
                              onChange={(e) =>
                                updateRow(line.key, {
                                  basicRupees: sanitizeRupeesTyping(
                                    e.target.value,
                                  ),
                                })
                              }
                              className="h-10 w-full tabular-nums"
                              aria-label={t("basicSalary")}
                            />
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <Input
                              id={`${line.key}-bonus`}
                              inputMode="decimal"
                              disabled={pending || !line.userId}
                              value={line.bonusRupees}
                              onChange={(e) =>
                                updateRow(line.key, {
                                  bonusRupees: sanitizeRupeesTyping(
                                    e.target.value,
                                  ),
                                })
                              }
                              className="h-10 w-full tabular-nums"
                              aria-label={t("bonusRupees")}
                            />
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <Input
                              id={`${line.key}-advance`}
                              inputMode="decimal"
                              disabled={pending || !line.userId}
                              value={line.advanceRupees}
                              onChange={(e) =>
                                updateRow(line.key, {
                                  advanceRupees: sanitizeRupeesTyping(
                                    e.target.value,
                                  ),
                                })
                              }
                              className="h-10 w-full tabular-nums"
                              aria-label={t("advanceDeductedRupees")}
                              title={t("advanceColumnHint")}
                            />
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <Input
                              id={`${line.key}-adj`}
                              inputMode="decimal"
                              disabled={pending || !line.userId}
                              value={line.adjustmentRupees}
                              onChange={(e) =>
                                updateRow(line.key, {
                                  adjustmentRupees: e.target.value,
                                })
                              }
                              className="h-10 w-full tabular-nums"
                              aria-label={t("adjustmentRupees")}
                              placeholder={t("adjustmentPlaceholder")}
                              title={t("adjustmentHint")}
                            />
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <Input
                              id={`${line.key}-note`}
                              maxLength={500}
                              disabled={pending || !line.userId}
                              value={line.adjustmentNote}
                              onChange={(e) =>
                                updateRow(line.key, {
                                  adjustmentNote: e.target.value,
                                })
                              }
                              className="h-10 w-full"
                              aria-label={t("adjustmentNote")}
                              placeholder={t("lineNotePlaceholder")}
                            />
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatRupees(lineNetPaise(line), locale)}
                            </span>
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-10 text-danger hover:bg-danger/10 hover:text-danger"
                              disabled={pending || lines.length <= 1}
                              onClick={() => removeRow(line.key)}
                              aria-label={t("removeMemberLine")}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
          </div>
        )}
      </form>

      {embedded && !locked ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="submit"
            form={formId}
            size="md"
            disabled={!canSubmit}
            loading={pending}
          >
            {pending ? t("addingPayroll") : t("addPayrollSubmit")}
          </Button>
        </div>
      ) : !embedded ? (
        <FormActionBar
          summary={
            <p className="hidden truncate text-sm font-medium text-muted-foreground sm:block">
              {t("addPayrollTitle")}
            </p>
          }
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={pending}
                onClick={() => router.push("/payroll")}
              >
                {tc("cancel")}
              </Button>
              <Button
                type="submit"
                form={formId}
                size="md"
                disabled={!canSubmit}
                loading={pending}
              >
                {pending ? t("addingPayroll") : t("addPayrollSubmit")}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
