import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidPhone,
  sanitizePhoneTyping,
} from "@/lib/contact";

describe("contact helpers", () => {
  it("validates email and phone like Cruise Holiday", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidPhone("9876543210")).toBe(true);
    expect(isValidPhone("+91 98765 43210")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
  });

  it("blocks letters while typing a phone number", () => {
    expect(sanitizePhoneTyping("98ab76")).toBe("9876");
    expect(sanitizePhoneTyping("+91abc")).toBe("+91");
    expect(sanitizePhoneTyping("987654321012345678")).toBe("987654321012345");
  });
});
