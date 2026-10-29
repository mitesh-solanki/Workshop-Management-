"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createEstimateAction,
  createEstimateRevisionAction,
  type EstimateActionState,
} from "@/app/actions/estimates";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { markOpenLiveLinkEmbed } from "@/modules/live-link/components/live-link-staff-panel";
import { useJobCardSectionJump } from "@/modules/service-orders/components/job-card-section-jump";

const initial: EstimateActionState = { ok: false };

type CreateProps = {
  orderId: string;
  mode: "create";
  pricedLineCount: number;
  unpricedLineCount: number;
};

type RevisionProps = {
  orderId: string;
  mode: "revision";
  nextRevision: number;
};

type Props = CreateProps | RevisionProps;

export function CreateEstimateForm(props: Props) {
  const t = useTranslations("estimates");
  const jump = useJobCardSectionJump();
  const [askPermission, setAskPermission] = useState(false);
  const [permissionVia, setPermissionVia] = useState<"MANUAL" | "LIVE_LINK">(
    "MANUAL",
  );

  const bound = useMemo(() => {
    if (props.mode === "revision") {
      return createEstimateRevisionAction.bind(null, props.orderId);
    }
    return createEstimateAction.bind(null, props.orderId);
  }, [props.mode, props.orderId]);

  const wrapped = useMemo(() => {
    return async (
      prev: EstimateActionState,
      formData: FormData,
    ): Promise<EstimateActionState> => {
      const result = await bound(prev, formData);
      if (
        result.ok &&
        props.mode === "create" &&
        result.askPermission &&
        result.permissionVia === "LIVE_LINK"
      ) {
        markOpenLiveLinkEmbed(props.orderId);
      }
      return result;
    };
  }, [bound, props.mode, props.orderId]);

  const [state, formAction, pending] = useActionState(wrapped, initial);

  useEffect(() => {
    if (
      !state.ok ||
      state.message !== "estimateCreated" ||
      props.mode !== "create"
    ) {
      return;
    }
    if (!state.askPermission) {
      jump?.("billing");
    }
  }, [state, jump, props.mode]);

  const isRevision = props.mode === "revision";
  const hasUnpriced =
    props.mode === "create" && props.unpricedLineCount > 0;
  const canCreate =
    isRevision ||
    (props.mode === "create" &&
      props.pricedLineCount > 0 &&
      props.unpricedLineCount === 0);

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      {!isRevision ? (
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
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5",
                !askPermission
                  ? "border-blue-300 bg-blue-50/80"
                  : "border-slate-200 bg-white",
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
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5",
                askPermission
                  ? "border-blue-300 bg-blue-50/80"
                  : "border-slate-200 bg-white",
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
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5",
                    permissionVia === "MANUAL"
                      ? "border-blue-300 bg-white"
                      : "border-slate-200 bg-white",
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
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5",
                    permissionVia === "LIVE_LINK"
                      ? "border-blue-300 bg-white"
                      : "border-slate-200 bg-white",
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
            </div>
          ) : (
            <input type="hidden" name="permissionVia" value="" />
          )}
        </fieldset>
      ) : null}

      <FormField
        id="notes"
        label={isRevision ? t("revisionReason") : t("notes")}
        className="w-full"
      >
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder={
            isRevision
              ? t("revisionReasonPlaceholder")
              : t("notesPlaceholder")
          }
          className="min-h-20 w-full min-w-0 [field-sizing:fixed]"
        />
      </FormField>

      {!isRevision && !canCreate ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-950">
          {hasUnpriced
            ? t("unpricedBlockedNote", { count: props.unpricedLineCount })
            : t("errors.noPricedSources")}
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
            : isRevision
              ? t("createRevision", { number: props.nextRevision })
              : askPermission
                ? t("createFromSources")
                : t("createAndBill")}
        </Button>
      </div>
    </form>
  );
}
