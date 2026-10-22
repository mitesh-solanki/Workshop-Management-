import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { hashRecipient, maskEmail } from "@/lib/email/mask";
import { getEmailProvider } from "@/lib/email/provider";
import type { EmailType, SendEmailInput, SendEmailResult } from "@/lib/email/types";
import { createEmailLogRow } from "@/modules/email/repo";

export async function sendLoggedEmail(input: {
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const provider = getEmailProvider();
  const requestId = randomUUID();
  const masked = maskEmail(input.to);
  const recipientHash = hashRecipient(input.to);

  let result: SendEmailResult;
  try {
    result = await provider.sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: [
        { name: "type", value: input.type },
        { name: "request_id", value: requestId },
      ],
    });
  } catch {
    result = {
      ok: false,
      provider: provider.name,
      errorCode: "PROVIDER_THROW",
    };
  }

  const providerRequestId = result.requestId ?? requestId;

  console.info(
    JSON.stringify({
      event: "email.send",
      type: input.type,
      recipientMasked: masked,
      recipientHash,
      provider: result.provider,
      ok: result.ok,
      requestId: providerRequestId,
      errorCode: result.errorCode ?? null,
    }),
  );

  try {
    await createEmailLogRow({
      type: input.type,
      recipientHash,
      recipientMasked: masked,
      provider: result.provider,
      success: result.ok,
      providerRequestId,
      errorCode: result.errorCode ?? null,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "email.log_failed",
        requestId: providerRequestId,
        recipientHash: createHash("sha256")
          .update(recipientHash)
          .digest("hex")
          .slice(0, 8),
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
  }

  return {
    ...result,
    requestId: providerRequestId,
  };
}

export type { SendEmailInput };
