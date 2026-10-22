"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  changeMemberRole,
  inviteTeamMember,
  removeMember,
  resendInvite,
  revokeInvite,
} from "@/modules/team/service";
import type {
  ChangeMemberRoleInput,
  CreateInviteInput,
} from "@/modules/team/schema";

export type TeamActionState = {
  ok: boolean;
  message?: string;
};

export async function inviteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const locale = await getLocale();
    await inviteTeamMember(
      session,
      {
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "") as CreateInviteInput["role"],
      },
      { locale },
    );
    revalidatePath("/team");
    return {
      ok: true,
      message: t("inviteCreated"),
    };
  } catch (error) {
    // Invite may already exist when Resend fails — refresh pending list.
    revalidatePath("/team");
    return { ok: false, message: await translateError(error) };
  }
}

export async function resendInviteAction(
  inviteId: string,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const locale = await getLocale();
    await resendInvite(session, { inviteId }, { locale });
    revalidatePath("/team");
    return {
      ok: true,
      message: t("inviteResent"),
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function revokeInviteAction(
  inviteId: string,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    await revokeInvite(session, { inviteId });
    revalidatePath("/team");
    return { ok: true, message: t("inviteRevoked") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function changeMemberRoleAction(
  userId: string,
  role: ChangeMemberRoleInput["role"],
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    await changeMemberRole(session, { userId, role });
    revalidatePath("/team");
    return { ok: true, message: t("roleUpdated") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function removeMemberAction(
  userId: string,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    await removeMember(session, { userId });
    revalidatePath("/team");
    return { ok: true, message: t("memberRemoved") };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}
