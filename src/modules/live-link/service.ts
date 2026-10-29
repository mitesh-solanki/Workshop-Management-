import "server-only";

import { randomBytes } from "node:crypto";
import { AppError, NotFoundError } from "@/lib/errors";
import { insufficientStockError } from "@/modules/inventory/insufficient-stock-error";
import { getAppUrl } from "@/lib/email/env";
import { hashToken } from "@/lib/otp";
import {
  consumeRateLimit,
  LIVE_LINK_ACTION_RATE,
  LIVE_LINK_VIEW_RATE,
} from "@/lib/rate-limit";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { createPresignedDownloadUrl } from "@/lib/storage";
import { computeLineGst } from "@/lib/gst";
import { pendingBalancePaise, sumCreditNotesPaise } from "@/modules/billing/balance";
import { findServiceOrderById } from "@/modules/service-orders/repo";
import {
  createLiveLinkRow,
  findActiveLiveLinkForOrder,
  findEstimateLineForLive,
  findLiveLinkByTokenHash,
  loadLiveOrderSnapshot,
  recordOnlineLineApproval,
  revokeLiveLinksForOrder,
} from "@/modules/live-link/repo";
import {
  createLiveLinkSchema,
  LIVE_LINK_TTL_MS,
  liveApproveLineSchema,
  liveStartPaySchema,
  type CreateLiveLinkInput,
  type LiveApproveLineInput,
  type LiveStartPayInput,
} from "@/modules/live-link/schema";
import { startUpiPaymentForLiveLink } from "@/modules/payments/service";

const STAFF_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export type LiveLinkAccessFailure =
  | "wrong_token"
  | "expired"
  | "revoked"
  | "rate_limited";

export type PublicLiveView = {
  garageName: string;
  vehicleRegistration: string;
  vehicleLabel: string;
  status: string;
  expectedCompletion: string | null;
  media: Array<{
    id: string;
    kind: "PHOTO" | "VIDEO";
    url: string;
    contentType: string;
    itemLabel: string;
  }>;
  estimate: {
    revisionNumber: number;
    /** Customer may Agree / Disagree on pending lines via this page. */
    canCustomerApprove: boolean;
    lines: Array<{
      id: string;
      type: string;
      description: string;
      quantity: number;
      unitPricePaise: number;
      lineTotalPaise: number;
      approvalState: string;
    }>;
  } | null;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    totalPaise: number;
    pendingPaise: number;
    paid: boolean;
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      totalPaise: number;
    }>;
  } | null;
};

function liveUrlForToken(token: string) {
  return `${getAppUrl().replace(/\/$/, "")}/live/${token}`;
}

export async function createLiveLink(
  session: RoleSession,
  raw: CreateLiveLinkInput,
) {
  requireRole(session, STAFF_ROLES);
  const input = createLiveLinkSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, input.serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const ttlMs = input.expiresInHours
    ? input.expiresInHours * 60 * 60 * 1000
    : LIVE_LINK_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  const link = await createLiveLinkRow({
    garageId: session.garageId,
    serviceOrderId: order.id,
    tokenHash,
    expiresAt,
    createdById: session.userId,
  });

  return {
    id: link.id,
    expiresAt: link.expiresAt,
    url: liveUrlForToken(token),
    /** Raw token returned once at creation for copy; never stored. */
    token,
  };
}

export async function getLiveLinkStatusForOrder(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, STAFF_ROLES);
  const order = await findServiceOrderById(session.garageId, serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }
  const active = await findActiveLiveLinkForOrder(
    session.garageId,
    serviceOrderId,
  );
  return {
    active: active
      ? {
          id: active.id,
          expiresAt: active.expiresAt,
          createdAt: active.createdAt,
        }
      : null,
  };
}

export async function revokeLiveLinkForOrder(
  session: RoleSession,
  serviceOrderId: string,
) {
  requireRole(session, STAFF_ROLES);
  const order = await findServiceOrderById(session.garageId, serviceOrderId);
  if (!order) {
    throw new NotFoundError();
  }
  await revokeLiveLinksForOrder(session.garageId, serviceOrderId, session.userId);
  return { ok: true as const };
}

