"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatOrderTimelineEvent } from "@/modules/service-orders/format-order-timeline-event";
import { OrderTimeline } from "@/modules/service-orders/components/order-timeline";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";

type TimelineEvent = {
  id: string;
  action: string;
  meta: unknown;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string } | null;
};

type Props = {
  events: TimelineEvent[];
};

function formatDateTime(value: Date, locale: string, empty: string) {
  if (Number.isNaN(value.getTime())) return empty;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function JobCardTimeline({ events }: Props) {
  const t = useTranslations("orders");
  const tb = useTranslations("billing");
  const locale = useLocale();

  const moneyLocale = locale === "hi" ? "hi-IN" : locale === "gu" ? "gu-IN" : "en-IN";

  return (
    <OrderTimeline
      events={events}
      emptyLabel={t("timelineEmpty")}
      formatActor={(actor) =>
        actor ? actor.name?.trim() || actor.email : t("timelineUnknownActor")
      }
      formatWhen={(date) => formatDateTime(date, locale, t("notSet"))}
      formatEvent={(event) => {
        const meta =
          event.meta && typeof event.meta === "object"
            ? (event.meta as Record<string, unknown>)
            : {};

        return formatOrderTimelineEvent(
          event.action,
          meta,
          {
            fallbackDescription: t("lineDescription"),
            created: (status) => t("timelineCreated", { status }),
            statusChanged: (from, to) =>
              t("timelineStatusChanged", { from, to }),
            lineAdded: (description, quantity, price) =>
              t("timelineLineAdded", { description, quantity, price }),
            lineRemoved: (description, quantity, price) =>
              t("timelineLineRemoved", { description, quantity, price }),
            lineUpdated: (description) =>
              t("timelineLineUpdated", { description }),
            lineUpdatedWithChanges: (description, changes) =>
              t("timelineLineUpdatedWithChanges", { description, changes }),
            changeQuantity: (from, to) =>
              t("timelineChangeQuantity", { from, to }),
            changePrice: (from, to) => t("timelineChangePrice", { from, to }),
            changeName: (from, to) => t("timelineChangeName", { from, to }),
            detailsUpdated: t("timelineUpdated"),
            cataloguePrices: (count) =>
              t("timelineCataloguePrices", { count }),
            billDraft: (amount) => t("timelineBillDraft", { amount }),
            billDraftNoAmount: t("timelineBillDraftNoAmount"),
            billFinalized: (invoiceNumber, amount) =>
              t("timelineBillFinalized", { invoiceNumber, amount }),
            billFinalizedNoAmount: (invoiceNumber) =>
              t("timelineBillFinalizedNoAmount", { invoiceNumber }),
            billDraftDeleted: t("timelineBillDraftDeleted"),
            paymentReceived: (method, amount) =>
              t("timelinePaymentReceived", { method, amount }),
            refundGiven: (method, amount) =>
              t("timelineRefundGiven", { method, amount }),
            creditNote: (creditNoteNumber, amount, reason) =>
              t("timelineCreditNote", { creditNoteNumber, amount, reason }),
            statusLabel: (status) => {
              const known = [
                "WAITING",
                "INSPECTION",
                "IN_PROGRESS",
                "WAITING_FOR_PARTS",
                "READY",
                "COMPLETED",
              ] as const satisfies readonly ServiceOrderStatusValue[];
              return known.includes(status as ServiceOrderStatusValue)
                ? t(`statuses.${status as ServiceOrderStatusValue}`)
                : status;
            },
            methodLabel: (method) => {
              if (
                method === "CASH" ||
                method === "UPI" ||
                method === "CARD" ||
                method === "MIXED"
              ) {
                return tb(`methods.${method}`);
              }
              return method;
            },
            reasonLabel: (reason) => {
              if (
                reason === "CORRECTION" ||
                reason === "REFUND" ||
                reason === "OTHER"
              ) {
                return tb(`reasons.${reason}`);
              }
              return reason;
            },
          },
          moneyLocale,
        );
      }}
    />
  );
}
