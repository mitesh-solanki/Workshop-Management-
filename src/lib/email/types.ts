export type EmailTag = {
  name: string;
  value: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: EmailTag[];
};

export type SendEmailResult = {
  ok: boolean;
  provider: string;
  requestId?: string;
  /** Internal diagnostic only — never show to users. */
  errorCode?: string;
};

export interface EmailProvider {
  readonly name: string;
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

export type EmailType =
  | "login_otp"
  | "signup_otp"
  | "invite_otp"
  | "team_invite";
