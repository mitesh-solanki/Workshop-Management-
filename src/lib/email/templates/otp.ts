import {
  fillTemplate,
  getOtpCopy,
} from "@/lib/email/templates/copy";

export function renderOtpEmail(input: {
  code: string;
  locale?: string | null;
}) {
  const copy = getOtpCopy(input.locale);
  const html = `<!DOCTYPE html>
<html lang="${input.locale ?? "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 24px;">
          <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px;">${escapeHtml(copy.heading)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;color:#475569;padding-bottom:20px;">${escapeHtml(copy.intro)}</td></tr>
          <tr><td style="font-size:13px;color:#64748b;padding-bottom:8px;">${escapeHtml(copy.codeLabel)}</td></tr>
          <tr><td style="font-size:32px;letter-spacing:0.2em;font-weight:700;padding:12px 16px;background:#f1f5f9;border-radius:8px;text-align:center;">${escapeHtml(input.code)}</td></tr>
          <tr><td style="font-size:14px;color:#64748b;padding-top:20px;">${escapeHtml(copy.expiry)}</td></tr>
          <tr><td style="font-size:13px;color:#94a3b8;padding-top:16px;">${escapeHtml(copy.ignore)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    copy.plainIntro,
    input.code,
    "",
    copy.plainExpiry,
    copy.plainIgnore,
  ].join("\n");

  return {
    subject: copy.subject,
    html,
    text: fillTemplate(text, {}),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
