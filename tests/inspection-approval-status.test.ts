import { describe, expect, it } from "vitest";
import { deriveInspectionApprovalStatus } from "@/modules/inspections/approval-status";

describe("deriveInspectionApprovalStatus", () => {
  it("returns NONE when there is no estimate", () => {
    expect(deriveInspectionApprovalStatus(null)).toBe("NONE");
  });

  it("returns NOT_REQUIRED when permission was not asked", () => {
    expect(
      deriveInspectionApprovalStatus({
        askPermission: false,
        lines: [{ approvalState: "APPROVED" }],
      }),
    ).toBe("NOT_REQUIRED");
  });

  it("stays PENDING when any line is still waiting", () => {
    expect(
      deriveInspectionApprovalStatus({
        askPermission: true,
        lines: [
          { approvalState: "APPROVED" },
          { approvalState: "PENDING" },
          { approvalState: "REJECTED" },
        ],
      }),
    ).toBe("PENDING");
  });

  it("returns PARTIAL when approved and rejected with no pending", () => {
    expect(
      deriveInspectionApprovalStatus({
        askPermission: true,
        lines: [
          { approvalState: "APPROVED" },
          { approvalState: "REJECTED" },
        ],
      }),
    ).toBe("PARTIAL");
  });

  it("returns APPROVED when every line is approved", () => {
    expect(
      deriveInspectionApprovalStatus({
        askPermission: true,
        lines: [
          { approvalState: "APPROVED" },
          { approvalState: "APPROVED" },
        ],
      }),
    ).toBe("APPROVED");
  });

  it("returns REJECTED when every line is rejected", () => {
    expect(
      deriveInspectionApprovalStatus({
        askPermission: true,
        lines: [{ approvalState: "REJECTED" }],
      }),
    ).toBe("REJECTED");
  });
});
