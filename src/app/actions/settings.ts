"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AppError } from "@/lib/errors";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import { updateGarageSettings } from "@/modules/settings/service";

export type SettingsActionState = {
  ok: boolean;
  message?: string;
};

export async function updateGarageSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const t = await getTranslations("settings");

  try {
    const session = await requireSession();
    await updateGarageSettings(session, {
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      gstin: String(formData.get("gstin") ?? ""),
    });
    revalidatePath("/settings");
    return { ok: true, message: t("saved") };
  } catch (error) {
    if (error instanceof AppError && error.code === "errors.forbidden") {
      return { ok: false, message: t("readOnly") };
    }
    return { ok: false, message: await translateError(error) };
  }
}
