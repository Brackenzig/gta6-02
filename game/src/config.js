// Tuning, districts, ranks and jobs for SOLMAR.
// Every number the rest of the game reads lives here, so balancing is
// one file instead of a hunt through the systems.

// ---- City layout ---------------------------------------------------------
// Roads run every ROAD_STEP units; the drivable grid is 8 blocks wide.
// The beach and ocean sit south of the grid, the marina east of it.
export const CITY = {
  roadStep: 50, // distance between road centrelines
  roadHalf: 7, // half the asphalt width
  blocks: 8, // blocks per side
  blockSize: 36, // building plot width inside a block
  // Grid extent: roads at -200 .. 200, buildings inside.
  min: -200,
  max: 200,
  // Beach strip and ocean, south of the grid.
  beachZ0: 207,
  beachZ1: 245,
  oceanZ0: 245,
  oceanZ1: 360,
  // Marina basin, east of the grid.
  marinaX0: 207,
  marinaX1: 320,
  marinaZ0: -60,
  marinaZ1: 140,
};

export const DISTRICTS = [
  { name: 'Downtown', x0: -75, z0: -75, x1: 75, z1: 75, tall: true, hue: 0x9fb4c7 },
  { name: 'Old Town', x0: -200, z0: -200, x1: -75, z1: 75, tall: false, hue: 0xc7a98a },
  { name: 'Northside', x0: -200, z0: -200, x1: 200, z1: -75, tall: false, hue: 0xa8c79b },
  { name: 'Beachside', x0: -200, z0: 75, x1: 75, z1: 207, tall: false, hue: 0xe8d9a0 },
  { name: 'Marina', x0: 75, z0: -75, x1: 207, z1: 207, tall: false, hue: 0x8ab8c7 },
];

export function districtAt(x, z) {
  if (z >= CITY.beachZ0 && z < CITY.beachZ1) return 'Beach';
  if (z >= CITY.oceanZ0) return 'Ocean';
  if (x >= CITY.marinaX0 && z >= CITY.marinaZ0 && z <= CITY.marinaZ1) return 'Marina';
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solmar';
}

// ---- Progression ---------------------------------------------------------
export const RANKS = [
  { name: 'Street Rat', earned: 0 },
  { name: 'Hustler', earned: 2500 },
  { name: 'Wheelman', earned: 8000 },
  { name: 'Enforcer', earned: 20000 },
  { name: 'Kingpin of Solmar', earned: 45000 },
];

export function rankFor(totalEarned) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (totalEarned >= r.earned) rank = r;
  }
  return rank;
}

// ---- Player --------------------------------------------------------------
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  radius: 0.6,
  health: 100,
  punchDamage: 34,
  punchRange: 2.2,
  punchCooldown: 0.45,
  startCash: 500,
  bustedFine: 250,
  wastedFine: 400,
};

// ---- Cars ----------------------------------------------------------------
export const CAR = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 42, // ~150 km/h
  maxReverse: 12,
  steer: 2.4,
  grip: 6.5,
  radius: 1.6,
};

export const CAR_COLORS = [
  0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22,
  0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400, 0x7f8c8d, 0xb03a2e,
];

// ---- Police --------------------------------------------------------------
export const POLICE = {
  maxCruisers: 5,
  chaseSpeed: 40,
  ramDamage: 9,
  ramCooldown: 1.2,
  bustRange: 2.4,
  bustTime: 2.5,
  // Wanted decays after this many quiet seconds per star.
  decayAfter: 14,
  // Crimes and their heat.
  heatSteal: 1,
  heatPunch: 1,
  heatSpeeding: 1,
};

// ---- Traffic & pedestrians ----------------------------------------------
export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const PED_WALK_SPEED = 1.6;

// ---- Jobs (for fixer Mara Voss) ------------------------------------------
// Each job is a short chain of stages. A stage is either "go to the
// beacon" or "steal the marked car" or "grab the loot". Payouts scale
// with the player's rank so later jobs pay more.
export const JOBS = [
  {
    id: 'courier',
    name: 'Courier Run',
    fixer: 'Mara Voss',
    brief: 'Pick up the package at the Old Town drop, then deliver it to the Marina. Keep it clean — no heat.',
    basePay: 900,
    timeLimit: 150,
    stages: [
      { kind: 'goto', label: 'Pick up the package', x: -140, z: -40 },
      { kind: 'goto', label: 'Deliver to the Marina', x: 150, z: 60 },
    ],
  },
  {
    id: 'getaway',
    name: 'Getaway Driver',
    fixer: 'Mara Voss',
    brief: 'Grab the bag from the Downtown rooftop crew, then lose the heat and reach the Northside safehouse.',
    basePay: 1600,
    timeLimit: 180,
    stages: [
      { kind: 'goto', label: 'Grab the bag', x: 20, z: 10 },
      { kind: 'goto', label: 'Reach the safehouse', x: -120, z: -140 },
    ],
    startHeat: 2,
  },
  {
    id: 'grand-theft',
    name: 'Grand Theft Solmar',
    fixer: 'Mara Voss',
    brief: 'A collector wants the gold coupe parked in Beachside. Take it — quietly if you can — and bring it to the garage.',
    basePay: 2400,
    timeLimit: 210,
    stages: [
      { kind: 'steal', label: 'Steal the gold coupe', x: -40, z: 140 },
      { kind: 'deliver', label: 'Deliver it to the garage', x: 120, z: -120 },
    ],
  },
  {
    id: 'marina-heist',
    name: 'Marina Heist',
    fixer: 'Mara Voss',
    brief: 'The yacht at the Marina holds a lockbox. Grab it and get to the Beachside drop before the whole city wakes up.',
    basePay: 4200,
    timeLimit: 240,
    stages: [
      { kind: 'goto', label: 'Grab the lockbox at the yacht', x: 240, z: 40 },
      { kind: 'goto', label: 'Escape to the Beachside drop', x: -100, z: 150 },
    ],
    startHeat: 3,
  },
];

// ---- Misc ----------------------------------------------------------------
export const SAVE_KEY = 'solmar-save-v1';
export const SHOT_NAMES = ['chase', 'street', 'drive', 'mission'];
