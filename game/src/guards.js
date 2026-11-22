// SHADOW VAULT — guard AI.
// A guard is a small state machine. It patrols its waypoint loop, pauses at
// each stop to look around, and reacts to what it sees and hears:
//   PATROL -> SUSPICIOUS (a glimpse, or a noise) -> INVESTIGATE (walk to the
//   spot and look) -> back to PATROL, or -> CHASE (meter full) -> SEARCH (lost
//   you, sweep the area) -> PATROL. A takedown from behind puts it down for a
//   while (STUNNED), then it shakes it off and resumes its loop, warier.
import { TILE, GUARD, TAKEDOWN_ARC } from './config.js';
import { hasLineOfSight, visibilityToGuard, findPath } from './vision.js';

export const GUARD_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  CHASE: 'chase',
  SEARCH: 'search',
  STUNNED: 'stunned',
};

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function createGuard(def, index) {
  const start = def.waypoints[0];
  const next = def.waypoints[1] || def.waypoints[0];
  return {
    id: index,
    x: start.x,
    y: start.y,
    facing: Math.atan2(next.y - start.y, next.x - start.x),
    state: GUARD_STATE.PATROL,
    waypointIndex: 1 % def.waypoints.length,
    waypoints: def.waypoints,
    pauseTimer: 0,
    // Where the guard is walking to right now (patrol point, noise, last seen).
    target: null,
    // Last place the player was actually seen.
    lastSeen: null,
    // 0..1: how sure the guard is that someone is there.
    meter: 0,
    searchTimer: 0,
    stunTimer: 0,
    lookTimer: 0,
    // How long the guard stares at a glimpse or a noise before walking over:
    // a noise investigation must survive the sight meter draining to zero.
    stareTimer: 0,
    // The tile path the guard is following while chasing or investigating.
    path: null,
    repathTimer: 0,
    lookBase: Math.atan2(next.y - start.y, next.x - start.x),
    visionRange: GUARD.visionRange,
    visionHalfAngle: GUARD.visionHalfAngle,
    // How far this guard can hear, scaled a little per guard.
    hearRange: GUARD.hearRange * (0.9 + (index % 3) * 0.1),
    // Events the world raises for sound and the HUD.
    events: [],
  };
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.facing = turnToward(guard.facing, Math.atan2(dy, dx), 9 * dt);
  return dist - step < 2;
}

function lookAround(guard, dt, sweep = 1.6) {
  guard.lookTimer += dt;
  guard.facing = guard.lookBase + Math.sin(guard.lookTimer * 1.1) * sweep;
}

