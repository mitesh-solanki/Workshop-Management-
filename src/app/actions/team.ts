"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { AppError } from "@/lib/errors";
import {
  translateError,
  translateZodFieldErrors,
} from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import {
  changeMemberRole,
  copyInviteAcceptLink,
  inviteTeamMember,
  removeMember,
  resendInvite,
  revokeInvite,
  sendMemberPasswordReset,
  setMemberActive,
  setMemberPassword,
  updateMember,
} from "@/modules/team/service";
import type {
  ChangeMemberRoleInput,
  CreateInviteInput,
} from "@/modules/team/schema";

export type TeamActionState = {
  ok: boolean;
  message?: string;
  acceptUrl?: string;
  resetUrl?: string;
  fieldErrors?: Record<string, string>;
};

export async function inviteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const locale = await getLocale();
    const result = await inviteTeamMember(
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
      message: result.emailSent
        ? t("inviteCreated")
        : t("inviteCreatedCopyLink"),
      acceptUrl: result.acceptUrl,
    };
  } catch (error) {
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
    const result = await resendInvite(session, { inviteId }, { locale });
    revalidatePath("/team");
    return {
      ok: true,
      message: result.emailSent
        ? t("inviteResent")
        : t("inviteCreatedCopyLink"),
      acceptUrl: result.acceptUrl,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function copyInviteLinkAction(
  inviteId: string,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const result = await copyInviteAcceptLink(session, { inviteId });
    revalidatePath("/team");
    return {
      ok: true,
      message: t("inviteLinkCopied"),
      acceptUrl: result.acceptUrl,
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

export async function updateMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const userId = String(formData.get("userId") ?? "");
    await updateMember(session, {
      userId,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "") as ChangeMemberRoleInput["role"],
    });
    revalidatePath("/team");
    revalidatePath(`/team/${userId}`);
    return { ok: true, message: t("memberUpdated") };
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

export async function setMemberActiveAction(
  userId: string,
  isActive: boolean,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    await setMemberActive(session, { userId, isActive });
    revalidatePath("/team");
    revalidatePath(`/team/${userId}`);
    return {
      ok: true,
      message: isActive ? t("memberEnabled") : t("memberDisabled"),
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function setMemberPasswordAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const userId = String(formData.get("userId") ?? "");
    await setMemberPassword(session, {
      userId,
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    revalidatePath("/team");
    revalidatePath(`/team/${userId}`);
    return { ok: true, message: t("passwordUpdated") };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: await translateError(error),
        fieldErrors: await translateZodFieldErrors(error),
      };
    }
    if (error instanceof AppError && error.code === "auth.password_reuse") {
      const message = await translateError(error);
      return {
        ok: false,
        message,
        fieldErrors: { password: message },
      };
    }
    return { ok: false, message: await translateError(error) };
  }
}

export async function sendMemberPasswordResetAction(
  userId: string,
): Promise<TeamActionState> {
  const t = await getTranslations("team");

  try {
    const session = await requireSession();
    const locale = await getLocale();
    const result = await sendMemberPasswordReset(
      session,
      { userId },
      { locale },
    );
    revalidatePath(`/team/${userId}`);
    return {
      ok: true,
      message: result.emailSent
        ? t("passwordResetSent")
        : t("passwordResetCopyLink"),
      resetUrl: result.resetUrl ?? undefined,
    };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}
