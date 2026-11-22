// SHADOW VAULT — the world: one level, one thief, its guards.
// Pure logic: no DOM, no audio, no canvas. It steps the simulation from an
// input snapshot and reports what happened as events, so the shell can turn
// them into sound and HUD, and a headless test can drive it to a win or a
// loss. Collision is circle-versus-tile, axis separated, so the thief slides
// along walls instead of sticking to them.
import { TILE, PLAYER, GUARD, COIN, SCORE, LIVES, TAKEDOWN_RANGE, PICKUP_RADIUS, EXIT_RADIUS } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { isWalkable, tileAt } from './vision.js';
import { createGuard, updateGuard, guardHearNoise, guardTakedown, canTakedown, guardCatches, GUARD_STATE } from './guards.js';

export const WORLD_STATE = {
  PLAYING: 'playing',
  LEVEL_CLEAR: 'levelClear',
  CAUGHT: 'caught',
  GAME_OVER: 'gameOver',
  VICTORY: 'victory',
};

function circleHitsSolid(level, x, y, r) {
  const minTx = Math.floor((x - r) / TILE);
  const maxTx = Math.floor((x + r) / TILE);
  const minTy = Math.floor((y - r) / TILE);
  const maxTy = Math.floor((y + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (!isWalkable(level, tx, ty)) {
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
      }
    }
  }
  return false;
}

export class World {
  constructor(levelIndex = 0, shared = null) {
    this.levelIndex = levelIndex;
    this.shared = shared || { score: 0, lives: LIVES, coins: COIN.count };
    this.events = [];
    this.loadLevel(levelIndex);
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    this.player = {
      x: this.level.player.x,
      y: this.level.player.y,
      facing: 0,
      stance: 'walk',
      moving: false,
      stepTimer: 0,
    };
    this.guards = this.level.guards.map((def, i) => createGuard(def, i));
    this.coins = COIN.count;
    this.hasKeycard = false;
    this.lootGot = 0;
    this.state = WORLD_STATE.PLAYING;
    this.timer = 0;
    this.anyAlert = false;
    this.exposure = 0; // the highest guard meter right now
    this.alarm = false;
    this.noiseRings = []; // {x, y, radius, ttl} — shown fading on the floor
    this.coinFlights = []; // a thrown coin arcing to its landing spot
    this.banner = null; // short hint text, {text, ttl}
    this.clearBonus = 0;
    this.events.length = 0;
  }

  get lootTotal() {
    return this.level.loot.length;
  }

  get lootLeft() {
    return this.level.loot.filter((l) => !l.taken).length;
  }

  /** Restart the current level after being caught, keeping score and lives. */
  respawn() {
    // loadLevel only rebuilds the floor, the guards and the thief: the
    // shared score and lives survive untouched.
    this.loadLevel(this.levelIndex);
  }

