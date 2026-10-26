"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Trash2 } from "lucide-react";
import { deleteDirectSaleAction } from "@/app/actions/inventory";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type {
  DirectSaleCustomerOption,
  DirectSalePartOption,
} from "@/modules/inventory/components/direct-sale-form";
import { DirectSaleViewModal } from "@/modules/inventory/components/direct-sale-view-modal";
import { EditDirectSaleModal } from "@/modules/inventory/components/edit-direct-sale-modal";
import type { DirectSaleTableRow } from "@/modules/inventory/components/direct-sales-table";

type Props = {
  sale: DirectSaleTableRow;
  canWrite: boolean;
  parts: DirectSalePartOption[];
  customers: DirectSaleCustomerOption[];
};

export function DirectSaleRowActions({
  sale,
  canWrite,
  parts,
  customers,
}: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const buyer = sale.customer?.name
    ? sale.customer.name
    : sale.walkInName?.trim()
      ? `${t("walkIn")} · ${sale.walkInName.trim()}`
      : t("walkIn");

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteDirectSaleAction(sale.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("saleDeleted"));
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="flex items-center justify-end gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("view")}
          onClick={() => setViewOpen(true)}
        >
          <Eye className="size-4" aria-hidden />
        </Button>
        {canWrite ? (
          <>
            <EditDirectSaleModal
              sale={sale}
              parts={parts}
              customers={customers}
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending}
              className="text-danger hover:bg-danger/5 hover:text-danger"
              aria-label={t("deleteSale")}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>

      <DirectSaleViewModal
        sale={sale}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteOpen(false);
        }}
        title={t("deleteSaleTitle")}
        description={t("deleteSaleConfirm", { buyer })}
        confirmLabel={t("deleteSale")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
