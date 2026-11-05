import {
  escapeAttr,
  escapeHtml,
  wrapGarageEmail,
} from "@/lib/email/templates/brand";
import {
  fillTemplate,
  getPasswordResetCopy,
} from "@/lib/email/templates/copy";

export function renderPasswordResetEmail(input: {
  resetUrl: string;
  expiresAt: Date;
  garageName: string;
  memberName?: string | null;
  adminRequested?: boolean;
  locale?: string | null;
}) {
  const copy = getPasswordResetCopy(input.locale);
  const date = formatDate(input.expiresAt, input.locale);
  const vars = {
    garage: input.garageName,
    date,
  };
  const subject = fillTemplate(copy.subject, vars);
  const name = input.memberName?.trim() || copy.fallbackName;
  const intro = input.adminRequested
    ? fillTemplate(copy.adminIntro, { ...vars, name })
    : fillTemplate(copy.selfIntro, { ...vars, name });

  const bodyHtml = `
    <h1 style="color:#17383b;font-size:30px;line-height:1.25;font-weight:700;margin:0 0 20px;">
      ${escapeHtml(copy.heading)}
    </h1>
    <p style="font-size:16px;line-height:1.7;color:#46575a;margin:0 0 12px;">
      ${escapeHtml(fillTemplate(copy.greeting, { name }))}
    </p>
    <p style="font-size:15px;line-height:1.7;color:#607073;margin:0;">
      ${escapeHtml(intro)}
    </p>
    <p style="font-size:15px;line-height:1.7;color:#607073;margin:10px 0 0;">
      ${escapeHtml(copy.ctaHint)}
    </p>
    <div style="padding:30px 0 26px;">
      <a href="${escapeAttr(input.resetUrl)}" target="_blank"
         style="display:inline-block;background-color:#0f766e;color:#ffffff;font-size:15px;font-weight:700;line-height:1;padding:16px 28px;border-radius:8px;text-decoration:none;">
        ${escapeHtml(copy.cta)}
      </a>
    </div>
    <div style="background-color:#f0fdfa;border:1px solid #ccfbf1;border-radius:9px;padding:16px 18px;margin-top:4px;">
      <p style="color:#115e59;font-size:13px;font-weight:700;margin:0 0 5px;">
        ${escapeHtml(copy.securityTitle)}
      </p>
      <p style="color:#617477;font-size:13px;line-height:1.6;margin:0;">
        ${escapeHtml(fillTemplate(copy.securityBody, vars))}
      </p>
    </div>
    <p style="color:#7b898b;font-size:12px;line-height:1.6;margin:24px 0 0;">
      ${escapeHtml(copy.keepPrivate)}
    </p>
    <p style="color:#7b898b;font-size:12px;line-height:1.6;margin:10px 0 0;">
      ${escapeHtml(copy.ignore)}
    </p>
  `;

  const html = wrapGarageEmail({
    title: subject,
    garageName: input.garageName,
    eyebrow: copy.eyebrow,
    bodyHtml,
    locale: input.locale,
  });

  const text = [
    fillTemplate(copy.greeting, { name }),
    "",
    intro,
    "",
    `${copy.plainCta} ${input.resetUrl}`,
    "",
    fillTemplate(copy.securityBody, vars),
    copy.ignore,
  ].join("\n");

  return { subject, html, text };
}

function formatDate(value: Date, locale?: string | null) {
  const tag =
    locale === "hi" ? "hi-IN" : locale === "gu" ? "gu-IN" : "en-IN";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
