import { NextResponse } from "next/server";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { exportCustomerVehiclesCsv } from "@/modules/data-export/service";

export const instant = false;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return exportCustomerVehiclesCsv(session, id);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (error instanceof NotFoundError) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw error;
  }
}
