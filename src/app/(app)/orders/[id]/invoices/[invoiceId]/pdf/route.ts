import { NextResponse } from "next/server";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getOptionalSession } from "@/lib/session";
import { getInvoicePdfBuffer } from "@/modules/billing/service";
import { PDF_LOCALES, type PdfLocale } from "@/modules/billing/schema";

type Params = { params: Promise<{ id: string; invoiceId: string }> };

function parseLocale(value: string | null): PdfLocale {
  if (value && (PDF_LOCALES as readonly string[]).includes(value)) {
    return value as PdfLocale;
  }
  return "en";
}

function safeFilename(value: string): string {
  return value.replace(/[^\w.\-/]+/g, "_").slice(0, 80);
}

export async function GET(request: Request, { params }: Params) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { invoiceId } = await params;
  const locale = parseLocale(new URL(request.url).searchParams.get("locale"));

  try {
    const { buffer, labels } = await getInvoicePdfBuffer(
      session,
      invoiceId,
      locale,
    );
    const filename = `invoice-${locale}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
        "X-Invoice-Pdf-Locale": labels.locale,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("invoice PDF failed", error);
    return new NextResponse("Could not generate invoice PDF", { status: 500 });
  }
}
