/** Common Indian garage / spare-parts names for inventory autocomplete (English only). */
export const COMMON_PART_NAMES = [
  "Accelerator Cable",
  "Accelerator Wire",
  "ABS Sensor",
  "AC Filter",
  "AC Gas",
  "Air Filter",
  "Alternator",
  "Alternator Belt",
  "Axle Boot",
  "Ball Joint",
  "Battery",
  "Battery Terminal",
  "Brake Disc",
  "Brake Drum",
  "Brake Fluid",
  "Brake Hose",
  "Brake Pad",
  "Brake Shoe",
  "Bush Kit",
  "Cabin Filter",
  "Carburetor",
  "Carburetor Kit",
  "Catalytic Converter",
  "CDI Unit",
  "Chain Sprocket Kit",
  "Clutch Bearing",
  "Clutch Cover",
  "Clutch Plate",
  "Clutch Wire",
  "Coil Spring",
  "Compressor",
  "Condenser",
  "Control Arm",
  "Coolant",
  "Cotter Pin",
  "CV Joint",
  "Differential Oil",
  "Disc Pad",
  "Disc Plate",
  "Door Handle",
  "Drive Chain",
  "Dust Cover",
  "Dynamo",
  "Engine Mounting",
  "Engine Oil",
  "Exhaust Pipe",
  "Fan Belt",
  "Flap",
  "Floor Mat",
  "Foot Rest",
  "Front Brake Cable",
  "Front Sprocket",
  "Fuel Cock",
  "Fuel Filter",
  "Fuse",
  "Gear Lever Cable",
  "Gear Oil",
  "Gear Oil Seal",
  "Grease",
  "Handle Grip",
  "Head Gasket",
  "Headlight Bulb",
  "Horn",
  "Hub Grease",
  "Indicator Bulb",
  "Kick Starter",
  "Leg Guard",
  "Lower Arm",
  "Master Cylinder",
  "Mud Flap",
  "Multipurpose Oil",
  "Number Plate Light",
  "Nut Bolt Set",
  "Oil Filter",
  "Oil Seal",
  "O-Ring",
  "Packing Kit",
  "Petrol Tap",
  "Power Steering Oil",
  "Pressure Plate",
  "Radiator",
  "Rear Brake Cable",
  "Rear Sprocket",
  "Relay",
  "Release Bearing",
  "RTV Sealant",
  "Seat Cover",
  "Self Starter Relay",
  "Shock Absorber",
  "Side Mirror",
  "Side Stand Switch",
  "Silencer",
  "Spark Plug",
  "Speedo Wire",
  "Speedometer Cable",
  "Stabilizer Link",
  "Starter Motor",
  "Steering Rack",
  "Tail Light Bulb",
  "Thermostat",
  "Throttle Cable",
  "Tie Rod End",
  "Timing Belt",
  "Timing Chain",
  "Tube",
  "Tyre",
  "Valve",
  "Valve Cover Gasket",
  "Washer",
  "Washer Fluid",
  "Water Pump",
  "WD Oil",
  "Wheel Bearing",
  "Wheel Cylinder",
  "Wheel Nut",
  "Wheel Rim",
  "Window Regulator",
  "Wiper Blade",
  "Wiper Motor",
  "Wiper Water",
  "Wiring Harness",
] as const;

export type CommonPartName = (typeof COMMON_PART_NAMES)[number];

const MAX_SUGGESTIONS = 8;

/** Case-insensitive match; starts-with first, then includes. Does not auto-pick a value. */
export function filterCommonPartNames(
  query: string,
  limit = MAX_SUGGESTIONS,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const starts: string[] = [];
  const includes: string[] = [];

  for (const name of COMMON_PART_NAMES) {
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
