/**
 * Static sub-spare suggestions for inspection item notes.
 * Keys are lowercased main spare / category labels.
 */
const SUB_SPARES: Record<string, readonly string[]> = {
  brakes: [
    "Brake Pad",
    "Brake Disc",
    "Brake Drum",
    "Brake Shoe",
    "Brake Fluid",
    "Brake Hose",
    "Master Cylinder",
    "Wheel Cylinder",
    "Disc Pad",
    "Disc Plate",
  ],
  brake: [
    "Brake Pad",
    "Brake Disc",
    "Brake Drum",
    "Brake Shoe",
    "Brake Fluid",
    "Brake Hose",
    "Master Cylinder",
  ],
  tyres: ["Tyre", "Tube", "Flap", "Wheel Rim", "Wheel Nut", "Wheel Bearing"],
  tyre: ["Tyre", "Tube", "Flap", "Wheel Rim", "Wheel Nut"],
  battery: ["Battery", "Battery Terminal", "Self Starter Relay", "Alternator"],
  lights: [
    "Headlight Bulb",
    "Tail Light Bulb",
    "Indicator Bulb",
    "Number Plate Light",
    "Fog Light Bulb",
    "Relay",
    "Fuse",
  ],
  light: ["Headlight Bulb", "Tail Light Bulb", "Indicator Bulb", "Fuse"],
  fluids: [
    "Engine Oil",
    "Oil Filter",
    "Coolant",
    "Brake Fluid",
    "Gear Oil",
    "Power Steering Oil",
    "Washer Fluid",
    "Differential Oil",
  ],
  fluid: ["Engine Oil", "Coolant", "Brake Fluid", "Gear Oil"],
  suspension: [
    "Shock Absorber",
    "Coil Spring",
    "Ball Joint",
    "Lower Arm",
    "Control Arm",
    "Bush Kit",
    "Stabilizer Link",
    "Tie Rod End",
  ],
  ac: [
    "AC Filter",
    "Cabin Filter",
    "AC Gas",
    "Compressor",
    "Condenser",
    "Evaporator",
    "Blower Motor",
    "Expansion Valve",
  ],
  clutch: [
    "Clutch Plate",
    "Clutch Bearing",
    "Pressure Plate",
    "Release Bearing",
    "Clutch Wire",
    "Clutch Cover",
  ],
  engine: [
    "Engine Oil",
    "Oil Filter",
    "Air Filter",
    "Spark Plug",
    "Timing Belt",
    "Timing Chain",
    "Head Gasket",
    "Valve Cover Gasket",
  ],
  radiator: ["Radiator", "Coolant", "Thermostat", "Water Pump", "Radiator Cap"],
  wiper: ["Wiper Blade", "Wiper Motor", "Wiper Water"],
  steering: [
    "Power Steering Oil",
    "Steering Rack",
    "Tie Rod End",
    "Ball Joint",
  ],
  exhaust: ["Silencer", "Exhaust Pipe", "Catalytic Converter"],
  filter: ["Air Filter", "Oil Filter", "Fuel Filter", "Cabin Filter", "AC Filter"],
};

/** Main spare categories only — never sub-parts like Brake Pad. */
export const INSPECTION_MAIN_PART_NAMES = [
  "AC",
  "Battery",
  "Brakes",
  "Clutch",
  "Engine",
  "Exhaust",
  "Fluids",
  "Lights",
  "Radiator",
  "Steering",
  "Suspension",
  "Tyres",
  "Wiper",
] as const;

const MAX_MAIN_SUGGESTIONS = 8;

/** Suggest main inspection spares only (e.g. "brake" → Brakes, not Brake Disc). */
export function filterInspectionMainPartNames(
  query: string,
  limit = MAX_MAIN_SUGGESTIONS,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const starts: string[] = [];
  const includes: string[] = [];

  for (const name of INSPECTION_MAIN_PART_NAMES) {
    const lower = name.toLowerCase();
    if (lower === q) {
      continue;
    }
    if (lower.startsWith(q)) {
      starts.push(name);
    } else if (lower.includes(q)) {
      includes.push(name);
    }
  }

  return [...starts, ...includes].slice(0, limit);
}

export function getSubSpareSuggestions(mainLabel: string): string[] {
  const raw = mainLabel.trim().toLowerCase();
  if (!raw) return [];

  const exact = SUB_SPARES[raw];
  if (exact) return [...exact];

  const matched: string[] = [];
  const seen = new Set<string>();
  for (const [key, spares] of Object.entries(SUB_SPARES)) {
    if (raw.includes(key) || key.includes(raw)) {
      for (const spare of spares) {
        if (!seen.has(spare)) {
          seen.add(spare);
          matched.push(spare);
        }
      }
    }
  }
  return matched.slice(0, 12);
}

/** Dropdown filter for notes: sub-spares of the main spare (empty query → all). */
export function filterSubSpareSuggestions(
  mainLabel: string,
  query: string,
  limit = 8,
): string[] {
  const all = getSubSpareSuggestions(mainLabel);
  const q = query.trim().toLowerCase();
  if (!q) {
    return all.slice(0, limit);
  }

  const starts: string[] = [];
  const includes: string[] = [];
  for (const name of all) {
    const lower = name.toLowerCase();
    if (lower === q) continue;
    if (lower.startsWith(q)) starts.push(name);
    else if (lower.includes(q)) includes.push(name);
  }
  return [...starts, ...includes].slice(0, limit);
}
