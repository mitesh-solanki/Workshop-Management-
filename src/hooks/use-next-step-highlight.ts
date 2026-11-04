"use client";

import { useEffect, useState } from "react";

/** How long next-step tips stay visible (toast + border flash). */
export const NEXT_STEP_DURATION_MS = 7000;

/**
 * Brief border highlight to point at the next step.
 * Pass a changing truthy key (e.g. vehicle id or pulse count) to re-trigger.
 */
export function useNextStepHighlight(
  active: boolean | number | string | null | undefined,
  ms = NEXT_STEP_DURATION_MS,
) {
  const [highlighted, setHighlighted] = useState(false);
  const isActive = Boolean(active);

  useEffect(() => {
    if (!isActive) return;
    const start = window.setTimeout(() => setHighlighted(true), 0);
    const end = window.setTimeout(() => setHighlighted(false), ms);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [active, isActive, ms]);

  return isActive && highlighted;
}

/** Alternate which of N buttons gets the border (0, 1, 0, 1…). */
export function useSequentialNextStepIndex(
  active: boolean,
  count: number,
  stepMs = 1400,
) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || count < 1) return;
    const start = window.setTimeout(() => setIndex(0), 0);
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, stepMs);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [active, count, stepMs]);

  return active ? index : -1;
}

export const NEXT_STEP_HIGHLIGHT_CLASS =
  "ring-2 ring-blue-500 ring-offset-2 ring-offset-white transition-[box-shadow] duration-300";

/** Rounded animated outline only — applied one button at a time. */
export const NEXT_STEP_ACTION_BORDER_CLASS = "next-step-border";

export const HIGHLIGHT_VEHICLE_ACTIONS_KEY = "wm:highlight-vehicle-actions";