type ResolveOk = {
  ok: true;
  link: NonNullable<Awaited<ReturnType<typeof findLiveLinkByTokenHash>>>;
};

type ResolveFail = { ok: false; reason: LiveLinkAccessFailure };

async function resolveLiveLink(
  token: string,
  ip: string,
  kind: "view" | "action",
): Promise<ResolveOk | ResolveFail> {
  const rate =
    kind === "view" ? LIVE_LINK_VIEW_RATE : LIVE_LINK_ACTION_RATE;
  const limited = await consumeRateLimit({
    key: `live:${kind}:${ip}`,
    limit: rate.limit,
    windowMs: rate.windowMs,
  });
  if (!limited.allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  if (!token || token.length < 16) {
    return { ok: false, reason: "wrong_token" };
  }

  const tokenHash = hashToken(token);
  const link = await findLiveLinkByTokenHash(tokenHash);
  if (!link) {
    return { ok: false, reason: "wrong_token" };
  }
  if (link.revokedAt) {
    return { ok: false, reason: "revoked" };
  }
  if (link.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const perToken = await consumeRateLimit({
    key: `live:${kind}:tok:${tokenHash.slice(0, 16)}`,
    limit: rate.limit,
    windowMs: rate.windowMs,
  });
  if (!perToken.allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  return { ok: true, link };
}

export async function getPublicLiveView(
  token: string,
  ip: string,
): Promise<{ ok: true; view: PublicLiveView } | ResolveFail> {
  const resolved = await resolveLiveLink(token, ip, "view");
  if (!resolved.ok) {
    return resolved;
  }

  const { link } = resolved;
  const snapshot = await loadLiveOrderSnapshot(
    link.garageId,
    link.serviceOrderId,
  );
  if (!snapshot.order) {
    return { ok: false, reason: "wrong_token" };
  }

  const media: PublicLiveView["media"] = [];
  if (snapshot.inspection) {
    for (const item of snapshot.inspection.items) {
      for (const m of item.media) {
        try {
          const url = await Promise.race([
            createPresignedDownloadUrl(m.storageKey, 3600),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("storage_timeout")), 4_000);
            }),
          ]);
          media.push({
            id: m.id,
            kind: m.kind,
            url,
            contentType: m.contentType,
            itemLabel: item.label,
          });
        } catch {
          // Skip media if storage is unavailable or slow; page still loads.
        }
      }
    }
  }

  const estimate = snapshot.estimate
    ? {
        revisionNumber: snapshot.estimate.revisionNumber,
        canCustomerApprove:
          snapshot.estimate.askPermission &&
          snapshot.estimate.permissionVia === "LIVE_LINK",
        lines: snapshot.estimate.lines.map((line) => {
          const gst = computeLineGst({
            unitPricePaise: line.unitPricePaise,
            quantity: line.quantity,
            gstRatePercent: line.gstRatePercent,
          });
          return {
            id: line.id,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            lineTotalPaise: gst.totalPaise,
            approvalState: line.approvalState,
          };
        }),
      }
    : null;

  const inv = snapshot.invoices[0] ?? null;
  const invoice = inv
    ? {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalPaise: inv.totalPaise,
        pendingPaise: pendingBalancePaise({
          totalPaise: inv.totalPaise,
          amountPaidPaise: inv.amountPaidPaise,
          creditNotesTotalPaise: sumCreditNotesPaise(inv.creditNotes),
        }),
        paid:
          pendingBalancePaise({
            totalPaise: inv.totalPaise,
            amountPaidPaise: inv.amountPaidPaise,
            creditNotesTotalPaise: sumCreditNotesPaise(inv.creditNotes),
          }) <= 0,
        lines: inv.lines.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          totalPaise: line.totalPaise,
        })),
      }
    : null;

  return {
    ok: true,
    view: {
      garageName: link.garage.name,
      vehicleRegistration: snapshot.order.vehicle.registrationNumber,
      vehicleLabel:
        `${snapshot.order.vehicle.make} ${snapshot.order.vehicle.model}`.trim(),
      status: snapshot.order.status,
      expectedCompletion: snapshot.order.expectedCompletion
        ? snapshot.order.expectedCompletion.toISOString()
        : null,
      media,
      estimate,
      invoice,
    },
  };
}

