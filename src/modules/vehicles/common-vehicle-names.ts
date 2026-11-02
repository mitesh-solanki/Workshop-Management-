/** Popular India car & two-wheeler makes/models for vehicle form autocomplete. */

export const COMMON_VEHICLE_MAKES = [
  "Ather",
  "Bajaj",
  "BMW Motorrad",
  "BYD",
  "Citroën",
  "Force",
  "Harley-Davidson",
  "Hero",
  "Hero Electric",
  "Honda",
  "Hyundai",
  "Isuzu",
  "Jawa",
  "Jeep",
  "Kia",
  "KTM",
  "Mahindra",
  "Maruti Suzuki",
  "MG",
  "Nissan",
  "Ola Electric",
  "Renault",
  "Royal Enfield",
  "Skoda",
  "Suzuki",
  "Tata",
  "Toyota",
  "Triumph",
  "TVS",
  "Volkswagen",
  "Yamaha",
] as const;

/** Models keyed by make (exact make string from COMMON_VEHICLE_MAKES). */
export const COMMON_VEHICLE_MODELS_BY_MAKE: Readonly<
  Record<string, readonly string[]>
> = {
  "Maruti Suzuki": [
    "Alto",
    "Alto K10",
    "S-Presso",
    "Celerio",
    "WagonR",
    "Swift",
    "Dzire",
    "Baleno",
    "Ignis",
    "Fronx",
    "Brezza",
    "Grand Vitara",
    "Ertiga",
    "XL6",
    "Jimny",
    "Ciaz",
    "Eeco",
    "Super Carry",
  ],
  Hyundai: [
    "Grand i10 Nios",
    "i20",
    "Aura",
    "Venue",
    "Creta",
    "Alcazar",
    "Tucson",
    "Exter",
    "Verna",
    "Ioniq 5",
  ],
  Tata: [
    "Tiago",
    "Tigor",
    "Punch",
    "Nexon",
    "Altroz",
    "Harrier",
    "Safari",
    "Curvv",
    "Tiago EV",
    "Punch EV",
    "Nexon EV",
  ],
  Mahindra: [
    "Bolero",
    "Bolero Neo",
    "Scorpio",
    "Scorpio-N",
    "XUV300",
    "XUV3XO",
    "XUV700",
    "Thar",
    "Thar Roxx",
    "Marazzo",
    "XUV400",
  ],
  Toyota: [
    "Glanza",
    "Urban Cruiser Taisor",
    "Rumion",
    "Innova Crysta",
    "Innova Hycross",
    "Fortuner",
    "Hilux",
    "Camry",
    "Land Cruiser",
    "Urban Cruiser Hyryder",
  ],
  Honda: [
    "Amaze",
    "City",
    "Elevate",
    "WR-V",
    "Activa 6G",
    "Activa 125",
    "Dio",
    "Shine",
    "Unicorn",
    "SP 125",
    "Hornet 2.0",
    "CB350",
    "H'ness CB350",
    "Livo",
    "Grazia",
  ],
  Kia: ["Sonet", "Seltos", "Carens", "Carnival", "EV6", "Syros"],
  MG: ["Hector", "Astor", "Gloster", "ZS EV", "Comet EV", "Windsor"],
  Skoda: ["Kushaq", "Slavia", "Kylaq", "Octavia", "Superb", "Kodiaq"],
  Volkswagen: ["Polo", "Vento", "Virtus", "Taigun", "Tiguan"],
  Renault: ["Kwid", "Triber", "Kiger"],
  Nissan: ["Magnite"],
  "Citroën": ["C3", "C3 Aircross", "Basalt", "eC3"],
  Jeep: ["Compass", "Meridian", "Wrangler", "Grand Cherokee"],
  Force: ["Gurkha", "Trax Cruiser"],
  BYD: ["Atto 3", "Seal", "eMAX 7"],
  Isuzu: ["D-Max", "MU-X"],
  Hero: [
    "Splendor Plus",
    "HF Deluxe",
    "Passion Pro",
    "Glamour",
    "Xtreme 160R",
    "Xpulse 200",
    "Pleasure",
    "Destini 125",
    "Maestro Edge",
    "Karizma XMR",
  ],
  Bajaj: [
    "Pulsar 125",
    "Pulsar 150",
    "Pulsar NS200",
    "Pulsar N160",
    "Pulsar RS200",
    "Dominar 400",
    "CT 100",
    "Platina",
    "Chetak",
  ],
  TVS: [
    "Apache RTR 160",
    "Apache RTR 200",
    "Apache RR 310",
    "Raider",
    "Jupiter",
    "Ntorq 125",
    "iQube",
    "Sport",
    "Star City Plus",
  ],
  "Royal Enfield": [
    "Classic 350",
    "Bullet 350",
    "Hunter 350",
    "Meteor 350",
    "Super Meteor 650",
    "Himalayan",
    "Scram 411",
    "Continental GT 650",
    "Interceptor 650",
    "Shotgun 650",
    "Guerrilla 450",
  ],
  Yamaha: ["FZ-S", "MT-15", "R15 V4", "Fascino", "Ray ZR", "Aerox 155"],
  Suzuki: [
    "Access 125",
    "Avenis",
    "Burgman Street",
    "Gixxer",
    "Gixxer SF",
    "V-Strom SX",
  ],
  KTM: [
    "200 Duke",
    "250 Duke",
    "390 Duke",
    "RC 200",
    "RC 390",
    "Adventure 250",
    "Adventure 390",
  ],
  "Hero Electric": ["Optima", "Photon", "Nyx"],
  Ather: ["450X", "450S", "Rizta"],
  "Ola Electric": ["S1 Pro", "S1 Air", "S1 X"],
  Jawa: ["42", "42 Bobber", "Perak"],
  Triumph: ["Speed 400", "Scrambler 400 X", "Tiger 900"],
  "Harley-Davidson": ["X440"],
  "BMW Motorrad": ["G 310 R", "G 310 GS"],
};

const ALL_MODELS: readonly string[] = Array.from(
  new Set(Object.values(COMMON_VEHICLE_MODELS_BY_MAKE).flat()),
).sort((a, b) => a.localeCompare(b));

const MAX_SUGGESTIONS = 8;

function filterNames(
  names: readonly string[],
  query: string,
  limit: number,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const starts: string[] = [];
  const includes: string[] = [];

  for (const name of names) {
    const lower = name.toLowerCase();
    if (lower === q) continue;
    if (lower.startsWith(q)) {
      starts.push(name);
    } else if (lower.includes(q)) {
      includes.push(name);
    }
  }

  return [...starts, ...includes].slice(0, limit);
}

function resolveMakeKey(make: string): string | null {
  const q = make.trim().toLowerCase();
  if (!q) return null;
  const exact = COMMON_VEHICLE_MAKES.find((name) => name.toLowerCase() === q);
  if (exact) return exact;
  return null;
}

/** Case-insensitive make match; starts-with first, then includes. */
export function filterCommonVehicleMakes(
  query: string,
  limit = MAX_SUGGESTIONS,
): string[] {
  return filterNames(COMMON_VEHICLE_MAKES, query, limit);
}

/**
 * Model suggestions. When make matches a known make, only that make's models.
 * Otherwise search across all catalog models.
 */
export function filterCommonVehicleModels(
  query: string,
  make = "",
  limit = MAX_SUGGESTIONS,
): string[] {
  const makeKey = resolveMakeKey(make);
  const pool = makeKey
    ? (COMMON_VEHICLE_MODELS_BY_MAKE[makeKey] ?? ALL_MODELS)
    : ALL_MODELS;
  return filterNames(pool, query, limit);
}
