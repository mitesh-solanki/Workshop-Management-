export const INSPECTION_SECTIONS = ["info", "report"] as const;

export type InspectionSection = (typeof INSPECTION_SECTIONS)[number];

export function isInspectionSection(
  value: string | null | undefined,
): value is InspectionSection {
  return (
    typeof value === "string" &&
    (INSPECTION_SECTIONS as readonly string[]).includes(value)
  );
}

export function clampInspectionSection(
  section: string | null | undefined,
): InspectionSection {
  if (isInspectionSection(section)) {
    return section;
  }
  return "info";
}
