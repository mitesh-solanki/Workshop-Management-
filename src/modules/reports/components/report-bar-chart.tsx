"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";

type Point = {
  key: string;
  label: string;
  amountPaise: number;
  href?: string;
};

type Props = {
  points: Point[];
  valueLabel: string;
  /** money = paise chart (default). number = raw counts on amountPaise. */
  valueFormat?: "money" | "number";
  className?: string;
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function ReportBarChart({
  points,
  valueLabel,
  valueFormat = "money",
  className,
}: Props) {
  const t = useTranslations("reports");
  const router = useRouter();
  const chartConfig = {
    amount: {
      label: valueLabel,
      color: "#2563eb",
    },
  } satisfies ChartConfig;

  const data = points.map((point) => ({
    label: point.label,
    amount:
      valueFormat === "number" ? point.amountPaise : point.amountPaise / 100,
    amountPaise: point.amountPaise,
    href: point.href,
  }));
  const hasLinks = data.some((row) => Boolean(row.href));

  if (data.length === 0 || data.every((row) => row.amountPaise <= 0)) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500",
          className,
        )}
      >
        {t("chartEmpty")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-3",
        className,
      )}
    >
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[220px] w-full"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
            tickFormatter={compactNumber}
          />
          <ChartTooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  valueFormat === "number"
                    ? String(value)
                    : formatRupees(Math.round(Number(value) * 100))
                }
              />
            }
          />
          <Bar
            dataKey="amount"
            fill="var(--color-amount)"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
            cursor={hasLinks ? "pointer" : undefined}
            onClick={(item) => {
              const href =
                item &&
                typeof item === "object" &&
                "payload" in item &&
                item.payload &&
                typeof item.payload === "object" &&
                "href" in item.payload &&
                typeof item.payload.href === "string"
                  ? item.payload.href
                  : null;
              if (href) router.push(href);
            }}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
