// SHADOW VAULT — a tiny seeded random generator (mulberry32).
// Levels and screenshot scenes are built from a seed, so the same seed always
// deals the same floor and the same patrol timing.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True with probability `p` (0..1), from the seeded generator. */
export function chance(rng, p) {
  return rng() < p;
}

/** Integer in [min, max). */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min));
}

/** Pick one element of an array. */
export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Fisher-Yates shuffle, in place, driven by the seeded generator. */
export function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}
