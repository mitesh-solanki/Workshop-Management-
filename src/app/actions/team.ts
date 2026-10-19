"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { inviteTeamMember } from "@/modules/team/service";
import type { CreateInviteInput } from "@/modules/team/schema";

export type TeamActionState = {
  ok: boolean;
  message?: string;
  inviteUrl?: string;
};

export async function inviteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const session = await requireSession();
    const result = await inviteTeamMember(session, {
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "") as CreateInviteInput["role"],
    });
    revalidatePath("/team");
    return {
      ok: true,
      message: "invited",
      inviteUrl: result.inviteUrl,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}
