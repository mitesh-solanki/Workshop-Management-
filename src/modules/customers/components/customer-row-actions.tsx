"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, Trash2 } from "lucide-react";
import { deleteCustomerAction } from "@/app/actions/customers";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  EditCustomerModal,
  type EditCustomerValues,
} from "@/modules/customers/components/edit-customer-modal";

type CustomerRowActionsProps = {
  customer: EditCustomerValues;
  canWrite: boolean;
};

export function CustomerRowActions({
  customer,
  canWrite,
}: CustomerRowActionsProps) {
  const t = useTranslations("customers");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setDeleteOpen(false);
    });
  }

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon-sm">
        <Link href={`/customers/${customer.id}`} aria-label={t("view")}>
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>
      {canWrite ? (
        <>
          <EditCustomerModal customer={customer} />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={(next) => {
              if (pending && !next) return;
              setDeleteOpen(next);
            }}
            title={t("deleteTitle")}
            description={t("deleteConfirm", { name: customer.name })}
            confirmLabel={t("delete")}
            variant="danger"
            loading={pending && deleteOpen}
            onConfirm={onConfirmDelete}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={pending}
                className="text-danger hover:bg-danger/5 hover:text-danger"
                aria-label={t("delete")}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            }
          />
        </>
      ) : null}
    </div>
  );
}
