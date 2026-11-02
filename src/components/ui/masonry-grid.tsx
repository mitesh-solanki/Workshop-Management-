"use client";

import {
  Children,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type MasonryBreakpoint = {
  readonly minWidth: number;
  readonly columns: number;
};

type MasonryGridProps = {
  readonly children: ReactNode;
  readonly className?: string;
  /** Extra min-width → column count rules. */
  readonly breakpoints?: readonly MasonryBreakpoint[];
  /** Gap between columns and stacked cards (px). */
  readonly gap?: number;
};

const DEFAULT_BREAKPOINTS: readonly MasonryBreakpoint[] = [
  { minWidth: 420, columns: 2 },
  { minWidth: 1024, columns: 3 },
  { minWidth: 1280, columns: 4 },
];

const DEFAULT_GAP_PX = 16;

function useMasonryColumnCount(
  enabled: boolean,
  breakpoints: readonly MasonryBreakpoint[],
) {
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    if (!enabled) return;

    const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth);
    const mqls = sorted.map((bp) =>
      window.matchMedia(`(min-width: ${bp.minWidth}px)`),
    );

    const update = () => {
      const match = sorted.find((_, index) => mqls[index]!.matches);
      setColumnCount(match?.columns ?? 1);
    };

    update();
    mqls.forEach((mql) => mql.addEventListener("change", update));
    return () => {
      mqls.forEach((mql) => mql.removeEventListener("change", update));
    };
  }, [enabled, breakpoints]);

  return columnCount;
}

/**
 * Order-preserving masonry (from Cruise): LTR first row, then next row under
 * those columns — not CSS column-count, which fills top-to-bottom.
 */
export function MasonryGrid({
  children,
  className,
  breakpoints = DEFAULT_BREAKPOINTS,
  gap = DEFAULT_GAP_PX,
}: MasonryGridProps) {
  const [ready, setReady] = useState(false);
  const columnCount = useMasonryColumnCount(ready, breakpoints);
  const items = Children.toArray(children);
  const gapStyle = { gap: `${gap}px` } satisfies CSSProperties;

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className,
        )}
        style={gapStyle}
      >
        {children}
      </div>
    );
  }

  const columns: ReactNode[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount]!.push(item);
  });

  return (
    <div className={cn("flex items-start", className)} style={gapStyle}>
      {columns.map((columnItems, columnIndex) => (
        <div
          key={columnIndex}
          className="flex min-w-0 flex-1 flex-col"
          style={gapStyle}
        >
          {columnItems}
        </div>
      ))}
    </div>
  );
}
