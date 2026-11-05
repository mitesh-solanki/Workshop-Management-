"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ReportChartPoint = {
  key: string;
  label: string;
  amountPaise: number;
  href?: string;
};

export type ReportChartVariant = "line" | "donut" | "bar";

type Props = {
  points: ReportChartPoint[];
  valueLabel: string;
  variant: ReportChartVariant;
  /** money = paise chart (default). number = raw counts on amountPaise. */
  valueFormat?: "money" | "number";
  className?: string;
};

const DONUT_COLORS = [
  "#2563eb",
  "#0d9488",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#ea580c",
  "#4f46e5",
];

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function shortLabel(value: string, max = 16) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function hrefFromClick(item: unknown): string | null {
  if (
    item &&
    typeof item === "object" &&
    "payload" in item &&
    item.payload &&
    typeof item.payload === "object" &&
    "href" in item.payload &&
    typeof item.payload.href === "string"
  ) {
    return item.payload.href;
  }
  return null;
}

export function ReportChart({
  points,
  valueLabel,
  variant,
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

  // Line charts keep zero buckets so the stroke stays continuous across the period.
  // Donut/bar drop zeros so empty categories do not clutter the chart.
  const chartPoints =
    variant === "line"
      ? points
      : points.filter((point) => point.amountPaise > 0);

  const data = chartPoints.map((point) => ({
    key: point.key,
    label: point.label,
    amount:
      valueFormat === "number" ? point.amountPaise : point.amountPaise / 100,
    amountPaise: point.amountPaise,
    href: point.href,
  }));

  if (data.length === 0) {
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

  function formatValue(value: unknown) {
    return valueFormat === "number"
      ? String(value)
      : formatRupees(Math.round(Number(value) * 100));
  }

  function goToHref(item: unknown) {
    const href = hrefFromClick(item);
    if (href) router.push(href);
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-3",
        className,
      )}
    >
      {variant === "line" ? (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[220px] w-full"
        >
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id="reportAmountFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              content={
                <ChartTooltipContent formatter={(value) => formatValue(value)} />
              }
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#reportAmountFill)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (
                  typeof cx !== "number" ||
                  typeof cy !== "number" ||
                  !payload ||
                  typeof payload !== "object" ||
                  !("amountPaise" in payload) ||
                  Number(payload.amountPaise) <= 0
                ) {
                  return null;
                }
                return (
                  <circle
                    key={`dot-${String("key" in payload ? payload.key : cx)}`}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="#2563eb"
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ChartContainer>
      ) : null}

      {variant === "bar" ? (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: Math.min(320, Math.max(180, data.length * 40 + 24)) }}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={compactNumber}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={108}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tickFormatter={(value: string) => shortLabel(value)}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => {
                    const first = payload?.[0]?.payload as
                      | { label?: string }
                      | undefined;
                    return first?.label ?? valueLabel;
                  }}
                  formatter={(value) => formatValue(value)}
                />
              }
            />
            <Bar
              dataKey="amount"
              fill="var(--color-amount)"
              radius={[0, 6, 6, 0]}
              maxBarSize={28}
              cursor={data.some((row) => row.href) ? "pointer" : undefined}
              onClick={goToHref}
            />
          </BarChart>
        </ChartContainer>
      ) : null}

      {variant === "donut" ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-10 sm:pl-8">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[200px] w-[200px] shrink-0 sm:mx-0 sm:ml-4"
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="label"
                    labelFormatter={(_label, payload) => {
                      const first = payload?.[0]?.payload as
                        | { label?: string }
                        | undefined;
                      return first?.label ?? valueLabel;
                    }}
                    formatter={(value) => formatValue(value)}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="amount"
                nameKey="label"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                strokeWidth={2}
                stroke="#f8fafc"
                cursor={data.some((row) => row.href) ? "pointer" : undefined}
                onClick={goToHref}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="mx-auto w-fit space-y-2 px-1 sm:mx-0">
            {data.slice(0, 6).map((entry, index) => (
              <li key={entry.key} className="flex items-center gap-3 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                  }}
                  aria-hidden
                />
                {entry.href ? (
                  <button
                    type="button"
                    className="max-w-40 truncate text-left font-medium text-slate-700 hover:text-blue-700 hover:underline"
                    onClick={() => router.push(entry.href!)}
                  >
                    {entry.label}
                  </button>
                ) : (
                  <span className="max-w-40 truncate font-medium text-slate-700">
                    {entry.label}
                  </span>
                )}
                <span className="tabular-nums font-semibold text-slate-600">
                  {formatValue(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
