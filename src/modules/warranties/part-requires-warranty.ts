/** Part name contains "battery" (case-insensitive) → warranty card required. */
export function partRequiresWarrantyCard(partName: string): boolean {
  return partName.toLowerCase().includes("battery");
}