export async function approveEstimateLineViaLiveLink(
  token: string,
  ip: string,
  raw: LiveApproveLineInput,
) {
  const input = liveApproveLineSchema.parse(raw);
  const resolved = await resolveLiveLink(token, ip, "action");
  if (!resolved.ok) {
    throw new AppError(`live.${resolved.reason}`, 403);
  }

  const line = await findEstimateLineForLive(
    resolved.link.garageId,
    input.lineId,
  );
  if (!line || line.estimate.serviceOrderId !== resolved.link.serviceOrderId) {
    throw new NotFoundError();
  }
  if (line.estimate.supersededAt != null) {
    throw new AppError("ESTIMATE_SUPERSEDED");
  }
  if (
    !line.estimate.askPermission ||
    line.estimate.permissionVia !== "LIVE_LINK"
  ) {
    throw new AppError("errors.forbidden", 403);
  }
  if (line.approvalState !== "PENDING") {
    throw new AppError("APPROVAL_UNCHANGED");
  }

  const result = await recordOnlineLineApproval(resolved.link.garageId, {
    estimateId: line.estimateId,
    estimateLineId: line.id,
    serviceOrderId: resolved.link.serviceOrderId,
    fromState: "PENDING",
    toState: input.approvalState,
  });
  if (!result.ok) {
    if (result.reason === "INSUFFICIENT_STOCK") {
      throw insufficientStockError(
        result.partName ?? line.description,
        result.partId,
      );
    }
    if (result.reason === "PART_NOT_FOUND") {
      throw new NotFoundError();
    }
    throw new AppError("APPROVAL_CONFLICT");
  }
  return { ok: true as const };
}

export async function startPayViaLiveLink(
  token: string,
  ip: string,
  raw: LiveStartPayInput,
) {
  const input = liveStartPaySchema.parse(raw);
  const resolved = await resolveLiveLink(token, ip, "action");
  if (!resolved.ok) {
    throw new AppError(`live.${resolved.reason}`, 403);
  }

  const snapshot = await loadLiveOrderSnapshot(
    resolved.link.garageId,
    resolved.link.serviceOrderId,
  );
  const inv = snapshot.invoices.find((i) => i.id === input.invoiceId);
  if (!inv) {
    throw new NotFoundError();
  }

  const payment = await startUpiPaymentForLiveLink({
    garageId: resolved.link.garageId,
    invoiceId: inv.id,
    liveToken: token,
  });

  return {
    paymentId: payment.id,
    amountPaise: payment.amountPaise,
    paymentLinkUrl: payment.paymentLinkUrl,
    qrImageDataUrl: payment.qrImageDataUrl,
    providerPaymentLinkId: payment.providerPaymentLinkId,
  };
}

/** Test helper: resolve without rate limit side effects for unit tests of expiry/revoke. */
export async function inspectLiveTokenForTests(token: string): Promise<{
  reason: LiveLinkAccessFailure | "ok";
  garageId?: string;
  serviceOrderId?: string;
}> {
  if (!token || token.length < 16) {
    return { reason: "wrong_token" };
  }
  const link = await findLiveLinkByTokenHash(hashToken(token));
  if (!link) {
    return { reason: "wrong_token" };
  }
  if (link.revokedAt) {
    return { reason: "revoked" };
  }
  if (link.expiresAt.getTime() <= Date.now()) {
    return { reason: "expired" };
  }
  return {
    reason: "ok",
    garageId: link.garageId,
    serviceOrderId: link.serviceOrderId,
  };
}
