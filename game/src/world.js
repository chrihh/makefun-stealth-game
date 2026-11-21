// Night Ledger — the simulation: the intruder, the wardens, their vision
// cones, the detection meter and the rules that end a floor. Rendering and
// input live elsewhere; this file only moves things and raises events.

import {
  COLS, ROWS, TILE, PLAYER, GUARD, DETECTION,
  COINS_START, COVERS_START, DISTRACT_RADIUS, DISTRACT_SECONDS, SCORE,
} from './config.js';
import {
  LEVELS, parseLevel, SOLID_TILES, TILE_SHADOW, TILE_EXIT,
} from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_KEY = 1;
export const EVENT_SUSPICIOUS = 2;
export const EVENT_ALERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_CLEARED = 16;
export const EVENT_COIN = 32;
export const EVENT_COIN_LAND = 64;
export const EVENT_STEP = 128;

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_DISTRACTED = 'distracted';

export function tileCentre(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function turnToward(angle, target, maxStep) {
  const diff = angleDifference(target, angle);
  if (Math.abs(diff) <= maxStep) return target;
  return angle + Math.sign(diff) * maxStep;
}

export class World {
  constructor() {
    this.levelIndex = 0;
    this.score = 0;
    this.totalTime = 0;
    this.everDetected = false;
    this.loadLevel(0, true);
  }

  loadLevel(index, freshRun = false) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    const start = tileCentre(this.level.start.col, this.level.start.row);
    this.player = {
      x: start.x, y: start.y, radius: PLAYER.radius,
      facing: 0, sneaking: false, moving: false, stepClock: 0,
    };
    this.guards = this.level.guards.map((spec) => {
      const first = tileCentre(spec.waypoints[0][0], spec.waypoints[0][1]);
      const second = tileCentre(spec.waypoints[1][0], spec.waypoints[1][1]);
      return {
        x: first.x, y: first.y, radius: GUARD.radius,
        waypoints: spec.waypoints.map(([col, row]) => tileCentre(col, row)),
        targetIndex: 1,
        facing: Math.atan2(second.y - first.y, second.x - first.x),
        state: GUARD_CALM,
        waitLeft: spec.phase * GUARD.waitSeconds,
        scanLeft: 0, scanBase: 0,
        loseLeft: 0,
        distractPoint: null, distractLeft: 0,
        lastSeen: null,
        exposureSeen: false,
      };
    });
    this.hasKey = false;
    this.exposure = 0;
    this.coins = COINS_START;
    this.covers = freshRun ? COVERS_START : this.covers ?? COVERS_START;
    this.levelTime = 0;
    this.levelDetected = false;
    this.distraction = null;
  }

  tileAt(col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
    return this.level.tiles[row][col];
  }

  isSolid(col, row) {
    return SOLID_TILES.has(this.tileAt(col, row));
  }

  pointSolid(x, y) {
    return this.isSolid(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** True when the straight line between two points crosses no solid tile. */
  lineOfSight(x0, y0, x1, y1) {
    const distance = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(distance / 6));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (this.pointSolid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /** Slide a circle along walls: try the full move, then each axis alone. */
  moveCircle(body, dx, dy) {
    const tryMove = (nx, ny) => {
      const corners = [
        [nx - body.radius + 3, ny - body.radius + 3],
        [nx + body.radius - 3, ny - body.radius + 3],
        [nx - body.radius + 3, ny + body.radius - 3],
        [nx + body.radius - 3, ny + body.radius - 3],
      ];
      return !corners.some(([cx, cy]) => this.pointSolid(cx, cy));
    };
    if (tryMove(body.x + dx, body.y + dy)) {
      body.x += dx; body.y += dy;
    } else if (tryMove(body.x + dx, body.y)) {
      body.x += dx;
    } else if (tryMove(body.x, body.y + dy)) {
      body.y += dy;
    }
  }

  playerInShadow() {
    const col = Math.floor(this.player.x / TILE);
    const row = Math.floor(this.player.y / TILE);
    return this.tileAt(col, row) === TILE_SHADOW;
  }

  /** How strongly one guard currently sees the player: 0 (blind) to 1. */
  guardSees(guard) {
    const dx = this.player.x - guard.x;
    const dy = this.player.y - guard.y;
    const distance = Math.hypot(dx, dy);
    const inShadow = this.playerInShadow();
    let range = GUARD.visionRange;
    if (inShadow && !this.player.moving) range *= 0.62;
    else if (this.player.sneaking) range *= 0.8;
    if (distance > range) return 0;
    const angleTo = Math.atan2(dy, dx);
    if (Math.abs(angleDifference(angleTo, guard.facing)) > GUARD.visionHalfAngle) return 0;
    if (!this.lineOfSight(guard.x, guard.y, this.player.x, this.player.y)) return 0;
    const closeness = 1 - distance / range;
    return 0.25 + 0.75 * closeness;
  }

  throwCoin(point) {
    if (this.coins <= 0 || this.distraction !== null) return EVENT_NONE;
    this.coins -= 1;
    this.distraction = { x: point.x, y: point.y, left: DISTRACT_SECONDS };
    let heard = false;
    for (const guard of this.guards) {
      if (Math.hypot(guard.x - point.x, guard.y - point.y) <= DISTRACT_RADIUS) {
        guard.state = GUARD_DISTRACTED;
        guard.distractPoint = { x: point.x, y: point.y };
        guard.distractLeft = DISTRACT_SECONDS;
        heard = true;
      }
    }
    return heard ? EVENT_COIN | EVENT_COIN_LAND : EVENT_COIN;
  }

  step(dt, move, sneaking) {
    let events = EVENT_NONE;
    this.levelTime += dt;
    this.totalTime += dt;
    const player = this.player;

    // --- the intruder ---------------------------------------------------
    player.sneaking = sneaking;
    const length = Math.hypot(move.x, move.y);
    player.moving = length > 0;
    if (player.moving) {
      const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const dx = (move.x / (length || 1)) * speed * dt;
      const dy = (move.y / (length || 1)) * speed * dt;
      this.moveCircle(player, dx, dy);
      player.facing = Math.atan2(move.y, move.x);
      player.stepClock += dt;
      const stride = sneaking ? 0.42 : 0.3;
      if (player.stepClock >= stride) {
        player.stepClock = 0;
        events |= EVENT_STEP;
      }
    }

    // --- keycard and exit -------------------------------------------------
    const keyPos = tileCentre(this.level.key.col, this.level.key.row);
    if (!this.hasKey && Math.hypot(player.x - keyPos.x, player.y - keyPos.y) < PLAYER.reach) {
      this.hasKey = true;
      this.score += SCORE.keycard;
      events |= EVENT_KEY;
    }
    const playerTile = this.tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (this.hasKey && playerTile === TILE_EXIT) {
      const timeBonus = Math.max(0, 300 - Math.floor(this.levelTime)) * SCORE.secondValue;
      this.score += SCORE.levelClear + timeBonus;
      if (!this.levelDetected) this.score += SCORE.ghostBonus;
      return events | EVENT_CLEARED;
    }

    // --- distraction timer -------------------------------------------------
    if (this.distraction !== null) {
      this.distraction.left -= dt;
      if (this.distraction.left <= 0) this.distraction = null;
    }

    // --- footstep noise -----------------------------------------------------
    // Walking at full pace carries: a calm warden within earshot comes to
    // look. Sneaking is silent, which is the whole point of the Shift key.
    if (player.moving && !sneaking) {
      for (const guard of this.guards) {
        if (guard.state === GUARD_CALM
          && Math.hypot(guard.x - player.x, guard.y - player.y) < 96) {
          guard.state = GUARD_SUSPICIOUS;
          guard.lastSeen = { x: player.x, y: player.y };
          events |= EVENT_SUSPICIOUS;
        }
      }
    }

    // --- wardens ------------------------------------------------------------
    let strongest = 0;
    for (const guard of this.guards) {
      const seen = this.guardSees(guard);
      strongest = Math.max(strongest, seen);
      events |= this.stepGuard(guard, dt, seen);
    }

    // --- the detection meter --------------------------------------------------
    if (strongest > 0) {
      let fill = DETECTION.fillFar + (DETECTION.fillClose - DETECTION.fillFar) * strongest;
      if (player.sneaking) fill *= DETECTION.sneakFactor;
      if (this.playerInShadow()) fill *= DETECTION.shadowFactor;
      const before = this.exposure;
      this.exposure = Math.min(DETECTION.alertAt, this.exposure + fill * dt);
      if (before < DETECTION.suspiciousAt && this.exposure >= DETECTION.suspiciousAt) {
        events |= EVENT_SUSPICIOUS;
        this.levelDetected = true;
        this.everDetected = true;
      }
      if (before < DETECTION.alertAt && this.exposure >= DETECTION.alertAt) events |= EVENT_ALERT;
    } else {
      this.exposure = Math.max(0, this.exposure - DETECTION.decayPerSecond * dt);
    }

    // --- caught ----------------------------------------------------------------
    for (const guard of this.guards) {
      if (guard.state === GUARD_ALERT
        && Math.hypot(guard.x - player.x, guard.y - player.y) < GUARD.catchDistance) {
        this.covers -= 1;
        events |= EVENT_CAUGHT;
        if (this.covers > 0) this.respawn();
        return events;
      }
    }
    return events;
  }

  respawn() {
    const start = tileCentre(this.level.start.col, this.level.start.row);
    this.player.x = start.x;
    this.player.y = start.y;
    this.exposure = 0;
    for (const guard of this.guards) {
      guard.state = GUARD_CALM;
      guard.loseLeft = 0;
      guard.distractLeft = 0;
    }
    this.distraction = null;
  }

  stepGuard(guard, dt, seen) {
    let events = EVENT_NONE;
    const player = this.player;
    const fullySeen = this.exposure >= DETECTION.alertAt && seen > 0;

    if (fullySeen) {
      guard.state = GUARD_ALERT;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.loseLeft = GUARD.loseSightSeconds;
    } else if (guard.state === GUARD_ALERT) {
      if (seen > 0) {
        guard.lastSeen = { x: player.x, y: player.y };
        guard.loseLeft = GUARD.loseSightSeconds;
      } else {
        guard.loseLeft -= dt;
        if (guard.loseLeft <= 0) {
          guard.state = GUARD_SUSPICIOUS;
          guard.scanLeft = GUARD.scanSeconds;
          guard.scanBase = guard.facing;
        }
      }
    } else if (guard.state !== GUARD_DISTRACTED && seen > 0 && this.exposure >= DETECTION.suspiciousAt) {
      guard.state = GUARD_SUSPICIOUS;
      guard.lastSeen = { x: player.x, y: player.y };
    }

    const walkTo = (point, speed) => {
      const dx = point.x - guard.x;
      const dy = point.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 4) return true;
      guard.facing = turnToward(guard.facing, Math.atan2(dy, dx), 3.4 * dt);
      this.moveCircle(guard, (dx / distance) * speed * dt, (dy / distance) * speed * dt);
      return distance < 10;
    };

    if (guard.state === GUARD_ALERT) {
      walkTo(guard.lastSeen ?? player, GUARD.chaseSpeed);
    } else if (guard.state === GUARD_DISTRACTED) {
      guard.distractLeft -= dt;
      if (guard.distractLeft <= 0 || guard.distractPoint === null) {
        guard.state = GUARD_CALM;
        guard.distractPoint = null;
      } else {
        const arrived = walkTo(guard.distractPoint, GUARD.searchSpeed);
        if (arrived) {
          guard.facing += Math.sin(this.levelTime * 2.2) * 0.9 * dt;
        }
      }
    } else if (guard.state === GUARD_SUSPICIOUS && guard.scanLeft > 0) {
      guard.scanLeft -= dt;
      guard.facing = guard.scanBase + Math.sin((GUARD.scanSeconds - guard.scanLeft) * 2.4) * 0.8;
      if (guard.scanLeft <= 0) guard.state = GUARD_CALM;
    } else if (guard.state === GUARD_SUSPICIOUS && guard.lastSeen !== null) {
      if (walkTo(guard.lastSeen, GUARD.searchSpeed)) {
        guard.scanLeft = GUARD.scanSeconds;
        guard.scanBase = guard.facing;
        guard.lastSeen = null;
      }
    } else {
      // Patrol: walk the waypoint loop, pause and sweep at each end.
      if (guard.waitLeft > 0) {
        guard.waitLeft -= dt;
        guard.facing += Math.sin(this.levelTime * 1.4 + guard.waypoints.length) * 0.55 * dt;
      } else {
        const target = guard.waypoints[guard.targetIndex];
        if (walkTo(target, GUARD.patrolSpeed)) {
          guard.targetIndex = (guard.targetIndex + 1) % guard.waypoints.length;
          guard.waitLeft = GUARD.waitSeconds;
        }
      }
    }
    return events;
  }
}
