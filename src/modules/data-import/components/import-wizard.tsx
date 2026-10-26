"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  commitImportAction,
  parseImportFileAction,
  validateImportAction,
} from "@/app/actions/data-import";
import { rowsToCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { cn } from "@/lib/utils";
import { fieldsForEntity } from "@/modules/data-import/fields";
import type {
  ImportEntity,
  ImportMode,
  ImportValidationView,
} from "@/modules/data-import/schema";

type Step = "upload" | "map" | "preview";

const STEPS: readonly Step[] = ["upload", "map", "preview"];

const SAMPLE_FILE: Record<ImportEntity, string> = {
  customers: "customers-sample.csv",
  vehicles: "vehicles-sample.csv",
  parts: "parts-sample.csv",
};

type ParsedState = {
  entity: ImportEntity;
  filename: string;
  headers: string[];
  rows: string[][];
  mapping: Record<string, number | null>;
};

export type ImportWizardProps = {
  entity: ImportEntity;
  /** Called after a successful import when the user closes or finishes. */
  onDone?: () => void;
};

export function ImportWizard({ entity, onDone }: ImportWizardProps) {
  const t = useTranslations("dataImport");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [validation, setValidation] = useState<ImportValidationView | null>(
    null,
  );
  const [mode, setMode] = useState<ImportMode>("all_or_nothing");
  const [skipConfirmVisible, setSkipConfirmVisible] = useState(false);
  const supportsUpdate = entity === "customers" || entity === "parts";

  function formatRowError(error: {
    field: string | null;
    code: string;
    message: string;
  }): string {
    const importKey = error.code.replace(/^import\./, "");
    let translated: string;
    if (t.has(`rowErrors.${importKey}`)) {
      translated = t(`rowErrors.${importKey}`);
    } else if (
      error.code.startsWith("validation.") &&
      tErrors.has(error.code)
    ) {
      translated = tErrors(error.code);
    } else if (
      error.message.startsWith("validation.") &&
      tErrors.has(error.message)
    ) {
      translated = tErrors(error.message);
    } else if (t.has("rowErrors.row_invalid")) {
      translated = t("rowErrors.row_invalid");
    } else {
      translated = error.message;
    }
    return error.field ? `${error.field}: ${translated}` : translated;
  }

  const fields = useMemo(() => fieldsForEntity(entity), [entity]);
  const stepIndex = STEPS.indexOf(step);
  const nothingNew =
    validation != null &&
    validation.validCount === 0 &&
    validation.existingCount > 0 &&
    validation.existingCount === validation.errorCount;
  const nothingNewBlockUpdate = nothingNew && !supportsUpdate;

  function resetAll() {
    setStep("upload");
    setError(null);
    setParsed(null);
    setValidation(null);
    setMode("all_or_nothing");
    setSkipConfirmVisible(false);
  }

  function discardAndClose() {
    onDone?.();
  }

  function onUpload(file: File | null) {
    if (!file) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("entity", entity);
    formData.set("file", file);

    startTransition(async () => {
      const res = await parseImportFileAction(formData);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setParsed({
        entity: res.entity,
        filename: res.filename,
        headers: res.headers,
        rows: res.rows,
        mapping: res.suggestedMapping,
      });
      setValidation(null);
      setStep("map");
    });
  }

  function onValidate() {
    if (!parsed) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await validateImportAction({
        entity: parsed.entity,
        headers: parsed.headers,
        rows: parsed.rows,
        mapping: parsed.mapping,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setValidation(res.validation);
      const onlyExisting =
        res.validation.validCount === 0 &&
        res.validation.existingCount > 0 &&
        res.validation.existingCount === res.validation.errorCount;
      if (onlyExisting && supportsUpdate) {
        setMode("update_existing");
      } else if (onlyExisting || res.validation.errorCount > 0) {
        setMode("skip_invalid");
      } else {
        setMode("all_or_nothing");
      }
      setStep("preview");
    });
  }

  function runCommit() {
    if (!parsed || !validation) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await commitImportAction({
        entity: parsed.entity,
        headers: parsed.headers,
        rows: parsed.rows,
        mapping: parsed.mapping,
        mode,
      });
      if (!res.ok) {
        setError(res.message);
        setSkipConfirmVisible(false);
        return;
      }
      setSkipConfirmVisible(false);
      toast.success(
        t("success", {
          imported: res.importedCount,
          skipped: res.skippedCount,
        }),
      );
      onDone?.();
      router.refresh();
    });
  }

  function onConfirmImportClick() {
    if (!validation) {
      return;
    }
    if (
      mode === "skip_invalid" &&
      validation.errorCount > 0 &&
      !skipConfirmVisible
    ) {
      setSkipConfirmVisible(true);
      return;
    }
    runCommit();
  }

  function canGoToStep(target: Step): boolean {
    if (target === "upload") return true;
    if (target === "map") return parsed != null;
    return parsed != null && validation != null;
  }

  function goToStep(target: Step) {
    if (!canGoToStep(target) || pending) return;
    setError(null);
    setSkipConfirmVisible(false);
    setStep(target);
  }

  function downloadErrorReport() {
    if (!validation || validation.errors.length === 0) {
      return;
    }
    const byRow = new Map<number, typeof validation.errors>();
    for (const err of validation.errors) {
      const list = byRow.get(err.rowNumber) ?? [];
      list.push(err);
      byRow.set(err.rowNumber, list);
    }
    const reportRows: Array<Record<string, string>> = [];
    for (const [rowNumber, rowErrors] of [...byRow.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const dataIndex = rowNumber - 2;
      const cells = validation.rows[dataIndex] ?? [];
      const record: Record<string, string> = {
        rowNumber: String(rowNumber),
        errors: rowErrors.map(formatRowError).join("; "),
      };
      validation.headers.forEach((header, i) => {
        const key = header || `column_${i + 1}`;
        record[key] = cells[i] ?? "";
      });
      reportRows.push(record);
    }
    const headerKeys = [
      "rowNumber",
      "errors",
      ...validation.headers.map((h, i) => h || `column_${i + 1}`),
    ];
    const columns = headerKeys.map((key) => ({
      header:
        key === "rowNumber"
          ? t("report.rowNumber")
          : key === "errors"
            ? t("report.errors")
            : key,
      value: (row: Record<string, string>) => row[key] ?? "",
    }));
    const csv = rowsToCsv(columns, reportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${parsed?.entity ?? "import"}-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
        <div className="sm:hidden">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("stepProgress", {
              current: stepIndex + 1,
              total: STEPS.length,
            })}
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground">
            {t(`steps.${step}`)}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label={t(`steps.${step}`)}
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-[width]"
              style={{
                width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <ol className="hidden sm:grid sm:grid-cols-3 sm:gap-2">
          {STEPS.map((s, index) => {
            const reachable = canGoToStep(s) && !pending;
            const isCurrent = s === step;
            const isComplete = index < stepIndex;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => goToStep(s)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                    isCurrent
                      ? "border-teal-600 bg-teal-50 font-semibold text-teal-900"
                      : isComplete
                        ? "border-border bg-muted/40 font-medium text-foreground hover:bg-muted"
                        : "border-transparent bg-muted/20 text-muted-foreground",
                    !reachable && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                      isCurrent
                        ? "bg-teal-600 text-white"
                        : isComplete
                          ? "bg-teal-600 text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isComplete && !isCurrent ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0 truncate">{t(`steps.${s}`)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {step === "upload" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <p className="text-sm text-slate-600">{t(`entityHelp.${entity}`)}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700">
              <Upload className="size-4" aria-hidden />
              {pending ? t("parsing") : t("chooseFile")}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                disabled={pending}
                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            <a
              href={`/samples/${SAMPLE_FILE[entity]}`}
              download={SAMPLE_FILE[entity]}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Download className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-all">
                {t("downloadSample", { filename: SAMPLE_FILE[entity] })}
              </span>
            </a>
          </div>
          <p className="text-sm text-slate-600">{t("fileHint")}</p>
        </section>
      ) : null}

      {step === "map" ? (
        parsed ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                {t("fileLoaded", {
                  filename: parsed.filename,
                  count: parsed.rows.length,
                })}
              </span>
            </div>

            <div className="space-y-3 md:hidden">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <label
                    htmlFor={`map-${field.key}`}
                    className="block text-sm font-medium text-slate-900"
                  >
                    {t(`fields.${parsed.entity}.${field.key}`)}
                    {field.required ? (
                      <span className="ml-1 text-red-600">*</span>
                    ) : null}
                  </label>
                  <FormSelect
                    id={`map-${field.key}`}
                    value={
                      parsed.mapping[field.key] == null
                        ? ""
                        : String(parsed.mapping[field.key])
                    }
                    onValueChange={(value) => {
                      setParsed({
                        ...parsed,
                        mapping: {
                          ...parsed.mapping,
                          [field.key]: value === "" ? null : Number(value),
                        },
                      });
                    }}
                    options={[
                      { value: "", label: t("unmapped") },
                      ...parsed.headers.map((header, index) => ({
                        value: String(index),
                        label:
                          header || t("emptyHeader", { index: index + 1 }),
                      })),
                    ]}
                  />
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-600">
                    <th className="px-2 py-2 font-medium">{t("field")}</th>
                    <th className="px-2 py-2 font-medium">{t("column")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.key} className="border-b border-border/70">
                      <td className="px-2 py-2 align-middle">
                        <span className="font-medium text-slate-900">
                          {t(`fields.${parsed.entity}.${field.key}`)}
                        </span>
                        {field.required ? (
                          <span className="ml-1 text-red-600">*</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <FormSelect
                          value={
                            parsed.mapping[field.key] == null
                              ? ""
                              : String(parsed.mapping[field.key])
                          }
                          onValueChange={(value) => {
                            setParsed({
                              ...parsed,
                              mapping: {
                                ...parsed.mapping,
                                [field.key]:
                                  value === "" ? null : Number(value),
                              },
                            });
                          }}
                          options={[
                            { value: "", label: t("unmapped") },
                            ...parsed.headers.map((header, index) => ({
                              value: String(index),
                              label:
                                header ||
                                t("emptyHeader", { index: index + 1 }),
                            })),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                onClick={resetAll}
                disabled={pending}
              >
                {t("startOver")}
              </Button>
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                onClick={onValidate}
                loading={pending}
              >
                {t("validate")}
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-sm text-slate-600">{t("stepNeedsFile")}</p>
        )
      ) : null}

      {step === "preview" ? (
        parsed && validation ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <Stat label={t("stats.total")} value={validation.totalCount} />
              <Stat label={t("stats.valid")} value={validation.validCount} />
              <Stat label={t("stats.invalid")} value={validation.errorCount} />
            </div>

            {nothingNew ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {entity === "parts"
                  ? t("nothingNewParts", { count: validation.existingCount })
                  : entity === "vehicles"
                    ? t("nothingNewVehicles", {
                        count: validation.existingCount,
                      })
                    : t("nothingNewCustomers", {
                        count: validation.existingCount,
                      })}
              </p>
            ) : validation.existingCount > 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {entity === "parts"
                  ? t("existingPartsFound", {
                      count: validation.existingCount,
                    })
                  : entity === "vehicles"
                    ? t("existingVehiclesFound", {
                        count: validation.existingCount,
                      })
                    : t("existingCustomersFound", {
                        count: validation.existingCount,
                      })}
              </p>
            ) : null}

            {nothingNew ? null : validation.errorCount > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-800">{t("errorsFound")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={downloadErrorReport}
                >
                  <Download className="size-4" aria-hidden />
                  {t("downloadErrors")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-teal-800">{t("allValid")}</p>
            )}

            <div className="space-y-2 md:hidden">
              {validation.preview.map((row) => (
                <div
                  key={row.rowNumber}
                  className="space-y-1.5 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {t("row")} {row.rowNumber}
                    </p>
                    <span
                      className={
                        row.status === "valid"
                          ? "text-sm font-medium text-teal-700"
                          : "text-sm font-medium text-red-700"
                      }
                    >
                      {t(`rowStatus.${row.status}`)}
                    </span>
                  </div>
                  <p className="break-words text-sm text-slate-700">
                    {row.status === "invalid"
                      ? row.errors.map(formatRowError).join("; ")
                      : row.cells.filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-md border border-border md:block">
              <table className="w-full min-w-120 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 font-medium">{t("row")}</th>
                    <th className="px-2 py-2 font-medium">{t("status")}</th>
                    <th className="px-2 py-2 font-medium">{t("details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.preview.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className="border-b border-border/70"
                    >
                      <td className="px-2 py-2 tabular-nums">
                        {row.rowNumber}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={
                            row.status === "valid"
                              ? "text-teal-700"
                              : "text-red-700"
                          }
                        >
                          {t(`rowStatus.${row.status}`)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.status === "invalid"
                          ? row.errors.map(formatRowError).join("; ")
                          : row.cells.filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {nothingNewBlockUpdate ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={discardAndClose}
                  disabled={pending}
                >
                  {t("discardImport")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => setStep("map")}
                  disabled={pending}
                >
                  {t("backToMap")}
                </Button>
              </div>
            ) : (
              <>
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-slate-900">
                    {t("modeLabel")}
                  </legend>
                  {nothingNew ? null : (
                    <label
                      className={cn(
                        "flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2",
                        validation.errorCount > 0
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                      )}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        className="mt-1 size-4 disabled:cursor-not-allowed"
                        checked={mode === "all_or_nothing"}
                        onChange={() => {
                          setMode("all_or_nothing");
                          setSkipConfirmVisible(false);
                        }}
                        disabled={validation.errorCount > 0}
                      />
                      <span>
                        <span className="block font-medium">
                          {t("modes.all_or_nothing")}
                        </span>
                        <span className="text-sm text-slate-600">
                          {t("modes.all_or_nothingHelp")}
                        </span>
                      </span>
                    </label>
                  )}
                  {nothingNew ? null : (
                    <label
                      className={cn(
                        "flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2",
                        validation.validCount === 0
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                      )}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        className="mt-1 size-4 disabled:cursor-not-allowed"
                        checked={mode === "skip_invalid"}
                        onChange={() => {
                          setMode("skip_invalid");
                          setSkipConfirmVisible(false);
                        }}
                        disabled={validation.validCount === 0}
                      />
                      <span>
                        <span className="block font-medium">
                          {t("modes.skip_invalid")}
                        </span>
                        <span className="text-sm text-slate-600">
                          {entity === "customers"
                            ? t("modes.skip_invalidHelpCustomers")
                            : entity === "parts"
                              ? t("modes.skip_invalidHelpParts")
                              : t("modes.skip_invalidHelp")}
                        </span>
                      </span>
                    </label>
                  )}
                  {supportsUpdate ? (
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2">
                      <input
                        type="radio"
                        name="import-mode"
                        className="mt-1 size-4"
                        checked={mode === "update_existing"}
                        onChange={() => {
                          setMode("update_existing");
                          setSkipConfirmVisible(false);
                        }}
                      />
                      <span>
                        <span className="block font-medium">
                          {entity === "parts"
                            ? t("modes.update_existingParts")
                            : t("modes.update_existing")}
                        </span>
                        <span className="text-sm text-slate-600">
                          {entity === "parts"
                            ? t("modes.update_existingPartsHelp")
                            : t("modes.update_existingHelp")}
                        </span>
                        <span className="mt-1 block text-sm text-slate-500">
                          {t("updateExistingOptional")}
                        </span>
                      </span>
                    </label>
                  ) : null}
                </fieldset>

                {skipConfirmVisible ? (
                  <div
                    role="status"
                    className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3"
                  >
                    <p className="text-sm font-medium text-amber-950">
                      {t("skipConfirmTitle")}
                    </p>
                    <p className="text-sm text-amber-900">
                      {t("skipConfirmDescription", {
                        valid: validation.validCount,
                        invalid: validation.errorCount,
                      })}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 w-full sm:w-auto"
                        disabled={pending}
                        onClick={() => setSkipConfirmVisible(false)}
                      >
                        {t("cancelSkip")}
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11 w-full sm:w-auto"
                        loading={pending}
                        onClick={runCommit}
                      >
                        {t("confirmImport")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={discardAndClose}
                      disabled={pending}
                    >
                      {t("discardImport")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => setStep("map")}
                      disabled={pending}
                    >
                      {t("backToMap")}
                    </Button>
                    <Button
                      type="button"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={onConfirmImportClick}
                      loading={pending}
                      disabled={
                        (mode === "all_or_nothing" &&
                          (validation.validCount === 0 ||
                            validation.errorCount > 0)) ||
                        (mode === "skip_invalid" &&
                          validation.validCount === 0) ||
                        (mode === "update_existing" &&
                          validation.existingCount === 0 &&
                          validation.validCount === 0)
                      }
                    >
                      {t("confirmImport")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <p className="text-sm text-slate-600">{t("stepNeedsValidate")}</p>
        )
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 px-3 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
