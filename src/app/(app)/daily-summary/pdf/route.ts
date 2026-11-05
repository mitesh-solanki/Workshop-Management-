import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getOptionalSession } from "@/lib/session";
import { downloadDailySummaryPdf } from "@/modules/daily-summary/service";

function safeFilename(value: string): string {
  return value.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const date = new URL(request.url).searchParams.get("date");

  try {
    const { buffer, dateKey, garageName } = await downloadDailySummaryPdf(
      session,
      date,
    );
    const filename = `daily-summary-${dateKey}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
        "X-Daily-Summary-Garage": garageName,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("daily summary PDF failed", error);
    return new NextResponse("Could not generate daily summary PDF", {
      status: 500,
    });
  }
}
