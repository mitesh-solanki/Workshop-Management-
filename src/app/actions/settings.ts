"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
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
  try {
    const session = await requireSession();
    await updateGarageSettings(session, {
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      gstin: String(formData.get("gstin") ?? ""),
    });
    revalidatePath("/settings");
    return { ok: true, message: "saved" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}
