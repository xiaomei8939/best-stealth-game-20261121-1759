// SHADOW VAULT — line of sight and vision cones.
// A guard sees the player only when three things are true: the player is
// inside the cone's range and angle, and no wall, crate or bush stands on the
// line between them. Sight is tested on the tile grid with a DDA walk, which
// is exact for the grid and cheap enough to run for every guard every frame.
import { TILE } from './config.js';

export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return '#';
  return level.tiles[ty][tx];
}

export function isSolidTile(ch) {
  return ch === '#' || ch === 'C' || ch === 'D';
}

export function blocksSight(ch) {
  return ch === '#' || ch === 'C' || ch === 'B' || ch === 'D';
}

export function isWalkable(level, tx, ty) {
  return !isSolidTile(tileAt(level, tx, ty));
}

/** True when the straight line from (x0,y0) to (x1,y1) crosses no sight-blocking tile. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 3)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(tileAt(level, tx, ty))) return false;
  }
  return true;
}

/** Distance from (x,y) along `angle` until a sight-blocking tile, capped at maxDist.
 *  Starts half a tile out, so a guard standing against a wall does not clip
 *  its own cone into the wall behind it. */
export function castRay(level, x, y, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const step = TILE / 4;
  let d = TILE / 2;
  while (d < maxDist) {
    const tx = Math.floor((x + dx * d) / TILE);
    const ty = Math.floor((y + dy * d) / TILE);
    if (blocksSight(tileAt(level, tx, ty))) return d;
    d += step;
  }
  return maxDist;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * How visible the player is to one guard right now, 0 (invisible) to 1
 * (standing in the open under the lamps). Distance, stance, shadow and bush
 * all scale it; the caller turns it into a meter fill rate.
 */
export function visibilityToGuard(level, guard, player, stance) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  const range = guard.visionRange;
  if (dist > range) return 0;
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, guard.facing)) > guard.visionHalfAngle) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return 0;
  // Close is obvious; far away is a smudge. Never zero inside the cone.
  let vis = 1 - (dist / range) * 0.65;
  if (stance === 'sneak') vis *= 0.45;
  if (stance === 'sprint') vis *= 1.6;
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  const ground = tileAt(level, ptx, pty);
  if (ground === 's') vis *= 0.4;
  if (ground === 'B') vis *= dist < 46 ? 0.6 : 0.12;
  return Math.max(0, Math.min(1.4, vis));
}

/**
 * Breadth-first path across walkable tiles, as a list of tile coordinates
 * from `from` to `to`; null when unreachable. Guards use it to chase and
 * investigate around walls instead of walking through them, and the
 * screenshot autopilot uses it to walk a level.
 */
export function findPath(level, from, to) {
  const key = (tx, ty) => `${tx},${ty}`;
  const prev = new Map();
  const queue = [from];
  prev.set(key(from.tx, from.ty), null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.tx === to.tx && cur.ty === to.ty) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift(node);
        node = prev.get(key(node.tx, node.ty));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      if (!isWalkable(level, nx, ny)) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), cur);
      queue.push({ tx: nx, ty: ny });
    }
  }
  return null;
}

/**
 * The cone as a polygon of ray endpoints, for rendering. Rays fan across the
 * cone and stop at the first wall, so the lit area hugs the furniture.
 */
export function conePolygon(level, guard, rays = 26) {
  const points = [{ x: guard.x, y: guard.y }];
  const start = guard.facing - guard.visionHalfAngle;
  const end = guard.facing + guard.visionHalfAngle;
  for (let i = 0; i <= rays; i += 1) {
    const angle = start + ((end - start) * i) / rays;
    const d = castRay(level, guard.x, guard.y, angle, guard.visionRange);
    points.push({ x: guard.x + Math.cos(angle) * d, y: guard.y + Math.sin(angle) * d });
  }
  return points;
}
