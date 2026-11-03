import { describe, expect, it } from "vitest";
import {
  canMutateAssignedJobCard,
  isTechnicianAssignedToOrder,
} from "@/modules/service-orders/technicians";

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

  it("matches every technician when many are assigned later", () => {
    const ids = ["tech-1", "tech-2", "tech-3", "tech-4", "tech-5"];
    const order = {
      technicianId: ids[0]!,
      technicianAssignments: ids.map((technicianId) => ({ technicianId })),
      status: "WAITING",
    };

    for (const id of ids) {
      expect(isTechnicianAssignedToOrder(order, id)).toBe(true);
      expect(canMutateAssignedJobCard("TECHNICIAN", order, id)).toBe(true);
    }
    expect(isTechnicianAssignedToOrder(order, "tech-other")).toBe(false);
    expect(
      canMutateAssignedJobCard("TECHNICIAN", order, "tech-other"),
    ).toBe(false);
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

describe("canMutateAssignedJobCard", () => {
  const multiTechOrder = {
    technicianId: "tech-1",
    technicianAssignments: [
      { technicianId: "tech-1" },
      { technicianId: "tech-2" },
      { technicianId: "tech-3" },
    ],
    status: "WAITING",
  };

  it("lets owner and manager edit regardless of assignment", () => {
    expect(
      canMutateAssignedJobCard("OWNER", multiTechOrder, "anyone"),
    ).toBe(true);
    expect(
      canMutateAssignedJobCard("MANAGER", multiTechOrder, "anyone"),
    ).toBe(true);
  });

  it("lets the last of many assigned technicians edit", () => {
    expect(
      canMutateAssignedJobCard("TECHNICIAN", multiTechOrder, "tech-3"),
    ).toBe(true);
  });

  it("blocks edit when the job card is completed", () => {
    expect(
      canMutateAssignedJobCard(
        "TECHNICIAN",
        { ...multiTechOrder, status: "COMPLETED" },
        "tech-2",
      ),
    ).toBe(false);
    expect(
      canMutateAssignedJobCard(
        "OWNER",
        { ...multiTechOrder, status: "COMPLETED" },
        "anyone",
      ),
    ).toBe(false);
  });

  it("blocks accountants", () => {
    expect(
      canMutateAssignedJobCard("ACCOUNTANT", multiTechOrder, "tech-1"),
    ).toBe(false);
  });
});
