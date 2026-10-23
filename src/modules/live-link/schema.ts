import { z } from "zod";

/** Default live link lifetime: 7 days. */
export const LIVE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const createLiveLinkSchema = z.object({
  serviceOrderId: z.string().trim().min(1),
  /** Expiry override in hours (1–168). Default 7 days. */
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

export type CreateLiveLinkInput = z.input<typeof createLiveLinkSchema>;

export const liveApproveLineSchema = z.object({
  lineId: z.string().trim().min(1),
  approvalState: z.enum(["APPROVED", "REJECTED"]),
});

export type LiveApproveLineInput = z.input<typeof liveApproveLineSchema>;

export const liveStartPaySchema = z.object({
  invoiceId: z.string().trim().min(1),
});

export type LiveStartPayInput = z.input<typeof liveStartPaySchema>;
