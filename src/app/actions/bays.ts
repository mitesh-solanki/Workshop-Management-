"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  createBayRecord,
  deleteBayRecord,
  updateBayRecord,
} from "@/modules/bays/service";

export type BayActionState = {
  ok: boolean;
  message?: string;
  bayId?: string;
  fieldErrors?: Record<string, string>;
};

export async function createBayModalAction(
  _prev: BayActionState,
  formData: FormData,
): Promise<BayActionState> {
  const t = await getTranslations("bays");
  try {
    const session = await requireSession();
    const bay = await createBayRecord(session, {
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/bays");
    return {
      ok: true,
      message: t("created"),
      bayId: bay.id,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function updateBayModalAction(
  bayId: string,
  _prev: BayActionState,
  formData: FormData,
): Promise<BayActionState> {
  const t = await getTranslations("bays");
  try {
    const session = await requireSession();
    await updateBayRecord(session, bayId, {
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/bays");
    return { ok: true, message: t("updated"), bayId };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function deleteBayAction(bayId: string): Promise<BayActionState> {
  const t = await getTranslations("bays");
  try {
    const session = await requireSession();
    await deleteBayRecord(session, bayId);
    revalidatePath("/bays");
    return { ok: true, message: t("deleted") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}
