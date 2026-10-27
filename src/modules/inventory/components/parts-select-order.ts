/** Cruise-style: keep the current part as the first dropdown option. */
export function withSelectedPartFirst<T extends { id: string }>(
  items: readonly T[],
  selected: T | null | undefined,
): T[] {
  if (!selected) return [...items];
  return [selected, ...items.filter((item) => item.id !== selected.id)];
}
