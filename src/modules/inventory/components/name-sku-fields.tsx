"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
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
}: Props) {
  const t = useTranslations("inventory");
  const [name, setName] = useState(defaultName);
  const [sku, setSku] = useState(
    autoSku && !defaultSku ? skuFromPartName(defaultName) : defaultSku,
  );
  const [skuManual, setSkuManual] = useState(!autoSku || Boolean(defaultSku));

  const nameId = `${idPrefix}-name`;
  const skuId = `${idPrefix}-sku`;

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

  return (
    <>
      <FormField id={nameId} label={t("name")}>
        <Input
          id={nameId}
          name="name"
          required
          maxLength={200}
          autoFocus={autoFocusName}
          value={name}
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (autoSku && !skuManual) {
              setSku(skuFromPartName(next));
            }
          }}
          className={nameClassName}
        />
      </FormField>

      {afterSku ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {skuField}
          {afterSku}
        </div>
      ) : (
        skuField
      )}
    </>
  );
}
