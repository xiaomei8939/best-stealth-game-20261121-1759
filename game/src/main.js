// SHADOW VAULT — the shell: screens, the game loop, and the wiring between
// input, world, sound and renderer. The world does the rules; this file does
// the chrome around them (title, briefing, pause, clear, caught, victory)
// and turns world events into sounds and screen-reader announcements.
import { TILE, COIN, LIVES } from './config.js';
import { World, WORLD_STATE } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import {
  ensureAudio, toggleMute, sfxClick, sfxStep, sfxAlert, sfxSuspicious, sfxPickup,
  sfxTakedown, sfxCoin, sfxUnlock, sfxCaught, sfxLevelClear, sfxVictory,
  startAmbient,
} from './audio.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);

const shared = { score: 0, lives: LIVES, coins: COIN.count };
const world = new World(0, shared);

let screen = 'title';
let ghostFloors = 0;
let time = 0;
let lastTimestamp = 0;

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function setScreen(next) {
  screen = next;
  input.clearEdges();
}

function handleWorldEvents(events) {
  for (const event of events) {
    if (event.type === 'step') sfxStep(event.loud);
    else if (event.type === 'suspicious') sfxSuspicious();
    else if (event.type === 'alerted') {
      sfxAlert();
      announce('Spotted! A guard is chasing you.');
    } else if (event.type === 'loot') {
      sfxPickup();
      announce(`Loot ${event.got} of ${event.total} stolen.`);
    } else if (event.type === 'keycard') {
      sfxPickup();
      sfxUnlock();
      announce('Keycard found — the locked doors are open.');
    } else if (event.type === 'unlocked') {
      sfxUnlock();
    } else if (event.type === 'takedown') {
      sfxTakedown();
      announce('Takedown — the guard is down for a while.');
    } else if (event.type === 'coinThrown') {
      sfxCoin();
    } else if (event.type === 'coinLanded') {
      // The ring on the floor is the sound's echo; guards turn toward it.
    } else if (event.type === 'lost') {
      announce('You lost them — stay out of the cones.');
    } else if (event.type === 'caught') {
      sfxCaught();
      setScreen(shared.lives <= 0 ? 'gameOver' : 'caught');
    } else if (event.type === 'levelClear') {
      if (!world.anyAlert) ghostFloors += 1;
      sfxLevelClear();
      setScreen('levelClear');
    }
  }
  if (world.state === WORLD_STATE.VICTORY) {
    sfxVictory();
    setScreen('victory');
  }
}

/** Convert a canvas pixel into world coordinates for aiming a coin. */
function toWorld(clientX, clientY) {
  const L = renderer.layout(world);
  return { x: (clientX - L.ox) / L.scale, y: (clientY - L.oy) / L.scale };
}

function advanceFromScreen() {
  sfxClick();
  if (screen === 'title') {
    ensureAudio();
    startAmbient();
    setScreen('briefing');
  } else if (screen === 'briefing') {
    setScreen('playing');
    announce(`${world.level.name}. Steal ${world.lootTotal} pieces, then reach the exit.`);
  } else if (screen === 'levelClear') {
    if (world.nextLevel()) setScreen('briefing');
    else setScreen('victory');
  } else if (screen === 'caught') {
    world.respawn();
    setScreen('briefing');
  } else if (screen === 'gameOver' || screen === 'victory') {
    shared.score = 0;
    shared.lives = LIVES;
    ghostFloors = 0;
    world.loadLevel(0);
    setScreen('briefing');
  }
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, lastTimestamp === 0 ? 0.016 : (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  time += dt;

  // Global keys, whatever the screen.
  if (input.wasPressed('KeyM')) {
    const muted = toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }
  if (input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) {
    if (screen !== 'playing' && screen !== 'paused') advanceFromScreen();
  }
  if (input.wasPressed('KeyP')) {
    if (screen === 'playing') setScreen('paused');
    else if (screen === 'paused') setScreen('playing');
  }
  if (input.wasPressed('KeyR') && (screen === 'playing' || screen === 'paused')) {
    world.loadLevel(world.levelIndex);
    setScreen('briefing');
  }

  if (screen === 'playing') {
    const click = input.consumeClick();
    if (click) {
      ensureAudio();
      world.throwCoin(toWorld(click.x, click.y));
    }
    const takedown = input.wasPressed('KeyE');
    const events = world.step(dt, {
      move: input.moveVector(),
      sneak: input.isSneaking(),
      sprint: input.isSprinting(),
      takedown,
    });
    handleWorldEvents(events);
  } else {
    input.consumeClick();
    input.wasPressed('KeyE');
  }

  renderer.draw(world, { screen, score: shared.score, lives: shared.lives, ghostFloors }, time);
}

// Screenshot mode: stage one fixed scene from ?shot=, paint it once, and
// stop — the frame is deterministic for the same seed.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  renderer.draw(world, { screen, score: shared.score, lives: shared.lives, ghostFloors }, 1.5);
  window.__shotReady = true;
} else {
  ensureAudio();
  requestAnimationFrame(frame);
}
