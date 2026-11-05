function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "";
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/$/, "");
  }
  return `https://${raw.replace(/\/$/, "")}`;
}

export function emailLogoUrl(): string {
  const origin = siteOrigin();
  if (!origin) return "";
  return `${origin}/apple-touch-icon.png`;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

export function wrapGarageEmail(input: {
  title: string;
  garageName: string;
  eyebrow: string;
  bodyHtml: string;
  locale?: string | null;
}): string {
  const logoUrl = emailLogoUrl();
  const garage = escapeHtml(input.garageName);
  const brand = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${garage}" width="48" height="48" style="border:0;display:block;width:48px;height:48px;border-radius:10px;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${garage}</div>`;

  return `<!DOCTYPE html>
<html lang="${input.locale ?? "en"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#243438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f4f7f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">${brand}</td>
                  <td style="vertical-align:middle;">
                    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;line-height:1.2;">${garage}</div>
                    <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;">Workshop</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <div style="padding:42px 48px 36px;">
                <div style="color:#0f766e;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:12px;">
                  ${escapeHtml(input.eyebrow)}
                </div>
                ${input.bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background-color:#edf0f1;margin:8px 0 24px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 34px;text-align:center;">
              <p style="color:#899496;font-size:11px;line-height:1.6;margin:0;">
                This is an automated email from ${garage}.
              </p>
              <p style="color:#899496;font-size:11px;line-height:1.6;margin:6px 0 0;">
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
