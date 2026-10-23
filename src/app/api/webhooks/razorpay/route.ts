import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { reconcileRazorpayWebhook } from "@/modules/payments/service";

export const instant = false;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  try {
    const result = await reconcileRazorpayWebhook({
      rawBody,
      signature,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { ok: false, code: error.code },
        { status: error.status },
      );
    }
    console.error("razorpay.webhook_error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
