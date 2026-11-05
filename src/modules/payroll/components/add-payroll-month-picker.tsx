"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MonthYearPicker } from "@/modules/payroll/components/month-year-picker";
import { cn } from "@/lib/utils";

type Props = {
  yearMonth: string;
  className?: string;
};

export function AddPayrollMonthPicker({ yearMonth, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <MonthYearPicker
      yearMonth={yearMonth}
      disabled={pending}
      className={cn(className)}
      onChange={(next) => {
        startTransition(() => {
          router.replace(`${pathname}?month=${next}`);
        });
      }}
    />
  );
}
