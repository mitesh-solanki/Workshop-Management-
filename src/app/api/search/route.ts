import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getOptionalSession } from "@/lib/session";
import { GLOBAL_SEARCH_MIN_CHARS } from "@/modules/global-search/schema";
import { runGlobalSearch } from "@/modules/global-search/service";

export const instant = false;

export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "errors.unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < GLOBAL_SEARCH_MIN_CHARS) {
    return NextResponse.json({ success: true, q, results: [] });
  }

  try {
    const results = await runGlobalSearch(session, q);
    return NextResponse.json({ success: true, q, results });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.code },
        { status: error.status },
      );
    }
    console.error("global_search.error", error);
    return NextResponse.json(
      { success: false, error: "errors.generic" },
      { status: 500 },
    );
  }
}
