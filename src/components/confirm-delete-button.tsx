"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";

type DeleteState = {
  ok: boolean;
  message?: string;
};

type Props = {
  label: string;
  confirmingLabel: string;
  confirmMessage: string;
  className?: string;
  /** Map known action message keys to translated copy. */
  translateMessage?: (message: string) => string;
  /** Bound server action that deletes and redirects on success. */
  action: (
    prev: DeleteState,
    formData: FormData,
  ) => Promise<DeleteState>;
};

const initial: DeleteState = { ok: false };

/**
 * Destructive form submit with browser confirm. Shows server error when delete is blocked.
 */
export function ConfirmDeleteButton({
  label,
  confirmingLabel,
  confirmMessage,
  className,
  translateMessage,
  action,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const errorText =
    state.message && !state.ok
      ? (translateMessage?.(state.message) ?? state.message)
      : null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex min-h-12 shrink-0 items-center justify-center rounded-md border border-destructive px-4 text-base font-medium text-destructive disabled:opacity-60",
          className,
        )}
      >
        {pending ? confirmingLabel : label}
      </button>
      {errorText && (
        <p className="text-sm text-destructive" role="status">
          {errorText}
        </p>
      )}
    </form>
  );
}
