"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onReset: () => void;
  label: string;
  /** True when search/sort/status are already at defaults. */
  disabled?: boolean;
};

/** Icon control at the end of list toolbars — clears search, filters and sort. */
export function ListFiltersResetButton({
  onReset,
  label,
  disabled = false,
}: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={disabled}
      aria-label={label}
      title={label}
      className="min-h-11 min-w-11 shrink-0"
      onClick={onReset}
    >
      <RefreshCw className="size-4 shrink-0" aria-hidden />
    </Button>
  );
}
