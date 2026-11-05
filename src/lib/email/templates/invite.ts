import {
  escapeAttr,
  escapeHtml,
  wrapGarageEmail,
} from "@/lib/email/templates/brand";
import {
  fillTemplate,
  getInviteCopy,
  getRoleLabel,
} from "@/lib/email/templates/copy";

export function renderInviteEmail(input: {
  garageName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
  locale?: string | null;
  inviteeName?: string | null;
}) {
  const copy = getInviteCopy(input.locale);
  const role = getRoleLabel(input.role, input.locale);
  const date = formatDate(input.expiresAt, input.locale);
  const vars = {
    garage: input.garageName,
    role,
    date,
  };

  const subject = fillTemplate(copy.subject, vars);
  const intro = fillTemplate(copy.intro, vars);
  const expiry = fillTemplate(copy.expiry, vars);
  const plainIntro = fillTemplate(copy.plainIntro, vars);
  const plainExpiry = fillTemplate(copy.plainExpiry, vars);
  const name = input.inviteeName?.trim();
  const welcome = name
    ? fillTemplate(copy.welcomeNamed, { name })
    : copy.welcome;

  const bodyHtml = `
    <h1 style="color:#17383b;font-size:30px;line-height:1.25;font-weight:700;margin:0 0 18px;">
      ${escapeHtml(welcome)}
    </h1>
    <p style="font-size:16px;line-height:1.7;color:#46575a;margin:0 0 12px;">
      ${escapeHtml(intro)}
    </p>
    <p style="font-size:13px;color:#64748b;margin:0 0 4px;">${escapeHtml(copy.roleLabel)}</p>
    <p style="font-size:15px;font-weight:700;color:#17383b;margin:0 0 8px;">${escapeHtml(role)}</p>
    <p style="font-size:15px;line-height:1.7;color:#607073;margin:0;">
      ${escapeHtml(copy.activateHint)}
    </p>
    <div style="padding:30px 0 26px;">
      <a href="${escapeAttr(input.acceptUrl)}" target="_blank"
         style="display:inline-block;background-color:#0f766e;color:#ffffff;font-size:15px;font-weight:700;line-height:1;padding:16px 26px;border-radius:8px;text-decoration:none;">
        ${escapeHtml(copy.cta)}
      </a>
    </div>
    <div style="background-color:#f0fdfa;border:1px solid #ccfbf1;border-radius:9px;padding:16px 18px;margin-top:4px;">
      <p style="color:#115e59;font-size:13px;font-weight:700;margin:0 0 5px;">
        ${escapeHtml(copy.expiryTitle)}
      </p>
      <p style="color:#617477;font-size:13px;line-height:1.6;margin:0;">
        ${escapeHtml(expiry)} ${escapeHtml(copy.expiryHelp)}
      </p>
    </div>
    <p style="color:#7b898b;font-size:12px;line-height:1.6;margin:24px 0 0;">
      ${escapeHtml(copy.ignore)}
    </p>
  `;

  const html = wrapGarageEmail({
    title: subject,
    garageName: input.garageName,
    eyebrow: copy.heading,
    bodyHtml,
    locale: input.locale,
  });

  const text = [
    welcome,
    "",
    plainIntro,
    `${copy.roleLabel}: ${role}`,
    "",
    `${copy.plainCta} ${input.acceptUrl}`,
    "",
    plainExpiry,
    copy.plainIgnore,
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
  }).format(value);
}
