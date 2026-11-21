// Night Ledger — shared tuning constants.
// The play field is a grid of tiles rendered on a canvas; every size the rest
// of the game needs is derived from these few numbers so levels stay simple
// strings and the physics, vision and drawing all agree with each other.

export const TILE = 48;
export const COLS = 20;
export const ROWS = 13;
export const HUD_HEIGHT = 58;
export const VIEW_WIDTH = COLS * TILE;
export const VIEW_HEIGHT = ROWS * TILE + HUD_HEIGHT;

export const STEP = 1 / 120;

export const PLAYER = {
  radius: 15,
  walkSpeed: 178,
  sneakSpeed: 96,
  reach: 30,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 64,
  chaseSpeed: 148,
  searchSpeed: 92,
  visionRange: 168,
  visionRangeLit: 196,
  visionHalfAngle: 0.56,
  waitSeconds: 1.6,
  scanSeconds: 2.4,
  loseSightSeconds: 2.6,
  catchDistance: 26,
};

export const DETECTION = {
  // Exposure gained per second at point-blank range in full view.
  fillClose: 2.1,
  // Exposure gained per second at the very edge of a vision cone.
  fillFar: 0.55,
  // Crouching in shadow is much harder to spot.
  sneakFactor: 0.42,
  shadowFactor: 0.5,
  decayPerSecond: 0.34,
  suspiciousAt: 0.34,
  alertAt: 1,
};

export const COINS_START = 3;
export const COVERS_START = 3;
export const DISTRACT_RADIUS = 190;
export const DISTRACT_SECONDS = 3.4;

export const SCORE = {
  keycard: 400,
  levelClear: 600,
  ghostBonus: 500,
  secondValue: 4,
  coinUnused: 60,
};
