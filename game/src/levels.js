// SHADOW VAULT — the five heists.
// Every level is built from coordinates, never hand-counted strings: a blank
// 30x19 floor with border walls, then walls, crates, bushes, shadow tiles,
// doors, loot and the keycard placed at exact tiles. Legend:
//   # wall (blocks movement and sight)   . lit floor
//   s shadow floor (dark: guards spot you slower here)
//   C crate (solid cover, blocks sight)  B bush (walkable, hides you, blocks sight)
//   D locked door (needs the keycard)    P player start
//   E exit                               L loot (steal it all, then run)
//   K keycard
// Guards patrol the waypoint loops in tile coordinates and pause at each stop
// to look around — learn the loop, slip through the gap. Every patrol loop
// runs on open floor: no waypoint and no straight leg ever crosses a wall,
// a crate or a locked door.
import { TILE } from './config.js';

const MAP_W = 30;
const MAP_H = 19;

function blankGrid() {
  const grid = [];
  for (let y = 0; y < MAP_H; y += 1) {
    const row = [];
    for (let x = 0; x < MAP_W; x += 1) {
      row.push(x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? '#' : '.');
    }
    grid.push(row);
  }
  return grid;
}

/** A horizontal run of wall tiles starting at (x, y), `len` long. */
function wallRun(grid, x, y, len) {
  for (let i = 0; i < len; i += 1) grid[y][x + i] = '#';
}

function placeAll(grid, tiles, ch) {
  for (const [x, y] of tiles) grid[y][x] = ch;
}

/**
 * Build one level's ASCII map from its placements, so the parser below (and
 * the tests) see the same floor the designer meant, tile for tile.
 */
function buildLevel(def) {
  const grid = blankGrid();
  for (const [x, y, len] of def.walls || []) wallRun(grid, x, y, len);
  placeAll(grid, def.crates || [], 'C');
  placeAll(grid, def.bushes || [], 'B');
  placeAll(grid, def.shadows || [], 's');
  placeAll(grid, def.doors || [], 'D');
  placeAll(grid, def.loot || [], 'L');
  if (def.keycard) grid[def.keycard[1]][def.keycard[0]] = 'K';
  grid[def.spawn[1]][def.spawn[0]] = 'P';
  grid[def.exit[1]][def.exit[0]] = 'E';
  return {
    name: def.name,
    brief: def.brief,
    parSeconds: def.parSeconds,
    map: grid.map((row) => row.join('')),
    guards: def.guards,
  };
}

