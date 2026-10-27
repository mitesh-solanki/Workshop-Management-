"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  deleteServiceOrderLineAction,
  updateServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  formatRupees,
  isZeroRupeesInput,
  multiplyByQuantity,
  paiseToRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import { cn } from "@/lib/utils";

type Line = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  partId?: string | null;
};

type Props = {
  orderId: string;
  canMutate: boolean;
  lines: Line[];
  canRequestParts?: boolean;
};

const initial: ServiceOrderActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const actionBtnClass =
  "size-11 min-h-11 min-w-11 rounded-lg border border-slate-300 bg-white shadow-xs";

function parsePricePaise(raw: string, fallback: Paise): Paise {
  const parsed = parseRupeesToPaise(raw);
  return parsed === null ? fallback : parsed;
}

function TypeBadge({ type }: { type: string }) {
  const t = useTranslations("orders");
  const typeKey =
    type === "PART" || type === "LABOUR" ? type : "LABOUR";

  return (
    <span
      className={cn(
        "inline-flex w-max rounded-md px-2 py-1 text-[12px] font-bold",
        typeKey === "PART"
          ? "bg-amber-50 text-amber-800"
          : "bg-[#edf4ff] text-[#456cd8]",
      )}
    >
      {t(`lineTypes.${typeKey}`)}
    </span>
  );
}

