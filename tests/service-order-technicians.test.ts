import { describe, expect, it } from "vitest";
import { isTechnicianAssignedToOrder } from "@/modules/service-orders/technicians";

describe("isTechnicianAssignedToOrder", () => {
  it("matches the legacy primary technicianId", () => {
    expect(
      isTechnicianAssignedToOrder(
        { technicianId: "tech-1", technicianAssignments: [] },
        "tech-1",
      ),
    ).toBe(true);
  });

  it("matches a co-assigned technician even when not primary", () => {
    expect(
      isTechnicianAssignedToOrder(
        {
          technicianId: "tech-1",
          technicianAssignments: [
            { technicianId: "tech-1" },
            { technicianId: "tech-2" },
          ],
        },
        "tech-2",
      ),
    ).toBe(true);
  });

  it("matches assignment-only rows when primary technicianId is null", () => {
    expect(
      isTechnicianAssignedToOrder(
        {
          technicianId: null,
          technicianAssignments: [{ technicianId: "tech-2" }],
        },
        "tech-2",
      ),
    ).toBe(true);
  });

  it("rejects unassigned technicians", () => {
    expect(
      isTechnicianAssignedToOrder(
        {
          technicianId: "tech-1",
          technicianAssignments: [{ technicianId: "tech-1" }],
        },
        "tech-other",
      ),
    ).toBe(false);
  });
});
