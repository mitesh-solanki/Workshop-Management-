"use server";

import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { translateError } from "@/lib/translate-error";
import type { JobSlipCardData } from "@/modules/job-slips/components/job-slip-card";
import { getJobReportForOrder } from "@/modules/job-slips/service";

export type JobReportActionResult =
  | { ok: true; slip: JobSlipCardData }
  | { ok: false; message: string };

export async function getJobReportAction(
  orderId: string,
): Promise<JobReportActionResult> {
  try {
    const session = await requireSession();
    const slip = await getJobReportForOrder(session, orderId);
    if (!slip) {
      throw new NotFoundError();
    }
    return { ok: true, slip };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}
