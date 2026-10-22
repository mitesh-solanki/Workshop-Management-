import "server-only";

export type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
  EmailType,
} from "@/lib/email/types";
export {
  getAppUrl,
  getEmailEnv,
  resetEmailEnvCache,
} from "@/lib/email/env";
export {
  getEmailProvider,
  setEmailProviderForTests,
} from "@/lib/email/provider";
export { sendLoggedEmail } from "@/lib/email/send";
export { renderOtpEmail } from "@/lib/email/templates/otp";
export { renderInviteEmail } from "@/lib/email/templates/invite";
