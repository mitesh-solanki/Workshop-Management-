import "server-only";

import QRCode from "qrcode";

/** PNG data URL for a payment link / UPI URL (shown on the live page). */
export async function paymentLinkQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    type: "image/png",
  });
}