function LineStat({
  value,
  label,
  emphasize = false,
}: {
  value: string;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[13px] font-semibold text-slate-600">{label}</p>
      <p
        className={cn(
          "text-[15px] font-extrabold tabular-nums text-slate-900",
          emphasize && "text-slate-950",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OrderLineCard({
  orderId,
  canMutate,
  canRequestParts,
  line,
}: {
  orderId: string;
  canMutate: boolean;
  canRequestParts: boolean;
  line: Line;
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const ti = useTranslations("inventory");
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, startRemove] = useTransition();
  const bound = useMemo(
    () => updateServiceOrderLineAction.bind(null, orderId, line.id),
    [orderId, line.id],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const savedTotal = multiplyByQuantity(line.unitPricePaise, line.quantity);

  const [draftQty, setDraftQty] = useState(line.quantity);
  const [draftPricePaise, setDraftPricePaise] = useState(
    line.unitPricePaise as Paise,
  );
  const liveTotal = multiplyByQuantity(draftPricePaise, draftQty);

  function beginEdit() {
    setDraftQty(line.quantity);
    setDraftPricePaise(line.unitPricePaise as Paise);
    setEditing(true);
  }

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(state.message);
      queueMicrotask(() => setEditing(false));
    } else {
      toast.error(state.message);
    }
  }, [state]);

  function onConfirmDelete() {
    startRemove(async () => {
      const result = await deleteServiceOrderLineAction(orderId, line.id);
      if (result.ok) {
        setDeleteOpen(false);
        toast.success(result.message ?? t("lineRemoved"));
        return;
      }
      toast.error(result.message ?? t("errors.deleteFailed"));
    });
  }

  const actions = canMutate ? (
    <div className="flex shrink-0 items-center justify-end gap-2">
      {editing ? (
        <>
          <Button
            type="submit"
            form={`line-edit-${line.id}`}
            variant="outline"
            size="icon"
            loading={pending}
            className={cn(
              actionBtnClass,
              "text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
            )}
            aria-label={t("saveLine")}
            title={t("saveLine")}
          >
            <Check className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={pending || removing}
            className={cn(actionBtnClass, "text-slate-700 hover:bg-slate-50")}
            aria-label={t("cancelEdit")}
            title={t("cancelEdit")}
            onClick={() => setEditing(false)}
          >
            <X className="size-5" />
          </Button>
        </>
      ) : (
        <>
          {canRequestParts && line.type === "PART" && line.partId ? (
            <Button asChild variant="secondary" size="sm" className="min-h-11">
              <Link
                href={`/parts-requests?partId=${line.partId}&serviceOrderLineId=${line.id}`}
              >
                {ti("requestPart")}
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              actionBtnClass,
              "text-blue-700 hover:border-blue-300 hover:bg-blue-50",
            )}
            aria-label={t("editLine")}
            title={t("editLine")}
            onClick={beginEdit}
          >
            <Pencil className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              actionBtnClass,
              "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
            )}
            aria-label={t("removeLine")}
            title={t("removeLine")}
            disabled={removing || pending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-5" />
          </Button>
        </>
      )}
    </div>
  ) : null;

  const deleteDialog = (
    <Dialog
      open={deleteOpen}
      onOpenChange={(next) => {
        if (removing) return;
        setDeleteOpen(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("deleteLineTitle")}</DialogTitle>
          <DialogDescription>{t("deleteLineConfirm")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={removing}
            >
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            size="md"
            loading={removing}
            onClick={onConfirmDelete}
          >
            {t("removeLine")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (editing && canMutate) {
    return (
      <>
      {deleteDialog}
      <div className="rounded-[10px] border border-blue-200 bg-blue-50/40 p-3.5 sm:p-4">
        <form
          id={`line-edit-${line.id}`}
          key={`edit-${line.id}-${line.quantity}-${line.unitPricePaise}`}
          action={formAction}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] lg:gap-5">
            <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold text-slate-600">
                  {t("lineDescription")}
                </p>
                <TypeBadge type={line.type} />
              </div>
              <Input
                id={`line-desc-${line.id}`}
                name="description"
                required
                maxLength={500}
                defaultValue={line.description}
                className={controlClass}
                aria-label={t("lineDescription")}
              />
            </div>

            <div className="min-w-0">
              <p className="mb-1.5 text-[13px] font-semibold text-slate-600">
                {t("quantity")}
              </p>
              <QuantityStepper
                id={`line-qty-${line.id}`}
                name="quantity"
                label={t("quantity")}
                defaultValue={line.quantity}
                min={1}
                hideLabel
                onValueChange={setDraftQty}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor={`line-price-${line.id}`}
                className="mb-1.5 block text-[13px] font-semibold text-slate-600"
              >
                {t("unitPrice")}
              </label>
              <Input
                id={`line-price-${line.id}`}
                name="unitPriceRupees"
                type="text"
                inputMode="decimal"
                required
                defaultValue={paiseToRupeesInput(line.unitPricePaise)}
                className={cn(controlClass, "tabular-nums")}
                aria-label={t("unitPrice")}
                onFocus={(event) => {
                  if (isZeroRupeesInput(event.currentTarget.value)) {
                    event.currentTarget.select();
                  }
                }}
                onBeforeInput={(event) => {
                  const data = (event.nativeEvent as InputEvent).data;
                  if (data == null || data === "") return;
                  if (!/^[\d.]+$/.test(data)) event.preventDefault();
                }}
                onInput={(event) => {
                  const el = event.currentTarget;
                  const next = sanitizeRupeesTyping(el.value);
                  if (el.value !== next) el.value = next;
                  setDraftPricePaise(
                    parsePricePaise(next, line.unitPricePaise as Paise),
                  );
                }}
              />
            </div>

            <LineStat
              value={formatRupees(liveTotal)}
              label={t("lineSubtotal")}
              emphasize
            />

            <div className="flex justify-start lg:justify-end">
              {actions}
            </div>
          </div>

          {line.type === "PART" ? (
            <p className="text-[13px] text-slate-600">{t("editPartQtyHint")}</p>
          ) : null}
        </form>
      </div>
      </>
    );
  }

  return (
    <>
      {deleteDialog}
      <div className="rounded-[10px] border border-[#e8edf5] bg-[#fafcff] p-3.5 sm:p-4">
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] lg:gap-5">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-slate-600">
                {t("lineDescription")}
              </p>
              <TypeBadge type={line.type} />
            </div>
            <h4 className="text-[15px] font-semibold leading-snug text-slate-900">
              {line.description}
            </h4>
          </div>

          <LineStat value={String(line.quantity)} label={t("quantity")} />
          <LineStat
            value={formatRupees(line.unitPricePaise)}
            label={t("unitPrice")}
          />
          <LineStat
            value={formatRupees(savedTotal)}
            label={t("lineSubtotal")}
            emphasize
          />

          {actions ? (
            <div className="flex justify-start border-t border-slate-200 pt-3 sm:col-span-2 lg:col-span-1 lg:justify-end lg:border-0 lg:pt-0">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function OrderLinesTable({
  orderId,
  canMutate,
  lines,
  canRequestParts = false,
}: Props) {
  return (
    <div className="grid gap-2.5">
      {lines.map((line) => (
        <OrderLineCard
          key={line.id}
          orderId={orderId}
          canMutate={canMutate}
          canRequestParts={canRequestParts}
          line={line}
        />
      ))}
    </div>
  );
}
