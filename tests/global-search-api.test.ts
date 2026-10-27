import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/session", () => ({
  getOptionalSession: vi.fn(),
}));

vi.mock("@/modules/global-search/service", () => ({
  runGlobalSearch: vi.fn(),
}));

import { getOptionalSession } from "@/lib/session";
import { runGlobalSearch } from "@/modules/global-search/service";
import { GET } from "@/app/api/search/route";

const session = {
  userId: "user-a",
  garageId: "garage-a",
  role: "OWNER" as const,
  email: "owner@example.com",
  name: "Owner",
};

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(getOptionalSession).mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/search?q=ravi"),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "errors.unauthorized",
    });
    expect(runGlobalSearch).not.toHaveBeenCalled();
  });

  it("returns empty results for short queries without searching", async () => {
    vi.mocked(getOptionalSession).mockResolvedValue(session);

    const res = await GET(new Request("http://localhost/api/search?q=a"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      q: "a",
      results: [],
    });
    expect(runGlobalSearch).not.toHaveBeenCalled();
  });

  it("trims query and returns search results", async () => {
    vi.mocked(getOptionalSession).mockResolvedValue(session);
    vi.mocked(runGlobalSearch).mockResolvedValue([
      {
        id: "cust-a",
        type: "customer",
        title: "Ravi Patel",
        subtitle: "9876543210",
        matchIn: "name",
        href: "/customers/cust-a",
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/search?q=%20Ravi%20"),
    );
    expect(res.status).toBe(200);
    expect(runGlobalSearch).toHaveBeenCalledWith(session, "Ravi");
    await expect(res.json()).resolves.toEqual({
      success: true,
      q: "Ravi",
      results: [
        expect.objectContaining({
          type: "customer",
          href: "/customers/cust-a",
        }),
      ],
    });
  });

  it("maps AppError to JSON error response", async () => {
    vi.mocked(getOptionalSession).mockResolvedValue(session);
    vi.mocked(runGlobalSearch).mockRejectedValue(
      new AppError("errors.forbidden", 403),
    );

    const res = await GET(
      new Request("http://localhost/api/search?q=Ravi"),
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "errors.forbidden",
    });
  });

  it("maps unexpected errors to 500", async () => {
    vi.mocked(getOptionalSession).mockResolvedValue(session);
    vi.mocked(runGlobalSearch).mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(
      new Request("http://localhost/api/search?q=Ravi"),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "errors.generic",
    });
    spy.mockRestore();
  });
});
