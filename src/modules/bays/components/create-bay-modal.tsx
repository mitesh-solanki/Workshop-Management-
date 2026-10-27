"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createBayModalAction,
  type BayActionState,
} from "@/app/actions/bays";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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

type Props = {
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreateBayModal({ trigger, size = "md" }: Props) {
  const t = useTranslations("bays");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [state, formAction, pending] = useActionState(
    createBayModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      const id = window.setTimeout(() => {
        setOpen(false);
        setName("");
        setFieldError(undefined);
        router.refresh();
      }, 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  function validateClient(): boolean {
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError(te("validation.required"));
      window.setTimeout(() => {
        document.getElementById("modal-bay-name")?.focus();
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
          return;
        }
        setName("");
        setFieldError(undefined);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size={size}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          action={(formData) => {
            if (!validateClient()) return;
            formAction(formData);
          }}
          className="flex flex-col gap-4 px-5 py-4"
        >
          <FormField
            id="modal-bay-name"
            label={t("name")}
            error={fieldError}
          >
            <Input
              id="modal-bay-name"
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

          <DialogFooter className="gap-2 border-t border-border pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
