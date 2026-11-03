/**
 * Common outside-workshop services for inspection findings and job cards.
 */
export const OUTSIDE_WORK_SUGGESTIONS = [
  "Wheel Alignment",
  "Wheel Balancing",
  "Tyre Fitting",
  "Puncture Repair",
  "Denting",
  "Painting",
  "Denting And Painting",
  "AC Gas Refill",
  "Key Programming",
  "Towing",
  "Windshield Replacement",
  "Upholstery",
  "Detailing",
  "Ceramic Coating",
  "Scanner Diagnostics",
] as const;

const MAX_SUGGESTIONS = 8;

/** Dropdown filter for outside work (empty query → full list). */
export function filterOutsideWorkSuggestions(
  query: string,
  limit = MAX_SUGGESTIONS,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...OUTSIDE_WORK_SUGGESTIONS].slice(0, limit);
  }

  const starts: string[] = [];
  const includes: string[] = [];
  for (const name of OUTSIDE_WORK_SUGGESTIONS) {
    const lower = name.toLowerCase();
    if (lower === q) continue;
    if (lower.startsWith(q)) starts.push(name);
    else if (lower.includes(q)) includes.push(name);
  }
  return [...starts, ...includes].slice(0, limit);
}
