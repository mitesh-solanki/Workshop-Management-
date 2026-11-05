export const MEMBER_SECTIONS = [
  "details",
  "payroll",
  "openAdvances",
  "access",
] as const;

export type MemberSection = (typeof MEMBER_SECTIONS)[number];

export const MEMBER_SECTION_ID_PREFIX = "member-section-";

export function memberSectionsFor(input: {
  showPay: boolean;
  showAccess: boolean;
}): readonly MemberSection[] {
  const sections: MemberSection[] = ["details"];
  if (input.showPay) {
    sections.push("payroll", "openAdvances");
  }
  if (input.showAccess) sections.push("access");
  return sections;
}
