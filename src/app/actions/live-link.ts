"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { getClientIp } from "@/lib/client-ip";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import {
  approveEstimateLineViaLiveLink,
  createLiveLink,
  revokeLiveLinkForInspection,
  revokeLiveLinkForOrder,
  startPayViaLiveLink,
} from "@/modules/live-link/service";

export type LiveLinkActionState = {
  ok: boolean;
  message?: string;
  url?: string;
  expiresAt?: string;
  paymentLinkUrl?: string;
  qrImageDataUrl?: string;
  amountPaise?: number;
  alreadyPaid?: boolean;
};

export type LiveLinkTarget =
  | { serviceOrderId: string }
  | { inspectionId: string };

function revalidateLiveLinkTarget(target: LiveLinkTarget) {
  if ("serviceOrderId" in target) {
    revalidatePath(`/orders/${target.serviceOrderId}`);
    return;
  }
  revalidatePath(`/inspections/${target.inspectionId}`);
}

export async function createLiveLinkAction(
  target: LiveLinkTarget,
  _prev: LiveLinkActionState,
  formData: FormData,
): Promise<LiveLinkActionState> {
  try {
    const session = await requireSession();
    const rawHours = formData.get("expiresInHours");
    const expiresInHours =
      typeof rawHours === "string" && rawHours.length > 0
        ? Number.parseInt(rawHours, 10)
        : undefined;
    const result = await createLiveLink(session, {
      ...("serviceOrderId" in target
        ? { serviceOrderId: target.serviceOrderId }
        : { inspectionId: target.inspectionId }),
      ...(expiresInHours != null && !Number.isNaN(expiresInHours)
        ? { expiresInHours }
        : {}),
    });
    revalidateLiveLinkTarget(target);
    return {
      ok: true,
      message: "linkCreated",
      url: result.url,
      expiresAt: result.expiresAt.toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError
          ? await translateError(error)
          : await translateError(new AppError("errors.not_found")),
    };
  }
}

export async function revokeLiveLinkAction(
  target: LiveLinkTarget,
  _prev: LiveLinkActionState,
  _formData: FormData,
): Promise<LiveLinkActionState> {
  try {
    const session = await requireSession();
    if ("serviceOrderId" in target) {
      await revokeLiveLinkForOrder(session, target.serviceOrderId);
    } else {
      await revokeLiveLinkForInspection(session, target.inspectionId);
    }
    revalidateLiveLinkTarget(target);
    return { ok: true, message: "linkRevoked" };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError
          ? await translateError(error)
          : await translateError(new AppError("errors.not_found")),
    };
  }
}

export async function liveApproveLineAction(
  token: string,
  lineId: string,
  approvalState: "APPROVED" | "REJECTED",
  _prev: LiveLinkActionState,
  _formData: FormData,
): Promise<LiveLinkActionState> {
  try {
    const ip = await getClientIp();
    await approveEstimateLineViaLiveLink(token, ip, { lineId, approvalState });
    revalidatePath(`/live/${token}`);
    return {
      ok: true,
      message: approvalState === "APPROVED" ? "lineApproved" : "lineRejected",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError
          ? await translateError(error)
          : await translateError(new AppError("errors.not_found")),
    };
  }
}

export async function liveStartPayAction(
  token: string,
  invoiceId: string,
  _prev: LiveLinkActionState,
  _formData: FormData,
): Promise<LiveLinkActionState> {
  try {
    const ip = await getClientIp();
    const result = await startPayViaLiveLink(token, ip, { invoiceId });
    revalidatePath(`/live/${token}`);
    return {
      ok: true,
      message: "payReady",
      paymentLinkUrl: result.paymentLinkUrl ?? undefined,
      qrImageDataUrl: result.qrImageDataUrl ?? undefined,
      amountPaise: result.amountPaise,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "payments.nothing_due") {
      revalidatePath(`/live/${token}`);
      return { ok: true, alreadyPaid: true, amountPaise: 0 };
    }
    console.error("liveStartPayAction failed", error);
    if (error instanceof AppError) {
      return { ok: false, message: await translateError(error) };
    }
    return {
      ok: false,
      message: await translateError(
        new AppError("payments.provider_failed"),
      ),
    };
  }
}
