"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import {
  hasNavigatedAfterCreate,
  isAlreadyOnCreateTarget,
  markNavigatedAfterCreate,
} from "@/lib/create-modal-navigation";

export type CreateModalSuccess = {
  id: string;
  message?: string;
} | null;

type Options = {
  /** Entity key for sessionStorage, e.g. "customer", "vendor", "part". */
  kind: string;
  /** Pass `{ id, message }` on successful create; otherwise `null`. */
  success: CreateModalSuccess;
  hrefForId: (id: string) => string;
  onReset?: () => void;
  /** Set false when the caller already toasted. Default true. */
  toastOnSuccess?: boolean;
  defaultOpen?: boolean;
};

/**
 * Owns dialog `open` for create → detail flows.
 * Close → replace (not push). Does not block opening Add again after a create.
 */
export function useCreateModalNavigation({
  kind,
  success,
  hrefForId,
  onReset,
  toastOnSuccess = true,
  defaultOpen = false,
}: Options) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  /** Success ids we already navigated for (sticky useActionState must not re-fire). */
  const navigatedIdRef = useRef<string | null>(null);
  const onResetRef = useRef(onReset);
  const hrefForIdRef = useRef(hrefForId);
  onResetRef.current = onReset;
  hrefForIdRef.current = hrefForId;

  // Only auto-close on bfcache restore — never when the user clicks Add again.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      if (!success?.id) return;
      if (!hasNavigatedAfterCreate(kind, success.id)) return;
      setOpen(false);
      onResetRef.current?.();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [success?.id, kind]);

  useEffect(() => {
    if (!success?.id) return;
    if (navigatedIdRef.current === success.id) return;

    const recordId = success.id;
    const href = hrefForIdRef.current(recordId);

    // Already finished this create (Back restored sticky action state).
    if (
      hasNavigatedAfterCreate(kind, recordId) ||
      isAlreadyOnCreateTarget(href)
    ) {
      navigatedIdRef.current = recordId;
      return;
    }

    navigatedIdRef.current = recordId;
    markNavigatedAfterCreate(kind, recordId);
    if (toastOnSuccess && success.message) {
      toast.success(success.message);
    }

    const timer = window.setTimeout(() => {
      setOpen(false);
      onResetRef.current?.();
      router.replace(href);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [success, kind, router, toastOnSuccess]);

  function onOpenChange(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    setOpen(false);
    onResetRef.current?.();
  }

  return {
    open,
    setOpen,
    onOpenChange,
  };
}
