"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  updateGarageSettingsAction,
  type SettingsActionState,
} from "@/app/actions/settings";
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
  footer?: React.ReactNode;
};

function SettingsSection({
  icon,
  titleId,
  title,
  description,
  children,
  footer,
}: SectionShellProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 [.border-b]:pb-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-100">
          {icon}
        </span>
        <div className="min-w-0">
          <CardTitle id={titleId} className="text-sm font-semibold leading-tight">
            {title}
          </CardTitle>
          <CardDescription className="text-xs leading-snug">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 px-4 py-3.5">{children}</CardBody>
      {footer ? (
        <CardFooter className="justify-end gap-2 border-t border-slate-100 px-4 py-3">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function GarageSettingsForm({ garage, canEdit }: Props) {
  const t = useTranslations("settings");
  const tGst = useTranslations("gst");
  const formId = useId();
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
    <div className="space-y-4">
      <form id={formId} action={formAction} className="min-w-0 max-w-2xl">
        {!canEdit ? (
          <p className="mb-3 text-sm text-slate-600">{t("readOnly")}</p>
        ) : null}

        <SettingsSection
          icon={<Building2 className="size-4" aria-hidden />}
          titleId={`${formId}-garage-title`}
          title={t("sections.garageTitle")}
          description={t("sections.garageDescription")}
          footer={
            canEdit ? (
              <>
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
                  size="md"
                  disabled={saveDisabled}
                  loading={pending}
                >
                  {pending ? t("saving") : t("save")}
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="name" label={t("garageName")} className="sm:col-span-2">
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={!canEdit}
                className="h-10"
              />
            </FormField>
            <FormField id="address" label={t("address")} className="sm:col-span-2">
              <Textarea
                id="address"
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                disabled={!canEdit}
              />
            </FormField>
            <div className="sm:col-span-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-800">
                {t("sections.invoiceTitle")}
              </p>
              <p className="text-xs text-slate-600">
                {t("sections.invoiceDescription")}
              </p>
            </div>
            <FormField
              id="gstin"
              label={t("gstin")}
              error={
                gstinLiveError ??
                (!state.ok && state.message ? state.message : undefined)
              }
              className="sm:col-span-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                    "h-10 font-mono tracking-wide sm:min-w-0 sm:flex-1",
                    gstinValid && !gstinEmpty && "border-success/40",
                  )}
                />
                <div className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 sm:max-w-56 sm:shrink-0">
                  <span className="text-xs font-medium text-slate-500">
                    {t("stateCodeLabel")}
                  </span>
                  {stateCode ? (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-teal-50 px-2 py-0.5 font-mono text-teal-800"
                    >
                      {stateCode}
                    </Badge>
                  ) : (
                    <span className="truncate text-xs text-slate-500">
                      {t("stateCodeEmpty")}
                    </span>
                  )}
                </div>
              </div>
            </FormField>
            {stateCode ? (
              <p className="text-xs text-slate-600 sm:col-span-2">
                {t("stateCodeValue", {
                  code: stateCode,
                  name: stateName ?? t("stateCodeUnknown"),
                })}
              </p>
            ) : null}
          </div>
        </SettingsSection>

        {state.ok && state.message ? (
          <p className="mt-3 text-body text-success" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
