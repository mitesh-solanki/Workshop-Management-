import "server-only";

import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/lib/email/types";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tags?.map((tag) => ({
          name: tag.name,
          value: tag.value,
        })),
      });

      if (error) {
        return {
          ok: false,
          provider: this.name,
          errorCode: error.name || "RESEND_ERROR",
        };
      }

      return {
        ok: true,
        provider: this.name,
        requestId: data?.id,
      };
    } catch {
      return {
        ok: false,
        provider: this.name,
        errorCode: "RESEND_REQUEST_FAILED",
      };
    }
  }
}
