import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  /** Hint shown under the control when there is no error. */
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Usage:
 * <FormField id="name" label="Name" error={errors.name}>
 *   <Input id="name" name="name" aria-invalid={!!errors.name} />
 * </FormField>
 */
function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={errorId} className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
