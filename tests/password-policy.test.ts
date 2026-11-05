import { describe, expect, it } from "vitest";
import { passwordPolicyErrorKey } from "@/lib/password";

describe("passwordPolicyErrorKey", () => {
  it("accepts a strong password", () => {
    expect(passwordPolicyErrorKey("Workshop@1")).toBeNull();
  });

  it("rejects weak passwords", () => {
    expect(passwordPolicyErrorKey("short")).toBe("validation.passwordTooShort");
    expect(passwordPolicyErrorKey("workshop@1")).toBe(
      "validation.passwordNeedsUpper",
    );
    expect(passwordPolicyErrorKey("Workshop@")).toBe(
      "validation.passwordNeedsNumber",
    );
    expect(passwordPolicyErrorKey("Workshop1")).toBe(
      "validation.passwordNeedsSpecial",
    );
  });
});
