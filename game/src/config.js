// SHADOW VAULT — shared tuning constants.
// One place holds every number the game balances on, so a level or a mechanic
// can be retuned without hunting through the update code.
export const TILE = 32;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const HUD_H = 64;

// Player movement (pixels per second).
export const PLAYER = {
  radius: 11,
  walkSpeed: 132,
  sneakSpeed: 74,
  sprintSpeed: 205,
  // Noise radius the player broadcasts while moving, by stance.
  noiseWalk: 46,
  noiseSneak: 0,
  noiseSprint: 130,
};

// Guard vision and hearing.
export const GUARD = {
  radius: 12,
  patrolSpeed: 58,
  investigateSpeed: 96,
  chaseSpeed: 158,
  searchSpeed: 80,
  visionRange: 235,
  visionHalfAngle: 0.61, // ~35 degrees each side
  hearRange: 150,
  // How fast the "seen" meter fills per second at point-blank range, and how
  // fast it drains when the player is out of sight.
  spotRate: 1.35,
  spotDecay: 0.55,
  suspiciousAt: 0.35, // meter level that turns a guard suspicious
  alertAt: 1.0, // meter level that triggers a chase
  // Seconds a guard keeps searching after losing the player, and how long a
  // takedown keeps one down.
  searchSeconds: 5,
  stunnedSeconds: 10,
  pauseAtWaypoint: 1.4,
};

// Stances multiply how fast a guard's meter fills: a crouched thief in the
// dark is much harder to spot than a sprinter under the lamps.
export const STANCE_SPOT = { sneak: 0.45, walk: 1.0, sprint: 1.6 };
export const SHADOW_SPOT = 0.4; // standing on a shadow tile
export const BUSH_SPOT = 0.12; // hiding in a bush (unless almost touching)

export const COIN = {
  count: 3, // noisemakers the player starts each level with
  throwRange: 260,
  noiseRadius: 210,
  attractRadius: 260,
};

export const TAKEDOWN_RANGE = 30;
export const TAKEDOWN_ARC = 1.9; // must approach from behind: angle behind guard
export const PICKUP_RADIUS = 26;
export const EXIT_RADIUS = 28;

export const SCORE = {
  loot: 100,
  takedown: 150,
  keycard: 50,
  ghostBonus: 500, // finish a level without any guard ever going alert
  timeBonusPerSecond: 5,
};

export const LIVES = 3;

// Colours are the game's whole palette in one place.
export const COLORS = {
  floorA: '#20242e',
  floorB: '#1b1f28',
  shadowFloor: '#12141d',
  wall: '#3a4152',
  wallTop: '#4d5870',
  crate: '#5a4630',
  crateTop: '#7a5f3f',
  bush: '#1d3a24',
  bushTop: '#2c5a36',
  door: '#8a6d2f',
  exit: '#1f7a4d',
  loot: '#ffd34d',
  keycard: '#4dc3ff',
  player: '#e8e4d8',
  playerCloak: '#2b3a55',
  guard: '#c94f43',
  guardCalm: '#d8b13c',
  coneCalm: 'rgba(216, 177, 60, 0.20)',
  coneSuspicious: 'rgba(255, 140, 40, 0.32)',
  coneAlert: 'rgba(255, 60, 40, 0.38)',
  text: '#e8e4d8',
  dim: '#9aa3b2',
};