function tileOf(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

/**
 * Walk toward `target` along the tile grid, re-pathing twice a second, so a
 * chasing or investigating guard walks around walls instead of through them.
 * Returns true when the guard has arrived.
 */
function moveAlongPath(level, guard, target, speed, dt) {
  guard.repathTimer -= dt;
  if (!guard.path || guard.repathTimer <= 0) {
    guard.path = findPath(level, tileOf(guard.x, guard.y), tileOf(target.x, target.y));
    guard.repathTimer = 0.5;
  }
  if (!guard.path || guard.path.length === 0) return true;
  const head = guard.path[0];
  const cx = (head.tx + 0.5) * TILE;
  const cy = (head.ty + 0.5) * TILE;
  if (Math.hypot(cx - guard.x, cy - guard.y) < 5) {
    guard.path.shift();
    return guard.path.length === 0;
  }
  return moveToward(guard, cx, cy, speed, dt);
}

/** A noise at (x, y) with the given radius: guards in earshot investigate.
 *  A guard hears it only inside the noise's own radius, scaled by that
 *  guard's hearing: a keen guard hears a dropped coin from further away. */
export function guardHearNoise(guard, x, y, radius) {
  if (guard.state === GUARD_STATE.STUNNED) return;
  const effective = radius * (guard.hearRange / GUARD.hearRange);
  const dist = Math.hypot(x - guard.x, y - guard.y);
  if (dist > effective) return;
  if (guard.state === GUARD_STATE.CHASE) return;
  guard.state = GUARD_STATE.SUSPICIOUS;
  guard.target = { x, y };
  guard.meter = Math.max(guard.meter, 0.45);
  guard.stareTimer = 0.9; // stare first, then walk over — the meter may drain meanwhile
  guard.events.push({ type: 'heard', x, y });
}

export function guardTakedown(guard) {
  guard.state = GUARD_STATE.STUNNED;
  guard.stunTimer = GUARD.stunnedSeconds;
  guard.meter = 0;
  guard.target = null;
  guard.lastSeen = null;
  guard.events.push({ type: 'takedown' });
}

/** True when the player stands close behind this guard — a takedown is legal. */
export function canTakedown(guard, player) {
  if (guard.state === GUARD_STATE.STUNNED) return false;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  if (Math.hypot(dx, dy) > 34) return false;
  const behind = Math.atan2(dy, dx);
  return Math.abs(angleDiff(behind, guard.facing)) > Math.PI - TAKEDOWN_ARC;
}

/**
 * One tick of guard AI. Returns nothing; the guard's `events` list carries
 * what happened (spotted, alerted, lost) for the world to turn into sound,
 * score and HUD. `seen` is the player's visibility to this guard this tick.
 */
export function updateGuard(level, guard, player, stance, dt) {
  guard.events.length = 0;
  if (guard.state === GUARD_STATE.STUNNED) {
    guard.stunTimer -= dt;
    if (guard.stunTimer <= 0) {
      guard.state = GUARD_STATE.PATROL;
      guard.meter = 0.25; // shaken, but warier than before
      guard.events.push({ type: 'recovered' });
    }
    return;
  }

  const seen = visibilityToGuard(level, guard, player, stance);
  const wasAlert = guard.state === GUARD_STATE.CHASE;

  if (seen > 0) {
    guard.meter = Math.min(1, guard.meter + seen * GUARD.spotRate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    if (guard.meter >= GUARD.suspiciousAt && guard.state === GUARD_STATE.PATROL) {
      guard.state = GUARD_STATE.SUSPICIOUS;
      guard.pauseTimer = 0; // a fresh stare, not the leftover patrol pause
      guard.stareTimer = 0.9;
      guard.events.push({ type: 'suspicious' });
    }
    if (guard.meter >= GUARD.alertAt && guard.state !== GUARD_STATE.CHASE) {
      guard.state = GUARD_STATE.CHASE;
      guard.events.push({ type: 'alerted' });
    }
  } else {
    guard.meter = Math.max(0, guard.meter - GUARD.spotDecay * dt);
  }

  switch (guard.state) {
    case GUARD_STATE.PATROL: {
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        lookAround(guard, dt, 0.9);
        break;
      }
      const wp = guard.waypoints[guard.waypointIndex];
      if (moveToward(guard, wp.x, wp.y, GUARD.patrolSpeed, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = GUARD.pauseAtWaypoint;
        guard.lookBase = guard.facing;
        guard.lookTimer = 0;
      }
      break;
    }
    case GUARD_STATE.SUSPICIOUS: {
      // Freeze, stare at the spot for a beat, then go look. The stare runs
      // on its own timer: the sight meter may drain to nothing in the
      // meantime, but a heard noise still gets investigated.
      guard.lookBase = guard.lastSeen
        ? Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x)
        : guard.facing;
      lookAround(guard, dt, 0.5);
      guard.stareTimer -= dt;
      if (guard.stareTimer <= 0) {
        guard.state = GUARD_STATE.INVESTIGATE;
        guard.target = guard.lastSeen || guard.target;
        guard.path = null;
      } else if (guard.meter < GUARD.suspiciousAt * 0.5 && !guard.target && !guard.lastSeen) {
        guard.state = GUARD_STATE.PATROL;
        guard.target = null;
      }
      break;
    }
    case GUARD_STATE.INVESTIGATE: {
      const target = guard.target || guard.lastSeen;
      if (!target) {
        guard.state = GUARD_STATE.PATROL;
        break;
      }
      if (moveAlongPath(level, guard, target, GUARD.investigateSpeed, dt)) {
        guard.state = GUARD_STATE.SEARCH;
        guard.searchTimer = GUARD.searchSeconds;
        guard.lookBase = guard.facing;
        guard.lookTimer = 0;
      }
      if (guard.meter < 0.15 && seen === 0) {
        guard.state = GUARD_STATE.SEARCH;
        guard.searchTimer = 2.5;
      }
      break;
    }
    case GUARD_STATE.CHASE: {
      const target = guard.lastSeen || { x: player.x, y: player.y };
      // Chase the last seen spot; re-acquire when the player is visible.
      if (seen > 0) {
        moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt);
        guard.path = null;
      } else {
        moveAlongPath(level, guard, target, GUARD.chaseSpeed, dt);
      }
      if (seen === 0 && guard.meter < 0.4) {
        guard.state = GUARD_STATE.SEARCH;
        guard.searchTimer = GUARD.searchSeconds;
        guard.lookBase = guard.facing;
        guard.lookTimer = 0;
        guard.events.push({ type: 'lost' });
      }
      break;
    }
    case GUARD_STATE.SEARCH: {
      guard.searchTimer -= dt;
      lookAround(guard, dt, 1.6);
      if (guard.searchTimer <= 0 || guard.meter < 0.05) {
        guard.state = GUARD_STATE.PATROL;
        guard.target = null;
        guard.lastSeen = null;
      }
      break;
    }
    default:
      break;
  }

  if (wasAlert && guard.state !== GUARD_STATE.CHASE) {
    guard.events.push({ type: 'calmed' });
  }
}

/** Distance at which a chasing guard catches the player. */
export function guardCatches(guard, player) {
  return guard.state === GUARD_STATE.CHASE && Math.hypot(player.x - guard.x, player.y - guard.y) < 24;
}

export { hasLineOfSight };
