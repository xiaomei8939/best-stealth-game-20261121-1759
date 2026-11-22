// SHADOW VAULT — the screenshot scenes behind ?shot=start|play|alert|end.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a small autopilot that pathfinds across the
// tile grid (breadth-first search) toward the nearest loot, then the exit.
// The frame is therefore what a short game really looks like, and the same
// seed always gives the same frame.
import { TILE } from './config.js';
import { isWalkable, hasLineOfSight, findPath } from './vision.js';
import { World, WORLD_STATE } from './world.js';

const STEP = 1 / 30;

function tileOf(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

/** Steer the player along a tile path; returns the movement vector. */
function followPath(world, path) {
  if (!path || path.length === 0) return { x: 0, y: 0 };
  const head = path[0];
  const cx = (head.tx + 0.5) * TILE;
  const cy = (head.ty + 0.5) * TILE;
  const dx = cx - world.player.x;
  const dy = cy - world.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    path.shift();
    return { x: 0, y: 0 };
  }
  return { x: dx / dist, y: dy / dist };
}

/**
 * Drive the world with the autopilot until `stop` says enough, or the step
 * budget runs out. Returns true when the stop condition was met.
 */
function drive(world, stop, maxSeconds, sneakNearGuards = true) {
  let path = null;
  let repathIn = 0;
  let objective = null;
  const steps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state !== WORLD_STATE.PLAYING) return stop(world);
    repathIn -= STEP;
    // Pick the objective: nearest loot still on the floor, else the exit.
    let target = null;
    let best = Infinity;
    for (const item of world.level.loot) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - world.player.x, item.y - world.player.y);
      if (d < best) { best = d; target = item; }
    }
    if (!target) target = world.level.exit;
    if (target !== objective || repathIn <= 0) {
      objective = target;
      path = findPath(world.level, tileOf(world.player.x, world.player.y), tileOf(target.x, target.y));
      repathIn = 0.5;
    }
    const move = followPath(world, path);
    // Creep when a guard is close and watching, otherwise walk.
    let sneak = false;
    if (sneakNearGuards && move.x !== 0) {
      for (const guard of world.guards) {
        if (guard.state !== 'stunned' && Math.hypot(guard.x - world.player.x, guard.y - world.player.y) < 150) {
          sneak = true;
          break;
        }
      }
    }
    world.step(STEP, { move, sneak, sprint: false, takedown: false });
    if (stop(world)) return true;
  }
  return stop(world);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: start (title over a live floor), play (mid-heist, loot in hand),
 * alert (a guard has you dead to rights), end (a floor cleared).
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.loadLevel(0);
    drive(world, (w) => w.lootGot >= 2, 60);
    if (world.state === WORLD_STATE.CAUGHT) {
      // The pilot got grabbed on the way; send it back in and try again.
      world.respawn();
      drive(world, (w) => w.lootGot >= 2, 60);
    }
    return { screen: 'playing' };
  }
  if (name === 'alert') {
    world.loadLevel(2);
    // Step the patrols a little so the cones are mid-sweep, then put the
    // thief on open floor in front of the first guard: try angles around the
    // guard until one lands on a walkable tile with a clear line of sight,
    // and turn the guard to face the thief, so the meter fills for real.
    drive(world, () => false, 4, false);
    if (world.state === WORLD_STATE.CAUGHT) {
      // The pilot got grabbed during the warm-up; send it back in and let
      // the patrols settle again before staging the scene.
      world.respawn();
      world.shared.lives = 3; // staged scene: a full set of lives
      drive(world, () => false, 2, false);
    }
    const guard = world.guards[0];
    let placed = false;
    for (let a = 0; a < 8 && !placed; a += 1) {
      const angle = guard.facing + (a * Math.PI) / 4;
      const gx = guard.x + Math.cos(angle) * 110;
      const gy = guard.y + Math.sin(angle) * 110;
      if (!isWalkable(world.level, Math.floor(gx / TILE), Math.floor(gy / TILE))) continue;
      if (!hasLineOfSight(world.level, guard.x, guard.y, gx, gy)) continue;
      world.player.x = gx;
      world.player.y = gy;
      guard.facing = Math.atan2(gy - guard.y, gx - guard.x);
      placed = true;
    }
    for (let i = 0; i < Math.floor(6 / STEP); i += 1) {
      world.step(STEP, { move: { x: 0, y: 0 }, sneak: false, sprint: false, takedown: false });
      // Freeze the frame the moment the chase is on but before the guard
      // closes the last few steps and grabs the thief.
      const gap = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      if (world.alarm && gap > 45) break;
      if (world.state !== WORLD_STATE.PLAYING) break;
    }
    return { screen: 'playing' };
  }
  if (name === 'end') {
    world.loadLevel(0);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const done = drive(world, (w) => w.state === WORLD_STATE.LEVEL_CLEAR || w.state === WORLD_STATE.VICTORY, 150);
      if (done) return { screen: world.state === WORLD_STATE.VICTORY ? 'victory' : 'levelClear' };
      if (world.state === WORLD_STATE.CAUGHT) {
        world.respawn();
        continue;
      }
      break;
    }
    return { screen: 'levelClear' };
  }
  // start (default): a live floor behind the title, guards mid-patrol.
  world.loadLevel(0);
  drive(world, () => false, 5, false);
  if (world.state === WORLD_STATE.CAUGHT) {
    world.respawn();
    drive(world, () => false, 2, false);
  }
  // The warm-up is only staging: present a pristine title — no loot taken,
  // no score, no time on the clock, full lives, calm guards.
  world.level.loot.forEach((item) => { item.taken = false; });
  world.lootGot = 0;
  world.shared.score = 0;
  world.shared.lives = 3;
  world.timer = 0;
  world.exposure = 0;
  world.guards.forEach((guard) => { guard.meter = 0; });
  return { screen: 'title' };
}

export { World };