export const LEVELS = [
  buildLevel({
    name: '1 · The Gallery',
    brief: 'A quiet museum wing after closing. Two guards, four pieces to lift. Stay out of the yellow cones.',
    parSeconds: 90,
    spawn: [1, 1],
    exit: [27, 16],
    loot: [[20, 1], [26, 6], [24, 12], [3, 16]],
    crates: [[7, 6], [20, 5], [8, 14], [22, 14], [5, 15]],
    bushes: [[3, 6], [6, 16]],
    shadows: [[5, 1], [6, 1], [8, 7], [9, 7], [4, 11], [5, 11], [10, 15], [11, 15], [20, 16], [21, 16]],
    walls: [[14, 4, 4], [6, 9, 4]],
    guards: [
      { waypoints: [[4, 1], [11, 1], [11, 3], [4, 3]] },
      { waypoints: [[16, 10], [25, 10], [25, 12], [16, 12]] },
    ],
  }),
  buildLevel({
    name: '2 · The Vault Floor',
    brief: 'The vault door is locked — find the keycard first. Three guards now, and the middle hall is wide open.',
    parSeconds: 120,
    spawn: [1, 1],
    exit: [27, 16],
    loot: [[20, 1], [5, 9], [26, 11], [20, 16]],
    keycard: [26, 2],
    doors: [[14, 5]],
    crates: [[18, 3], [8, 4], [10, 7], [22, 11], [12, 15]],
    bushes: [[24, 4], [6, 8], [18, 13]],
    shadows: [[5, 3], [6, 3], [20, 8], [8, 13], [9, 13]],
    walls: [[1, 5, 13], [15, 5, 14], [12, 10, 4]],
    guards: [
      { waypoints: [[4, 1], [11, 1], [11, 3], [4, 3]] },
      { waypoints: [[16, 7], [25, 7], [25, 9], [16, 9]] },
      { waypoints: [[4, 14], [11, 14], [11, 16], [4, 16]] },
    ],
  }),
  buildLevel({
    name: '3 · The Server Wing',
    brief: 'Four guards, humming racks, and long sight lines. Bushes and shadows are your only friends here.',
    parSeconds: 150,
    spawn: [1, 1],
    exit: [27, 16],
    loot: [[20, 1], [8, 3], [5, 11], [24, 14], [20, 16]],
    keycard: [26, 2],
    doors: [[14, 6]],
    crates: [[14, 3], [22, 4], [8, 8], [14, 11], [12, 15]],
    bushes: [[6, 4], [20, 8], [10, 13]],
    shadows: [[10, 5], [11, 5], [16, 9], [6, 14]],
    walls: [[1, 6, 13], [15, 6, 14]],
    guards: [
      { waypoints: [[4, 1], [11, 1], [11, 3], [4, 3]] },
      { waypoints: [[18, 1], [25, 1], [25, 3], [18, 3]] },
      { waypoints: [[4, 10], [11, 10], [11, 12], [4, 12]] },
      { waypoints: [[18, 13], [25, 13], [25, 15], [18, 15]] },
    ],
  }),
  buildLevel({
    name: '4 · The Executive Suite',
    brief: 'Five guards, two locked doors, six pieces. The patrols overlap — wait for the gap, then move.',
    parSeconds: 180,
    spawn: [1, 1],
    exit: [27, 16],
    loot: [[20, 1], [8, 3], [5, 8], [24, 9], [6, 14], [22, 16]],
    keycard: [26, 2],
    doors: [[9, 5], [20, 11]],
    crates: [[22, 4], [14, 8], [16, 10], [24, 15]],
    bushes: [[6, 4], [10, 9], [22, 14]],
    shadows: [[12, 6], [6, 10]],
    walls: [[1, 5, 8], [10, 5, 19], [1, 11, 19], [21, 11, 8]],
    guards: [
      { waypoints: [[4, 1], [11, 1], [11, 3], [4, 3]] },
      { waypoints: [[18, 1], [25, 1], [25, 3], [18, 3]] },
      { waypoints: [[4, 7], [11, 7], [11, 9], [4, 9]] },
      { waypoints: [[18, 7], [25, 7], [25, 9], [18, 9]] },
      { waypoints: [[10, 13], [19, 13], [19, 15], [10, 15]] },
    ],
  }),
  buildLevel({
    name: '5 · The Grand Vault',
    brief: 'The last job. Six guards, seven pieces, and nowhere to hide for long. Ghost it if you can.',
    parSeconds: 210,
    spawn: [1, 1],
    exit: [27, 16],
    loot: [[20, 1], [8, 3], [13, 8], [26, 9], [5, 14], [14, 16], [24, 16]],
    keycard: [26, 2],
    doors: [[14, 5], [9, 11]],
    crates: [[22, 4], [8, 6], [6, 10], [16, 14]],
    bushes: [[6, 4], [17, 8], [24, 10], [7, 15]],
    shadows: [[12, 4], [20, 6], [10, 10], [22, 15]],
    walls: [[1, 5, 13], [15, 5, 14], [1, 11, 8], [10, 11, 19]],
    guards: [
      { waypoints: [[4, 1], [11, 1], [11, 3], [4, 3]] },
      { waypoints: [[18, 1], [25, 1], [25, 3], [18, 3]] },
      { waypoints: [[3, 7], [9, 7], [9, 9], [3, 9]] },
      { waypoints: [[20, 7], [26, 7], [26, 9], [20, 9]] },
      { waypoints: [[3, 13], [9, 13], [9, 15], [3, 15]] },
      { waypoints: [[20, 13], [26, 13], [26, 15], [20, 15]] },
    ],
  }),
];

/**
 * Parse one level definition into a grid the engine can walk.
 * Rows are padded with walls to the widest row, so a ragged map can never
 * crash the loader; the counts of loot and keycards come from the map itself.
 */
export function parseLevel(def) {
  const width = Math.max(...def.map.map((row) => row.length));
  const height = def.map.length;
  const tiles = [];
  const loot = [];
  const guards = def.guards.map((g) => ({
    waypoints: g.waypoints.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })),
  }));
  let player = { x: 1.5 * TILE, y: 1.5 * TILE };
  let exit = { x: (width - 2.5) * TILE, y: (height - 2.5) * TILE };
  let keycard = null;
  for (let y = 0; y < height; y += 1) {
    const row = [];
    const text = def.map[y].padEnd(width, '#');
    for (let x = 0; x < width; x += 1) {
      const ch = text[x];
      let tile = ch;
      if (ch === 'P') { player = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }; tile = '.'; }
      if (ch === 'E') { exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }; tile = '.'; }
      if (ch === 'L') { loot.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, taken: false, bob: 0 }); tile = '.'; }
      if (ch === 'K') { keycard = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, taken: false }; tile = '.'; }
      row.push(tile);
    }
    tiles.push(row);
  }
  return {
    name: def.name,
    brief: def.brief,
    parSeconds: def.parSeconds,
    width,
    height,
    tiles,
    loot,
    keycard,
    player,
    exit,
    guards,
    doorsLocked: def.map.some((row) => row.includes('D')),
  };
}
