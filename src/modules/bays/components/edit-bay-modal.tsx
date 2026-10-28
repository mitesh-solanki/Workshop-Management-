"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateBayModalAction,
  type BayActionState,
} from "@/app/actions/bays";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { BAY_NAME_MAX } from "@/modules/bays/schema";

const initial: BayActionState = { ok: false };

export type EditBayValues = {
  id: string;
  name: string;
};

type Props = {
  bay: EditBayValues;
  trigger?: React.ReactNode;
};

export function EditBayModal({ bay, trigger }: Props) {
  const t = useTranslations("bays");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(bay.name);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const boundUpdate = useMemo(
    () => updateBayModalAction.bind(null, bay.id),
    [bay.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(bay.name);
      setFieldError(undefined);
    }
  }, [open, bay.name]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  function validateClient(): boolean {
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError(te("validation.required"));
      window.setTimeout(() => {
        document.getElementById(`edit-bay-name-${bay.id}`)?.focus();
      }, 50);
      return false;
    }
    if (trimmed.length > BAY_NAME_MAX) {
      setFieldError(te("validation.tooLong"));
      return false;
    }
    setFieldError(undefined);
    return true;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setFieldError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editSubtitle")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            action={(formData) => {
              if (!validateClient()) return;
              formAction(formData);
            }}
            className="flex flex-col gap-4"
          >
            <FormField
              id={`edit-bay-name-${bay.id}`}
              label={t("name")}
              error={fieldError}
            >
              <Input
                id={`edit-bay-name-${bay.id}`}
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
                maxLength={BAY_NAME_MAX}
                autoFocus
                placeholder={t("namePlaceholder")}
                aria-invalid={Boolean(fieldError)}
                className="h-11 min-h-11"
              />
            </FormField>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
