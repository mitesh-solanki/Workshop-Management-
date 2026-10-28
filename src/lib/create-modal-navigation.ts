/**
 * Shared helpers for create-modals that navigate to a detail (or list) page.
 *
 * Why this exists: React/Next keep the list page in history (or bfcache) with
 * `open === true`. Back then restores the dialog. One pattern for every module:
 * mark success → close dialog → `router.replace` (not push).
 */

export function createModalNavStorageKey(kind: string, recordId: string): string {
  return `wm:created:${kind}:${recordId}`;
}

export function hasNavigatedAfterCreate(
  kind: string,
  recordId: string,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(createModalNavStorageKey(kind, recordId)) === "1"
    );
  } catch {
    return false;
  }
}

export function markNavigatedAfterCreate(
  kind: string,
  recordId: string,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(createModalNavStorageKey(kind, recordId), "1");
  } catch {
    // private mode / blocked storage — navigation still proceeds
  }
}

/** True when the browser is already on the target path (ignore query). */
export function isAlreadyOnCreateTarget(href: string): boolean {
  if (typeof window === "undefined") return false;
  const pathOnly = href.split("?")[0] || href;
  return window.location.pathname === pathOnly;
}

type ReplaceRouter = { replace: (href: string) => void };

/**
 * Imperative finish for create flows that can't use the hook (async upload, etc.).
 * Always: mark → close → replace (never push).
 */
export function finishCreateModalNavigation(options: {
  kind: string;
  recordId: string;
  href: string;
  router: ReplaceRouter;
  close: () => void;
}): void {
  const { kind, recordId, href, router, close } = options;
  if (
    hasNavigatedAfterCreate(kind, recordId) ||
    isAlreadyOnCreateTarget(href)
  ) {
    close();
    return;
  }
  markNavigatedAfterCreate(kind, recordId);
  close();
  router.replace(href);
}
