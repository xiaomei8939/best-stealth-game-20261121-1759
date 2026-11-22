// SHADOW VAULT — everything the player sees, drawn on one canvas.
// The renderer owns the camera (the map is scaled to fit under the HUD),
// the night lighting, the vision cones, the HUD and every menu screen. It
// never changes game state: it reads the world and paints it.
import { TILE, VIEW_W, VIEW_H, HUD_H, COLORS } from './config.js';
import { GUARD_STATE } from './guards.js';
import { conePolygon } from './vision.js';
import { LEVELS } from './levels.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function layout(world) {
    const mapW = world.level.width * TILE;
    const mapH = world.level.height * TILE;
    const scale = Math.min((VIEW_W - 48) / mapW, (VIEW_H - HUD_H - 32) / mapH);
    const ox = (VIEW_W - mapW * scale) / 2;
    const oy = HUD_H + (VIEW_H - HUD_H - mapH * scale) / 2;
    return { scale, ox, oy };
  }

  function drawFloor(world, L) {
    const { tiles, width, height } = world.level;
    for (let ty = 0; ty < height; ty += 1) {
      for (let tx = 0; tx < width; tx += 1) {
        const ch = tiles[ty][tx];
        const x = L.ox + tx * TILE * L.scale;
        const y = L.oy + ty * TILE * L.scale;
        const s = TILE * L.scale;
        const v = hash2(tx, ty);
        if (ch === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, s + 0.5, s + 0.5);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x, y, s + 0.5, Math.max(2, s * 0.14));
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y + s - Math.max(2, s * 0.12), s + 0.5, Math.max(2, s * 0.12));
        } else if (ch === 'C') {
          ctx.fillStyle = COLORS.floorB;
          ctx.fillRect(x, y, s + 0.5, s + 0.5);
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76);
          ctx.fillStyle = COLORS.crateTop;
          ctx.fillRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.2);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76);
        } else if (ch === 'B') {
          ctx.fillStyle = COLORS.floorB;
          ctx.fillRect(x, y, s + 0.5, s + 0.5);
          ctx.fillStyle = COLORS.bush;
          ctx.beginPath();
          ctx.arc(x + s * 0.5, y + s * 0.55, s * 0.42, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.bushTop;
          ctx.beginPath();
          ctx.arc(x + s * 0.38, y + s * 0.42, s * 0.2, 0, Math.PI * 2);
          ctx.arc(x + s * 0.62, y + s * 0.48, s * 0.16, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'D') {
          ctx.fillStyle = COLORS.floorB;
          ctx.fillRect(x, y, s + 0.5, s + 0.5);
          ctx.fillStyle = COLORS.door;
          ctx.fillRect(x + s * 0.08, y, s * 0.84, s);
          ctx.fillStyle = '#d8b13c';
          ctx.fillRect(x + s * 0.46, y + s * 0.42, s * 0.08, s * 0.16);
        } else {
          ctx.fillStyle = ch === 's' ? COLORS.shadowFloor : (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
          ctx.fillRect(x, y, s + 0.5, s + 0.5);
          if (ch === 's' && v > 0.6) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(x + s * 0.2, y + s * 0.3, s * 0.6, s * 0.1);
          } else if (ch !== 's' && v > 0.82) {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(x, y, s + 0.5, s * 0.08);
          }
        }
      }
    }
  }

  function drawExitAndLoot(world, L, time) {
    const s = TILE * L.scale;
    const ex = world.level.exit;
    const exX = L.ox + ex.x * L.scale;
    const exY = L.oy + ex.y * L.scale;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.save();
    ctx.fillStyle = COLORS.exit;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(exX, exY, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25 + 0.2 * pulse;
    ctx.beginPath();
    ctx.arc(exX, exY, s * (0.75 + 0.12 * pulse), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#eafff2';
    ctx.font = `bold ${Math.round(s * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', exX, exY + 1);
    ctx.restore();

    for (const item of world.level.loot) {
      if (item.taken) continue;
      const bob = Math.sin(item.bob * 3) * s * 0.08;
      const x = L.ox + item.x * L.scale;
      const y = L.oy + item.y * L.scale + bob;
      // Glow first, then the gem on top, so the light never washes it out.
      ctx.fillStyle = 'rgba(255, 211, 77, 0.5)';
      ctx.beginPath();
      ctx.arc(x, y, s * (0.4 + 0.08 * pulse), 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.loot;
      ctx.shadowColor = COLORS.loot;
      ctx.shadowBlur = 12;
      const r = s * 0.26;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    const card = world.level.keycard;
    if (card && !card.taken) {
      const x = L.ox + card.x * L.scale;
      const y = L.oy + card.y * L.scale;
      ctx.save();
      ctx.fillStyle = COLORS.keycard;
      ctx.shadowColor = COLORS.keycard;
      ctx.shadowBlur = 10;
      roundRect(ctx, x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.4, 3);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#06283d';
      ctx.fillRect(x - s * 0.2, y - s * 0.08, s * 0.4, s * 0.05);
    }
  }

  function drawCones(world, L) {
    for (const guard of world.guards) {
      const poly = conePolygon(world.level, guard);
      ctx.beginPath();
      ctx.moveTo(L.ox + poly[0].x * L.scale, L.oy + poly[0].y * L.scale);
      for (let i = 1; i < poly.length; i += 1) {
        ctx.lineTo(L.ox + poly[i].x * L.scale, L.oy + poly[i].y * L.scale);
      }
      ctx.closePath();
      if (guard.state === GUARD_STATE.CHASE) ctx.fillStyle = COLORS.coneAlert;
      else if (guard.state === GUARD_STATE.SUSPICIOUS || guard.state === GUARD_STATE.INVESTIGATE) ctx.fillStyle = COLORS.coneSuspicious;
      else ctx.fillStyle = COLORS.coneCalm;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 220, 120, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawNoise(world, L) {
    for (const ring of world.noiseRings) {
      const a = Math.max(0, ring.ttl / 0.9);
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.7 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(L.ox + ring.x * L.scale, L.oy + ring.y * L.scale, ring.radius * L.scale * (1.1 - a * 0.4), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const flight of world.coinFlights) {
      const t = Math.min(1, flight.t / flight.dur);
      const x = flight.from.x + (flight.to.x - flight.from.x) * t;
      const y = flight.from.y + (flight.to.y - flight.from.y) * t - Math.sin(t * Math.PI) * 26;
      ctx.fillStyle = COLORS.loot;
      ctx.beginPath();
      ctx.arc(L.ox + x * L.scale, L.oy + y * L.scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGuard(world, L, guard, time) {
    const x = L.ox + guard.x * L.scale;
    const y = L.oy + guard.y * L.scale;
    const r = 12 * L.scale;
    if (guard.state === GUARD_STATE.STUNNED) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#7a7568';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd34d';
      ctx.font = `bold ${Math.round(14 * L.scale + 6)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('z z', x, y - r - 6);
      return;
    }
    // Body: a red uniform with a visor facing the patrol direction.
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const fx = Math.cos(guard.facing);
    const fy = Math.sin(guard.facing);
    ctx.fillStyle = '#2b0f0c';
    ctx.beginPath();
    ctx.arc(x + fx * r * 0.45, y + fy * r * 0.45, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion arc above the head.
    if (guard.meter > 0.05) {
      ctx.strokeStyle = guard.meter >= 1 ? '#ff3c28' : '#ffb02e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, guard.meter));
      ctx.stroke();
    }
    if (guard.state === GUARD_STATE.CHASE) {
      ctx.fillStyle = '#ff3c28';
      ctx.font = `bold ${Math.round(20 * L.scale + 8)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - r - 8);
    } else if (guard.state === GUARD_STATE.SUSPICIOUS || guard.state === GUARD_STATE.INVESTIGATE || guard.state === GUARD_STATE.SEARCH) {
      ctx.fillStyle = '#ffb02e';
      ctx.font = `bold ${Math.round(18 * L.scale + 8)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', x, y - r - 8);
    }
  }

  function drawPlayer(world, L, time) {
    const p = world.player;
    const x = L.ox + p.x * L.scale;
    const y = L.oy + p.y * L.scale;
    const r = 11 * L.scale;
    const crouch = p.stance === 'sneak' ? 0.82 : 1;
    // Soft shadow under the thief.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloak: a hooded figure pointing where it moves.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.facing);
    ctx.fillStyle = COLORS.playerCloak;
    ctx.beginPath();
    ctx.moveTo(r * 1.25, 0);
    ctx.lineTo(-r * 0.9, -r * 0.85);
    ctx.lineTo(-r * 0.9, r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(x, y, r * crouch, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a5344';
    ctx.lineWidth = 2;
    ctx.stroke();
    // The hood's dark face.
    ctx.fillStyle = '#1a2233';
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.facing) * r * 0.35, y + Math.sin(p.facing) * r * 0.35, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (p.stance === 'sneak') {
      ctx.fillStyle = 'rgba(232, 228, 216, 0.85)';
      ctx.font = `${Math.round(11 * L.scale + 4)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', x, y - r - 8);
    }
  }

  function drawLighting(world, L) {
    const p = world.player;
    const x = L.ox + p.x * L.scale;
    const y = L.oy + p.y * L.scale;
    const g = ctx.createRadialGradient(x, y, 120, x, y, 560);
    g.addColorStop(0, 'rgba(3, 5, 10, 0)');
    g.addColorStop(0.55, 'rgba(3, 5, 10, 0.18)');
    g.addColorStop(1, 'rgba(3, 5, 10, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
  }

  function drawHud(world, ui) {
    ctx.fillStyle = '#0b0e15';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = '#232838';
    ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(world.level.name, 20, 24);
    ctx.fillStyle = COLORS.dim;
    ctx.font = `15px ${FONT}`;
    const mins = Math.floor(world.timer / 60);
    const secs = Math.floor(world.timer % 60);
    ctx.fillText(`Time ${mins}:${String(secs).padStart(2, '0')}  ·  Par ${world.level.parSeconds}s`, 20, 48);

    // Loot pips.
    let lx = 330;
    ctx.fillStyle = COLORS.dim;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('LOOT', lx, 26);
    lx += 52;
    for (let i = 0; i < world.lootTotal; i += 1) {
      const got = i < world.lootGot;
      ctx.save();
      ctx.translate(lx + i * 26, 26);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = got ? COLORS.loot : 'rgba(255,211,77,0.25)';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
    // Coins and keycard.
    let cx = 330;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`Coins ${world.coins}  ${world.hasKeycard ? '·  KEYCARD ✓' : world.level.doorsLocked ? '·  Find the keycard' : ''}`, cx, 48);

    // Score and lives, right side.
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`SCORE ${ui.score}`, VIEW_W - 20, 24);
    ctx.fillStyle = '#ff5d6c';
    ctx.font = `18px ${FONT}`;
    ctx.fillText('♥'.repeat(Math.max(0, ui.lives)) + '♡'.repeat(Math.max(0, 3 - ui.lives)), VIEW_W - 20, 48);
    ctx.textAlign = 'left';

    // Detection eye: the meter that decides everything.
    const ex = VIEW_W / 2 - 130;
    const ey = HUD_H + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, ex - 8, ey - 4, 276, 26, 13);
    ctx.fill();
    ctx.fillStyle = world.alarm ? '#ff3c28' : COLORS.dim;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(world.alarm ? 'SPOTTED!' : 'UNSEEN', ex + 6, ey + 9);
    const barX = ex + 92;
    const barW = 168;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, ey + 1, barW, 14, 7);
    ctx.fill();
    const fill = Math.min(1, world.exposure);
    ctx.fillStyle = fill > 0.66 ? '#ff3c28' : fill > 0.33 ? '#ffb02e' : '#ffd34d';
    if (fill > 0.01) {
      roundRect(ctx, barX, ey + 1, barW * fill, 14, 7);
      ctx.fill();
    }

    // Banner hint.
    if (world.banner) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const bw = ctx.measureText(world.banner.text).width + 36;
      roundRect(ctx, VIEW_W / 2 - bw / 2, VIEW_H - 52, bw, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `15px ${FONT}`;
      ctx.fillText(world.banner.text, VIEW_W / 2, VIEW_H - 34);
      ctx.textAlign = 'left';
    }

    // Controls reminder, bottom left.
    ctx.fillStyle = 'rgba(154, 163, 178, 0.85)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('WASD move · C sneak · Shift sprint · E takedown (from behind) · Click throw a coin · P pause · M mute', 16, VIEW_H - 16);
  }

  function drawMinimap(world, L) {
    const mw = 150;
    const mh = (mw * world.level.height) / world.level.width;
    // Bottom left, above the controls line: the bottom-right corner is where
    // the EXIT pad usually sits, and the minimap must never cover it.
    const mx = 16;
    const my = VIEW_H - mh - 40;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 14, 0.78)';
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    const sx = mw / (world.level.width * TILE);
    const sy = mh / (world.level.height * TILE);
    for (let ty = 0; ty < world.level.height; ty += 1) {
      for (let tx = 0; tx < world.level.width; tx += 1) {
        const ch = world.level.tiles[ty][tx];
        if (ch === '#') ctx.fillStyle = '#4d5870';
        else if (ch === 'C') ctx.fillStyle = '#7a5f3f';
        else if (ch === 'B') ctx.fillStyle = '#2c5a36';
        else if (ch === 'D') ctx.fillStyle = '#8a6d2f';
        else if (ch === 's') ctx.fillStyle = '#12141d';
        else ctx.fillStyle = '#2a2f3c';
        ctx.fillRect(mx + tx * TILE * sx, my + ty * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
      }
    }
    ctx.fillStyle = COLORS.exit;
    ctx.fillRect(mx + world.level.exit.x * sx - 3, my + world.level.exit.y * sy - 3, 6, 6);
    for (const item of world.level.loot) {
      if (item.taken) continue;
      ctx.fillStyle = COLORS.loot;
      ctx.fillRect(mx + item.x * sx - 2, my + item.y * sy - 2, 4, 4);
    }
    for (const guard of world.guards) {
      ctx.fillStyle = guard.state === GUARD_STATE.CHASE ? '#ff3c28' : '#d8b13c';
      ctx.beginPath();
      ctx.arc(mx + guard.x * sx, my + guard.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function overlay(title, lines, accent = '#ffd34d') {
    ctx.fillStyle = 'rgba(4, 6, 12, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 110);
    ctx.fillStyle = COLORS.text;
    let y = VIEW_H / 2 - 52;
    for (const line of lines) {
      ctx.font = line.bold ? `bold 22px ${FONT}` : `19px ${FONT}`;
      ctx.fillStyle = line.bold ? COLORS.text : COLORS.dim;
      ctx.fillText(line.text, VIEW_W / 2, y);
      y += 34;
    }
    ctx.textAlign = 'left';
  }

  function drawTitle(world, time) {
    overlay('SHADOW VAULT', [
      { text: 'A top-down stealth heist in five floors.', bold: true },
      { text: 'Slip past the patrols. Lift every piece. Reach the EXIT unseen.', bold: false },
      { text: 'WASD move · C sneak · Shift sprint · E takedown from behind', bold: false },
      { text: 'Click to throw a coin and lure a guard away · P pause · M mute', bold: false },
      { text: 'Press ENTER or click to begin', bold: true },
    ]);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = `bold 17px ${FONT}`;
    const blink = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    ctx.fillText('— 5 LEVELS · GHOST BONUS · NO ALARM, NO PROBLEM —', VIEW_W / 2, VIEW_H / 2 + 130);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawBriefing(world) {
    overlay(world.level.name, [
      { text: world.level.brief, bold: true },
      { text: `Loot to steal: ${world.lootTotal}    Guards on patrol: ${world.guards.length}`, bold: false },
      { text: world.level.doorsLocked ? 'A locked door blocks the way — find the keycard.' : 'No locked doors on this floor.', bold: false },
      { text: 'Press ENTER to start the floor', bold: true },
    ], '#e8e4d8');
  }

  function drawPaused() {
    overlay('PAUSED', [
      { text: 'The guards wait. So does the vault.', bold: true },
      { text: 'Press P to resume · M mute · R restart the floor', bold: false },
    ], '#e8e4d8');
  }

  function drawLevelClear(world, ui) {
    overlay('FLOOR CLEARED', [
      { text: `${world.level.name} — clean getaway.`, bold: true },
      { text: `Time bonus + ghost bonus: +${world.clearBonus}`, bold: false },
      { text: `Score: ${ui.score}    Lives: ${ui.lives}`, bold: false },
      { text: 'Press ENTER for the next floor', bold: true },
    ], '#7ddc8f');
  }

  function drawCaught(world, ui) {
    overlay('CAUGHT!', [
      { text: 'A guard grabbed you by the collar and marched you out.', bold: true },
      { text: `Lives left: ${ui.lives}`, bold: false },
      { text: 'Press ENTER to slip back in at the entrance', bold: true },
    ], '#ff5d6c');
  }

  function drawGameOver(world, ui) {
    overlay('BUSTED', [
      { text: 'Three strikes. The museum keeps its gold tonight.', bold: true },
      { text: `Final score: ${ui.score} — reached ${world.level.name}`, bold: false },
      { text: 'Press ENTER to start the whole job over', bold: true },
    ], '#ff5d6c');
  }

  function drawVictory(world, ui) {
    const ghostFloors = ui.ghostFloors || 0;
    overlay('THE GRAND VAULT IS YOURS', [
      { text: 'Five floors, every piece lifted, the night is yours.', bold: true },
      { text: `Final score: ${ui.score}`, bold: true },
      { text: ghostFloors > 0 ? `Ghosted ${ghostFloors} floor${ghostFloors > 1 ? 's' : ''} without a single alarm.` : 'The guards knew someone was there — but never who.', bold: false },
      { text: 'Press ENTER to run it again', bold: true },
    ], '#ffd34d');
  }

  /** Paint one frame. `ui.screen` picks the overlay; the world is always drawn underneath. */
  function draw(world, ui, time) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const L = layout(world);
    drawFloor(world, L);
    drawExitAndLoot(world, L, time);
    drawCones(world, L);
    drawNoise(world, L);
    for (const guard of world.guards) drawGuard(world, L, guard, time);
    drawPlayer(world, L, time);
    drawLighting(world, L);
    // While any guard is chasing, the edges of the screen burn red: the
    // player should feel the alarm, not just read it in the HUD.
    if (world.alarm) {
      const g = ctx.createRadialGradient(
        VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.32, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.72,
      );
      g.addColorStop(0, 'rgba(255, 40, 20, 0)');
      g.addColorStop(1, `rgba(255, 40, 20, ${0.22 + 0.1 * Math.sin(time * 6)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
    }
    drawHud(world, ui);
    drawMinimap(world, L);

    if (ui.screen === 'title') drawTitle(world, time);
    else if (ui.screen === 'briefing') drawBriefing(world);
    else if (ui.screen === 'paused') drawPaused();
    else if (ui.screen === 'levelClear') drawLevelClear(world, ui);
    else if (ui.screen === 'caught') drawCaught(world, ui);
    else if (ui.screen === 'gameOver') drawGameOver(world, ui);
    else if (ui.screen === 'victory') drawVictory(world, ui);
  }

  return { draw, layout };
}
