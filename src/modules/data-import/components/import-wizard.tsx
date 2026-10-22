"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import {
  commitImportAction,
  parseImportFileAction,
  validateImportAction,
} from "@/app/actions/data-import";
import { rowsToCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { fieldsForEntity } from "@/modules/data-import/fields";
import type {
  ImportEntity,
  ImportMode,
  ImportValidationView,
} from "@/modules/data-import/schema";

type Step = "upload" | "map" | "preview" | "done";

type ParsedState = {
  entity: ImportEntity;
  filename: string;
  headers: string[];
  rows: string[][];
  mapping: Record<string, number | null>;
};

const ENTITIES: ImportEntity[] = ["customers", "vehicles", "parts"];

const selectClass =
  "min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground";

export function ImportWizard() {
  const t = useTranslations("dataImport");
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("upload");
  const [entity, setEntity] = useState<ImportEntity>("customers");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [validation, setValidation] = useState<ImportValidationView | null>(
    null,
  );
  const [mode, setMode] = useState<ImportMode>("all_or_nothing");
  const [result, setResult] = useState<{
    importedCount: number;
    skippedCount: number;
  } | null>(null);

  const fields = useMemo(() => fieldsForEntity(entity), [entity]);

  function resetAll() {
    setStep("upload");
    setError(null);
    setParsed(null);
    setValidation(null);
    setResult(null);
    setMode("all_or_nothing");
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
      setStep("preview");
    });
  }

  function onCommit() {
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
        return;
      }
      setResult({
        importedCount: res.importedCount,
        skippedCount: res.skippedCount,
      });
      setStep("done");
    });
  }

  function downloadErrorReport() {
    if (!validation || validation.errorReportRows.length === 0) {
      return;
    }
    const headerKeys = [
      "rowNumber",
      "errors",
      ...validation.headers.map((h, i) => h || `column_${i + 1}`),
    ];
    const columns = headerKeys.map((key) => ({
      header: key === "rowNumber" ? t("report.rowNumber") : key === "errors" ? t("report.errors") : key,
      value: (row: Record<string, string>) => row[key] ?? "",
    }));
    const csv = rowsToCsv(columns, validation.errorReportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${parsed?.entity ?? "import"}-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm text-slate-600">
        {(["upload", "map", "preview", "done"] as const).map((s, i) => (
          <li
            key={s}
            className={
              step === s
                ? "rounded-md bg-teal-50 px-2.5 py-1 font-medium text-teal-800"
                : "rounded-md px-2.5 py-1"
            }
          >
            {i + 1}. {t(`steps.${s}`)}
          </li>
        ))}
      </ol>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="space-y-2">
            <label htmlFor="import-entity" className="text-sm font-medium">
              {t("entityLabel")}
            </label>
            <select
              id="import-entity"
              className={selectClass}
              value={entity}
              onChange={(e) => setEntity(e.target.value as ImportEntity)}
            >
              {ENTITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`entities.${value}`)}
                </option>
              ))}
            </select>
            <p className="text-sm text-slate-600">{t(`entityHelp.${entity}`)}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700">
              <Upload className="size-4" aria-hidden />
              {pending ? t("parsing") : t("chooseFile")}
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                disabled={pending}
                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <p className="text-sm text-slate-600">{t("fileHint")}</p>
        </section>
      ) : null}

      {step === "map" && parsed ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <FileSpreadsheet className="size-4" aria-hidden />
            <span>
              {t("fileLoaded", {
                filename: parsed.filename,
                count: parsed.rows.length,
              })}
            </span>
          </div>

          <div className="overflow-x-auto">
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
                      <select
                        className={selectClass}
                        value={
                          parsed.mapping[field.key] == null
                            ? ""
                            : String(parsed.mapping[field.key])
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setParsed({
                            ...parsed,
                            mapping: {
                              ...parsed.mapping,
                              [field.key]:
                                value === "" ? null : Number(value),
                            },
                          });
                        }}
                      >
                        <option value="">{t("unmapped")}</option>
                        {parsed.headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={index}>
                            {header || t("emptyHeader", { index: index + 1 })}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={resetAll}
              disabled={pending}
            >
              {t("startOver")}
            </Button>
            <Button type="button" onClick={onValidate} loading={pending}>
              {t("validate")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "preview" && parsed && validation ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t("stats.total")} value={validation.totalCount} />
            <Stat label={t("stats.valid")} value={validation.validCount} />
            <Stat label={t("stats.invalid")} value={validation.errorCount} />
          </div>

          {validation.errorCount > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800">{t("errorsFound")}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={downloadErrorReport}
              >
                <Download className="size-4" aria-hidden />
                {t("downloadErrors")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-teal-800">{t("allValid")}</p>
          )}

          <div className="overflow-x-auto rounded-md border border-border">
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
                  <tr key={row.rowNumber} className="border-b border-border/70">
                    <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
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
                        ? row.errors
                            .map((e) =>
                              e.field
                                ? `${e.field}: ${e.message}`
                                : e.message,
                            )
                            .join("; ")
                        : row.cells.filter(Boolean).slice(0, 4).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-900">
              {t("modeLabel")}
            </legend>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2">
              <input
                type="radio"
                name="import-mode"
                className="mt-1 size-4"
                checked={mode === "all_or_nothing"}
                onChange={() => setMode("all_or_nothing")}
              />
              <span>
                <span className="block font-medium">{t("modes.all_or_nothing")}</span>
                <span className="text-sm text-slate-600">
                  {t("modes.all_or_nothingHelp")}
                </span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2">
              <input
                type="radio"
                name="import-mode"
                className="mt-1 size-4"
                checked={mode === "skip_invalid"}
                onChange={() => setMode("skip_invalid")}
                disabled={validation.validCount === 0}
              />
              <span>
                <span className="block font-medium">{t("modes.skip_invalid")}</span>
                <span className="text-sm text-slate-600">
                  {t("modes.skip_invalidHelp")}
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep("map")}
              disabled={pending}
            >
              {t("backToMap")}
            </Button>
            <Button
              type="button"
              onClick={onCommit}
              loading={pending}
              disabled={
                validation.validCount === 0 ||
                (mode === "all_or_nothing" && validation.errorCount > 0)
              }
            >
              {t("confirmImport")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <p className="text-base font-medium text-teal-800">
            {t("success", {
              imported: result.importedCount,
              skipped: result.skippedCount,
            })}
          </p>
          <Button type="button" onClick={resetAll}>
            {t("importAnother")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 px-3 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
