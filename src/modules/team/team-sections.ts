export const TEAM_SECTIONS = ["members", "pending"] as const;

export type TeamSection = (typeof TEAM_SECTIONS)[number];

export const TEAM_SECTION_ID_PREFIX = "team-section-";
