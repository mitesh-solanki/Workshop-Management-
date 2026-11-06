"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/money";

export type PayrollAdvanceReminderItem = {
  id: string;
  label: string;
  openAdvancePaise: number;
};

type Props = {
  items: PayrollAdvanceReminderItem[];
  /** Reset dismiss when month filter changes. */
  yearMonth: string;
};

export function PayrollAdvanceReminder({ items, yearMonth }: Props) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [yearMonth]);

  if (dismissed || items.length === 0) return null;

  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 pr-2 pl-4"
      role="status"
    >
      <div className="min-w-0 flex-1 space-y-1 py-0.5 text-sm text-amber-950">
        {items.map((member) => (
          <p key={member.id}>
            <span className="font-semibold">{member.label}</span>
            {" — "}
            {t("addOpenAdvanceCard", {
              amount: formatRupees(member.openAdvancePaise, locale),
            })}
          </p>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-0 size-8 shrink-0 self-start text-amber-900 hover:bg-amber-100 hover:text-amber-950"
        aria-label={t("dismissOpenAdvanceReminders")}
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
