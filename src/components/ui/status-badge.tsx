import { Badge } from "@/components/ui/badge";
import {
  serviceOrderStatusClass,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: ServiceOrderStatus;
  label: string;
  className?: string;
};

/** One colour per service-order status (tokens in globals.css). */
function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(serviceOrderStatusClass[status], className)}
    >
      {label}
    </Badge>
  );
}

export { StatusBadge };
