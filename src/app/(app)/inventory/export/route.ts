import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { exportPartsCsv } from "@/modules/data-export/service";

export const instant = false;

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    return exportPartsCsv(session, { q });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (error instanceof ForbiddenError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw error;
  }
}
