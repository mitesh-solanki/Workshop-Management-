"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PartNameSuggestInput } from "@/modules/inventory/components/part-name-suggest-input";
import { skuFromPartName } from "@/modules/inventory/sku-from-name";

type Props = {
  idPrefix: string;
  /** When true, SKU stays linked to the name until the user edits SKU. */
  autoSku?: boolean;
  defaultName?: string;
  defaultSku?: string;
  autoFocusName?: boolean;
  nameClassName?: string;
  skuClassName?: string;
  /** Rendered beside SKU (e.g. unit select). */
  afterSku?: React.ReactNode;
  /** Put Name, SKU, and afterSku on one desktop row. */
  singleRow?: boolean;
};

export function NameSkuFields({
  idPrefix,
  autoSku = false,
  defaultName = "",
  defaultSku = "",
  autoFocusName = false,
  nameClassName = "h-11 min-h-11",
  skuClassName = "h-11 min-h-11 font-mono uppercase",
  afterSku,
  singleRow = false,
}: Props) {
  const t = useTranslations("inventory");
  const [name, setName] = useState(defaultName);
  const [sku, setSku] = useState(
    autoSku && !defaultSku ? skuFromPartName(defaultName) : defaultSku,
  );
  const [skuManual, setSkuManual] = useState(!autoSku || Boolean(defaultSku));

  const nameId = `${idPrefix}-name`;
  const skuId = `${idPrefix}-sku`;

  function updateName(next: string) {
    setName(next);
    if (autoSku && !skuManual) {
      setSku(skuFromPartName(next));
    }
  }

  const nameField = (
    <FormField id={nameId} label={t("name")}>
      <PartNameSuggestInput
        id={nameId}
        required
        maxLength={200}
        autoFocus={autoFocusName}
        value={name}
        onValueChange={updateName}
        className={nameClassName}
      />
    </FormField>
  );

  const skuField = (
    <FormField
      id={skuId}
      label={t("sku")}
      hint={autoSku && !skuManual ? t("skuAutoHint") : undefined}
    >
      <Input
        id={skuId}
        name="sku"
        required
        maxLength={64}
        value={sku}
        onChange={(event) => {
          setSkuManual(true);
          setSku(event.target.value.toUpperCase());
        }}
        className={skuClassName}
      />
    </FormField>
  );

  if (singleRow) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nameField}
        {skuField}
        {afterSku}
      </div>
    );
  }

  return (
    <>
      {nameField}
      {afterSku ? (
        <div
          className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}
        >
          {skuField}
          {afterSku}
        </div>
      ) : (
        skuField
      )}
    </>
  );
}
