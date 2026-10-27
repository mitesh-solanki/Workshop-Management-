export const JOB_CARD_SECTIONS = [
  "details",
  "inspection",
  "lines",
  "estimate",
  "billing",
  "timeline",
] as const;

export type JobCardSection = (typeof JOB_CARD_SECTIONS)[number];

export function isJobCardSection(
  value: string | null | undefined,
): value is JobCardSection {
  return (
    typeof value === "string" &&
    (JOB_CARD_SECTIONS as readonly string[]).includes(value)
  );
}
