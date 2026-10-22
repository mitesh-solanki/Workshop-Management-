import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RoleBadgeProps = {
  label: string;
  className?: string;
};

export function RoleBadge({ label, className }: RoleBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn("min-h-7 rounded-md font-medium", className)}
    >
      {label}
    </Badge>
  );
}
