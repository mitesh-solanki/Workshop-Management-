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

  const html = `<!DOCTYPE html>
<html lang="${input.locale ?? "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 24px;">
          <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px;">${escapeHtml(copy.heading)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;color:#475569;padding-bottom:16px;">${escapeHtml(intro)}</td></tr>
          <tr><td style="font-size:13px;color:#64748b;padding-bottom:4px;">${escapeHtml(copy.roleLabel)}</td></tr>
          <tr><td style="font-size:15px;font-weight:600;padding-bottom:24px;">${escapeHtml(role)}</td></tr>
          <tr>
            <td style="padding-bottom:20px;">
              <a href="${escapeAttr(input.acceptUrl)}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">
                ${escapeHtml(copy.cta)}
              </a>
            </td>
          </tr>
          <tr><td style="font-size:14px;color:#64748b;">${escapeHtml(expiry)}</td></tr>
          <tr><td style="font-size:13px;color:#94a3b8;padding-top:16px;">${escapeHtml(copy.ignore)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    plainIntro,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
