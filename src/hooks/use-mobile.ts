import * as React from "react";

/** Match Tailwind `lg` so the desktop sidebar stays until 1024px. */
const MOBILE_BREAKPOINT = 1024;

function getIsMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getIsMobile, () => false);
}
