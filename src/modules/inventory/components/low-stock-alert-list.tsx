import Link from "next/link";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListCardGroup } from "@/components/ui/list-card";
import { cn } from "@/lib/utils";

type LowStockPart = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantityOnHand: number;
  lowStockLevel: number;
};

type LowStockAlertListProps = {
  parts: LowStockPart[];
  canRequest?: boolean;
  requestLabel: string;
  limit?: number;
};

export async function LowStockAlertList({
  parts,
  canRequest = false,
  requestLabel,
  limit = 8,
}: LowStockAlertListProps) {
  const ti = await getTranslations("inventory");
  const items = parts.slice(0, limit);

  return (
    <ListCardGroup>
      {items.map((part) => {
        const outOfStock = part.quantityOnHand <= 0;
        const unitLabel =
          part.unit === "pcs" ||
          part.unit === "set" ||
          part.unit === "pair" ||
          part.unit === "litre" ||
          part.unit === "ml" ||
          part.unit === "kg" ||
          part.unit === "g" ||
          part.unit === "metre"
            ? ti(`units.${part.unit}`)
            : part.unit;

        return (
          <li key={part.id} className="list-none">
            <div
              className={cn(
                "flex min-h-14 flex-col gap-2.5 px-3 py-3 transition-colors sm:flex-row sm:items-center sm:gap-3",
                "hover:bg-slate-50 has-[:focus-visible]:bg-slate-50",
              )}
            >
              <Link
                href={`/inventory/${part.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    outOfStock
                      ? "bg-danger/10 text-danger"
                      : "bg-amber-50 text-amber-800",
                  )}
                  aria-hidden
                >
                  <Package className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-body font-medium text-slate-900">
                    {part.name}
                  </p>
                  <p className="truncate text-caption text-slate-600">
                    {part.sku}
                    <span className="text-slate-400"> · </span>
                    {ti("stockAlertAt", {
                      count: part.lowStockLevel,
                      unit: unitLabel,
                    })}
                  </p>
                </div>
                <Badge
                  variant={outOfStock ? "danger" : "warning"}
                  className="shrink-0"
                >
                  {ti("stockCount", {
                    count: part.quantityOnHand,
                    unit: unitLabel,
                  })}
                </Badge>
              </Link>
              {canRequest ? (
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                >
                  <Link href={`/parts-requests?partId=${part.id}`}>
                    {requestLabel}
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ListCardGroup>
  );
}
