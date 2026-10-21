"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { deleteCustomerAction } from "@/app/actions/customers";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

type Props = {
  customerId: string;
  className?: string;
};

export function DeleteCustomerButton({ customerId, className }: Props) {
  const t = useTranslations("customers");
  const action = useMemo(
    () => deleteCustomerAction.bind(null, customerId),
    [customerId],
  );

  return (
    <ConfirmDeleteButton
      label={t("delete")}
      confirmingLabel={t("deleting")}
      confirmMessage={t("confirmDelete")}
      className={className}
      action={action}
      translateMessage={(key) =>
        key === "cannotDeleteHasOrders" ? t("cannotDeleteHasOrders") : key
      }
    />
  );
}
