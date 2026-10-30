"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createInspectionEstimateAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { persistLiveLinkUrl } from "@/modules/live-link/components/live-link-staff-panel";

const initial: EstimateActionState = { ok: false };

type DraftPayload = {
  customerId: string;
  vehicleId: string;
  complaint: string;
  recommendedNotes: string;
  itemsJson: string;
};

type Props = {
  inspectionId: string;
  pricedLineCount: number;
  draft: DraftPayload;
};

export function CreateInspectionEstimateForm({
  inspectionId,
  pricedLineCount,
  draft,
}: Props) {
  const t = useTranslations("estimates");
  const [askPermission, setAskPermission] = useState(false);
  const [permissionVia, setPermissionVia] = useState<"MANUAL" | "LIVE_LINK">(
    "MANUAL",
  );

  const bound = useMemo(
    () => createInspectionEstimateAction.bind(null, inspectionId),
    [inspectionId],
  );

  const [state, formAction, pending] = useActionState(bound, initial);
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      if (state.liveLinkUrl) {
        persistLiveLinkUrl(inspectionId, state.liveLinkUrl);
      }
      toast.success(t("estimateCreated"));
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, t, router, inspectionId]);

  const canCreate = pricedLineCount > 0;

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      <input type="hidden" name="customerId" value={draft.customerId} />
      <input type="hidden" name="vehicleId" value={draft.vehicleId} />
      <input type="hidden" name="complaint" value={draft.complaint} />
      <input
        type="hidden"
        name="recommendedNotes"
        value={draft.recommendedNotes}
      />
      <input type="hidden" name="itemsJson" value={draft.itemsJson} />

      <fieldset className="space-y-3">
        <legend className="text-[13px] font-semibold text-slate-900">
          {t("askPermissionLabel")}
        </legend>
        <p className="text-[12px] leading-relaxed text-slate-600">
          {t("askPermissionHint")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-white px-3 py-2.5",
              !askPermission ? "border-blue-500" : "border-slate-200",
            )}
          >
            <input
              type="radio"
              name="askPermission"
              value="no"
              className="mt-1 size-4"
              checked={!askPermission}
              onChange={() => setAskPermission(false)}
            />
            <span>
              <span className="block text-[13px] font-medium text-slate-900">
                {t("askPermissionNo")}
              </span>
              <span className="text-[12px] text-slate-600">
                {t("askPermissionNoHelp")}
              </span>
            </span>
          </label>
          <label
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-white px-3 py-2.5",
              askPermission ? "border-blue-500" : "border-slate-200",
            )}
          >
            <input
              type="radio"
              name="askPermission"
              value="yes"
              className="mt-1 size-4"
              checked={askPermission}
              onChange={() => setAskPermission(true)}
            />
            <span>
              <span className="block text-[13px] font-medium text-slate-900">
                {t("askPermissionYes")}
              </span>
              <span className="text-[12px] text-slate-600">
                {t("askPermissionYesHelp")}
              </span>
            </span>
          </label>
        </div>

        {askPermission ? (
          <div className="space-y-2 rounded-[10px] border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[13px] font-medium text-slate-800">
              {t("permissionViaLabel")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-white px-3 py-2.5",
                  permissionVia === "MANUAL"
                    ? "border-blue-500"
                    : "border-slate-200",
                )}
              >
                <input
                  type="radio"
                  name="permissionVia"
                  value="MANUAL"
                  className="mt-1 size-4"
                  checked={permissionVia === "MANUAL"}
                  onChange={() => setPermissionVia("MANUAL")}
                />
                <span>
                  <span className="block text-[13px] font-medium text-slate-900">
                    {t("permissionViaManual")}
                  </span>
                  <span className="text-[12px] text-slate-600">
                    {t("permissionViaManualHelp")}
                  </span>
                </span>
              </label>
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-white px-3 py-2.5",
                  permissionVia === "LIVE_LINK"
                    ? "border-blue-500"
                    : "border-slate-200",
                )}
              >
                <input
                  type="radio"
                  name="permissionVia"
                  value="LIVE_LINK"
                  className="mt-1 size-4"
                  checked={permissionVia === "LIVE_LINK"}
                  onChange={() => setPermissionVia("LIVE_LINK")}
                />
                <span>
                  <span className="block text-[13px] font-medium text-slate-900">
                    {t("permissionViaLiveLink")}
                  </span>
                  <span className="text-[12px] text-slate-600">
                    {t("permissionViaLiveLinkHelp")}
                  </span>
                </span>
              </label>
            </div>
            {permissionVia === "LIVE_LINK" ? (
              <p className="text-[12px] text-slate-500">
                {t("liveLinkAfterCreateHint")}
              </p>
            ) : null}
          </div>
        ) : (
          <input type="hidden" name="permissionVia" value="" />
        )}
      </fieldset>

      <FormField
        id="inspection-estimate-notes"
        label={t("notes")}
        className="w-full"
      >
        <Textarea
          id="inspection-estimate-notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder={t("notesPlaceholder")}
          className="min-h-20 w-full min-w-0 [field-sizing:fixed]"
        />
      </FormField>

      {!canCreate ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-950">
          {t("errors.noPricedSources")}
        </p>
      ) : null}

      {state.message && !state.ok ? (
        <p className="text-sm text-red-600" role="status">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          disabled={!canCreate}
          className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
        >
          {pending
            ? t("saving")
            : askPermission
              ? t("createFromSources")
              : t("createAndBill")}
        </Button>
      </div>
    </form>
  );
}
