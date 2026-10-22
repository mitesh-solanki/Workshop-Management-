"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Check, FileText, Languages } from "lucide-react";
import {
  updateGarageSettingsAction,
  type SettingsActionState,
} from "@/app/actions/settings";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  gstinStateCode,
  isKnownGstStateCode,
  isValidGstin,
  normalizeGstin,
} from "@/lib/gstin";
import { cn } from "@/lib/utils";

const initial: SettingsActionState = { ok: false };

type Props = {
  garage: {
    name: string;
    address: string | null;
    gstin: string | null;
  };
  canEdit: boolean;
};

type SectionShellProps = {
  icon: React.ReactNode;
  titleId: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

/** Vercel / shadcn settings row: title left, fields right on desktop. */
function SettingsSection({
  icon,
  titleId,
  title,
  description,
  children,
}: SectionShellProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80 lg:border-r lg:border-b-0">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              {icon}
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle id={titleId}>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-4 py-5">{children}</CardBody>
      </div>
    </Card>
  );
}

export function GarageSettingsForm({ garage, canEdit }: Props) {
  const t = useTranslations("settings");
  const tLang = useTranslations("language");
  const tGst = useTranslations("gst");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const formId = useId();
  const [localePending, startLocaleTransition] = useTransition();
  const [name, setName] = useState(garage.name);
  const [address, setAddress] = useState(garage.address ?? "");
  const [gstin, setGstin] = useState(garage.gstin ?? "");
  const [state, formAction, pending] = useActionState(
    updateGarageSettingsAction,
    initial,
  );

  const dirty =
    canEdit &&
    (name.trim() !== garage.name ||
      address.trim() !== (garage.address ?? "") ||
      normalizeGstin(gstin) !== normalizeGstin(garage.gstin ?? ""));

  const gstinNormalized = normalizeGstin(gstin);
  const gstinEmpty = gstinNormalized.length === 0;
  const gstinValid = isValidGstin(gstinNormalized);
  const gstinLiveError =
    canEdit && !gstinEmpty && !gstinValid ? t("gstinInvalidLive") : undefined;
  const stateCode = gstinStateCode(gstinNormalized);
  const stateName =
    stateCode && isKnownGstStateCode(stateCode)
      ? tGst(`states.${stateCode}`)
      : null;

  function discard() {
    setName(garage.name);
    setAddress(garage.address ?? "");
    setGstin(garage.gstin ?? "");
  }

  const saveDisabled = !dirty || Boolean(gstinLiveError) || !canEdit;

  return (
    <div className="relative space-y-6 pb-24">
      <form id={formId} action={formAction} className="min-w-0 max-w-3xl space-y-6">
        <SettingsSection
          icon={<Building2 className="size-5" aria-hidden />}
          titleId={`${formId}-garage-title`}
          title={t("sections.garageTitle")}
          description={t("sections.garageDescription")}
        >
          <FormField id="name" label={t("garageName")}>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={!canEdit}
              className="h-11"
            />
          </FormField>
          <FormField id="address" label={t("address")}>
            <Textarea
              id="address"
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              disabled={!canEdit}
            />
          </FormField>
          {!canEdit ? (
            <p className="text-body text-slate-600">{t("readOnly")}</p>
          ) : null}
        </SettingsSection>

        <SettingsSection
          icon={<FileText className="size-5" aria-hidden />}
          titleId={`${formId}-invoice-title`}
          title={t("sections.invoiceTitle")}
          description={t("sections.invoiceDescription")}
        >
          <FormField
            id="gstin"
            label={t("gstin")}
            hint={canEdit && !gstinLiveError ? t("gstinHint") : undefined}
            error={
              gstinLiveError ??
              (!state.ok && state.message ? state.message : undefined)
            }
          >
            <Input
              id="gstin"
              name="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              disabled={!canEdit}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={15}
              aria-invalid={Boolean(gstinLiveError)}
              className={cn(
                "h-11 font-mono tracking-wide",
                gstinValid && !gstinEmpty && "border-success/40",
              )}
            />
          </FormField>

          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-caption font-medium text-slate-500">
                {t("stateCodeLabel")}
              </p>
              <p className="text-body text-slate-900">
                {stateCode
                  ? t("stateCodeValue", {
                      code: stateCode,
                      name: stateName ?? t("stateCodeUnknown"),
                    })
                  : t("stateCodeEmpty")}
              </p>
            </div>
            {stateCode ? (
              <Badge
                variant="secondary"
                className="w-fit border-0 bg-teal-50 px-2.5 py-1 font-mono text-teal-800"
              >
                {stateCode}
              </Badge>
            ) : null}
          </div>

          {!canEdit ? (
            <p className="text-body text-slate-600">{t("readOnly")}</p>
          ) : null}
        </SettingsSection>

        <SettingsSection
          icon={<Languages className="size-5" aria-hidden />}
          titleId={`${formId}-language-title`}
          title={t("sections.languageTitle")}
          description={t("sections.languageDescription")}
        >
          <p className="text-body text-slate-600">{t("languageHint")}</p>
          <div
            role="radiogroup"
            aria-label={tLang("label")}
            className="overflow-hidden rounded-xl border border-slate-200"
          >
            {locales.map((code, index) => {
              const selected = code === locale;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={localePending}
                  onClick={() => {
                    if (selected) return;
                    startLocaleTransition(async () => {
                      await setLocale(code);
                      router.refresh();
                    });
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600",
                    index > 0 && "border-t border-slate-200",
                    selected
                      ? "bg-teal-50 text-teal-950"
                      : "bg-card text-slate-800 hover:bg-slate-50",
                    localePending && "opacity-70",
                  )}
                >
                  <span>{tLang(code)}</span>
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-teal-700"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </SettingsSection>

        {canEdit ? (
          <Card className="gap-0 py-0">
            <CardFooter className="justify-end gap-2 py-4">
              {dirty ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={discard}
                >
                  {t("discard")}
                </Button>
              ) : null}
              <Button
                type="submit"
                loading={pending}
                size="md"
                disabled={saveDisabled}
              >
                {pending ? t("saving") : t("save")}
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {state.ok && state.message ? (
          <p className="text-body text-success" role="status">
            {state.message}
          </p>
        ) : null}
      </form>

      {dirty ? (
        <div
          className="fixed inset-x-0 bottom-16 z-40 border-t border-amber-200 bg-amber-50 px-[34px] py-3 shadow-lg lg:bottom-0"
          role="status"
        >
          <div className="flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3">
            <p className="text-body font-medium text-amber-950">
              {t("unsavedChanges")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={discard}
              >
                {t("discard")}
              </Button>
              <Button
                type="submit"
                form={formId}
                size="sm"
                disabled={saveDisabled}
                loading={pending}
              >
                {pending ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
