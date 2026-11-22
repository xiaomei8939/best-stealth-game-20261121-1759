// SHADOW VAULT — procedural sound, no audio files.
// Every sound is synthesized with the Web Audio API at play time, so the
// game ships no samples and loads nothing over the network. The first user
// gesture creates the context (browsers require it); until then calls are
// silent no-ops.
let ctx = null;
let master = null;
let muted = false;
let ambientNodes = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, vol = 0.15, lowpass = 1200, delay = 0) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

/** A short UI click for menu advances. */
export function sfxClick() {
  tone(740, 0.05, 'triangle', 0.1);
}

/** A soft footstep; `loud` for sprinting, `surface` for floor character. */
export function sfxStep(loud) {
  noiseBurst(0.07, loud ? 0.12 : 0.05, loud ? 900 : 500);
}

/** Two-note alert sting when a guard goes from suspicious to chasing. */
export function sfxAlert() {
  tone(220, 0.16, 'sawtooth', 0.16, 330);
  tone(330, 0.22, 'sawtooth', 0.16, 440, 0.12);
}

/** A single questioning blip when a guard grows suspicious. */
export function sfxSuspicious() {
  tone(520, 0.1, 'triangle', 0.14, 660);
}

/** Bright pickup chime for loot and the keycard. */
export function sfxPickup() {
  tone(880, 0.09, 'sine', 0.18);
  tone(1318, 0.14, 'sine', 0.16, null, 0.07);
}

/** A dull thud for a takedown, then a soft exhale. */
export function sfxTakedown() {
  noiseBurst(0.16, 0.22, 300);
  tone(140, 0.2, 'sine', 0.2, 70, 0.05);
}

/** A coin clink that carries across the room. */
export function sfxCoin() {
  tone(2093, 0.06, 'square', 0.07);
  tone(2637, 0.1, 'square', 0.06, null, 0.05);
}

/** The door unlocking. */
export function sfxUnlock() {
  tone(180, 0.08, 'square', 0.12);
  tone(360, 0.12, 'square', 0.12, null, 0.09);
}

/** Caught: a low drone that falls away. */
export function sfxCaught() {
  tone(160, 0.7, 'sawtooth', 0.2, 55);
  noiseBurst(0.4, 0.12, 400, 0.05);
}

/** Level clear: a short rising arpeggio. */
export function sfxLevelClear() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, null, i * 0.09));
}

/** Final victory fanfare. */
export function sfxVictory() {
  [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, null, i * 0.11));
}

/** A low room tone that starts with the game and never stops. */
export function startAmbient() {
  if (!ctx || !master || ambientNodes) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;
  const gain = ctx.createGain();
  gain.gain.value = 0.035;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  lfo.start();
  ambientNodes = { osc, lfo };
}