  unlockDoors() {
    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        if (this.level.tiles[y][x] === 'D') this.level.tiles[y][x] = '.';
      }
    }
    this.events.push({ type: 'unlocked' });
  }

  throwCoin(target) {
    if (this.coins <= 0 || this.state !== WORLD_STATE.PLAYING) return false;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, COIN.throwRange);
    const landing = dist > 0
      ? { x: this.player.x + (dx / dist) * clamped, y: this.player.y + (dy / dist) * clamped }
      : { x: this.player.x, y: this.player.y };
    this.coins -= 1;
    this.coinFlights.push({ from: { x: this.player.x, y: this.player.y }, to: landing, t: 0, dur: 0.35 });
    this.events.push({ type: 'coinThrown', ...landing });
    return true;
  }

  tryTakedown() {
    for (const guard of this.guards) {
      if (canTakedown(guard, this.player)) {
        guardTakedown(guard);
        this.shared.score += SCORE.takedown;
        this.events.push({ type: 'takedown', guard: guard.id });
        return true;
      }
    }
    return false;
  }

  step(dt, input) {
    this.events.length = 0;
    if (this.state !== WORLD_STATE.PLAYING) return this.events;
    this.timer += dt;

    // --- player movement ---
    const mv = input.move || { x: 0, y: 0 };
    const moving = mv.x !== 0 || mv.y !== 0;
    const stance = input.sneak ? 'sneak' : input.sprint ? 'sprint' : 'walk';
    this.player.stance = stance;
    this.player.moving = moving;
    const speed = stance === 'sneak' ? PLAYER.sneakSpeed : stance === 'sprint' ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (moving) {
      this.player.facing = Math.atan2(mv.y, mv.x);
      const nx = this.player.x + mv.x * speed * dt;
      if (!circleHitsSolid(this.level, nx, this.player.y, PLAYER.radius)) this.player.x = nx;
      const ny = this.player.y + mv.y * speed * dt;
      if (!circleHitsSolid(this.level, this.player.x, ny, PLAYER.radius)) this.player.y = ny;
      // Footsteps and the noise they make.
      this.player.stepTimer -= dt;
      if (this.player.stepTimer <= 0) {
        this.player.stepTimer = stance === 'sprint' ? 0.26 : stance === 'sneak' ? 0.55 : 0.38;
        this.events.push({ type: 'step', loud: stance === 'sprint' });
      }
      const noise = stance === 'sneak' ? PLAYER.noiseSneak : stance === 'sprint' ? PLAYER.noiseSprint : PLAYER.noiseWalk;
      if (noise > 0) {
        for (const guard of this.guards) guardHearNoise(guard, this.player.x, this.player.y, noise);
      }
    }

    // --- thrown coins land and ring out ---
    for (let i = this.coinFlights.length - 1; i >= 0; i -= 1) {
      const flight = this.coinFlights[i];
      flight.t += dt;
      if (flight.t >= flight.dur) {
        this.coinFlights.splice(i, 1);
        this.noiseRings.push({ x: flight.to.x, y: flight.to.y, radius: COIN.noiseRadius, ttl: 0.9 });
        for (const guard of this.guards) guardHearNoise(guard, flight.to.x, flight.to.y, COIN.noiseRadius);
        this.events.push({ type: 'coinLanded', x: flight.to.x, y: flight.to.y });
      }
    }
    for (let i = this.noiseRings.length - 1; i >= 0; i -= 1) {
      this.noiseRings[i].ttl -= dt;
      if (this.noiseRings[i].ttl <= 0) this.noiseRings.splice(i, 1);
    }

    // --- takedown ---
    if (input.takedown) this.tryTakedown();

    // --- pickups ---
    for (const item of this.level.loot) {
      if (!item.taken && Math.hypot(item.x - this.player.x, item.y - this.player.y) < PICKUP_RADIUS) {
        item.taken = true;
        item.bob = 0;
        this.lootGot += 1;
        this.shared.score += SCORE.loot;
        this.events.push({ type: 'loot', got: this.lootGot, total: this.lootTotal });
      }
      item.bob += dt;
    }
    const card = this.level.keycard;
    if (card && !card.taken && Math.hypot(card.x - this.player.x, card.y - this.player.y) < PICKUP_RADIUS) {
      card.taken = true;
      this.hasKeycard = true;
      this.shared.score += SCORE.keycard;
      this.unlockDoors();
      this.events.push({ type: 'keycard' });
    }

    // --- guards ---
    this.exposure = 0;
    this.alarm = false;
    for (const guard of this.guards) {
      updateGuard(this.level, guard, this.player, stance, dt);
      this.exposure = Math.max(this.exposure, guard.meter);
      if (guard.state === GUARD_STATE.CHASE) {
        this.alarm = true;
        this.anyAlert = true;
      }
      for (const event of guard.events) {
        if (event.type === 'alerted') this.events.push({ type: 'alerted', guard: guard.id });
        if (event.type === 'suspicious') this.events.push({ type: 'suspicious', guard: guard.id });
        if (event.type === 'lost') this.events.push({ type: 'lost', guard: guard.id });
      }
    }

    // --- caught? ---
    for (const guard of this.guards) {
      if (guardCatches(guard, this.player)) {
        this.shared.lives -= 1;
        this.events.push({ type: 'caught', lives: this.shared.lives });
        this.state = this.shared.lives <= 0 ? WORLD_STATE.GAME_OVER : WORLD_STATE.CAUGHT;
        return this.events;
      }
    }

    // --- exit ---
    const exitDist = Math.hypot(this.level.exit.x - this.player.x, this.level.exit.y - this.player.y);
    if (exitDist < EXIT_RADIUS) {
      if (this.lootLeft === 0) {
        const timeBonus = Math.max(0, Math.round((this.level.parSeconds - this.timer) * SCORE.timeBonusPerSecond));
        const ghostBonus = this.anyAlert ? 0 : SCORE.ghostBonus;
        this.clearBonus = timeBonus + ghostBonus;
        this.shared.score += this.clearBonus;
        this.events.push({ type: 'levelClear', bonus: this.clearBonus, timeBonus, ghostBonus });
        this.state = this.levelIndex >= LEVELS.length - 1 ? WORLD_STATE.VICTORY : WORLD_STATE.LEVEL_CLEAR;
      } else if (!this.banner || this.banner.ttl <= 0) {
        this.banner = { text: `The exit is locked to looters — ${this.lootLeft} piece${this.lootLeft > 1 ? 's' : ''} left to steal.`, ttl: 2.5 };
      }
    }
    if (this.banner) {
      this.banner.ttl -= dt;
      if (this.banner.ttl <= 0) this.banner = null;
    }
    return this.events;
  }

  /** The tile the player stands on, for shadow / bush checks. */
  playerTile() {
    return tileAt(this.level, Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
  }

  /** Advance to the next level, carrying score and lives. Returns false on the last. */
  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) return false;
    this.loadLevel(this.levelIndex + 1);
    return true;
  }
}
