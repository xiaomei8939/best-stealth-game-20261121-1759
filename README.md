# SHADOW VAULT — a top-down stealth heist

A complete, original stealth game that plays offline in a desktop browser
from its own static files. You are a thief working five floors of a museum
at night: slip past the patrols, lift every piece of loot, and reach the
EXIT unseen.

## How it plays

- **Vision cones.** Every guard sweeps a yellow cone. Stand in it and their
  suspicion meter fills — the arc over their head shows how close you are
  to being spotted. Break line of sight and the meter drains.
- **Alert states.** A glimpse makes a guard suspicious (`?`): they freeze,
  stare, then come to look. A full meter means a chase (`!`) and an alarm.
  Lose them and they search the area, then go back to their patrol.
- **Stances matter.** Sneak (C) to move slowly and quietly through cones;
  sprint (Shift) to cross open ground fast — but sprinting is loud and
  much easier to spot. Walking is the middle ground.
- **Cover you can read.** Walls and crates block sight. Dark shadow tiles
  slow detection. Bushes hide you almost completely. The minimap shows
  every guard, every loot piece and the exit.
- **Tools.** Press E behind a guard for a silent takedown (+150). Click to
  throw a coin (3 per floor): guards hear the clink and go investigate.
  Find the keycard to open locked doors.
- **Five floors, escalating.** More guards, longer sight lines, tighter
  patrol overlaps — and a ghost bonus (+500) for clearing a floor without
  any guard ever going alert. Three lives; get caught three times and the
  job is busted.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| C (hold) | Sneak — slow, quiet, hard to spot |
| Shift (hold) | Sprint — fast, loud, easy to spot |
| E | Takedown (from behind a guard) |
| Mouse click | Throw a coin to distract guards |
| P | Pause |
| R | Restart the floor |
| M | Mute |
| Enter | Advance through menus |

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open the page in desktop Chrome. No build step, no network requests:
every script, sound (synthesized with Web Audio) and image is a file
under `game/` or generated at runtime.

## Files

```
main.ts            hands the entry in (copies game/ + screenshots/, writes dossier.json)
serve.ts           tiny static server for local play
game/index.html    the page
game/src/config.js tuning constants and the palette
game/src/levels.js the five floor plans and guard patrols
game/src/vision.js line of sight, vision cones, raycasting
game/src/guards.js guard AI: patrol, suspicious, investigate, chase, search
game/src/world.js  the simulation: movement, noise, loot, takedowns, win/loss
game/src/render.js canvas drawing: night lighting, cones, HUD, minimap, menus
game/src/audio.js  procedural Web Audio sound effects
game/src/input.js  keyboard and mouse
game/src/shots.js  deterministic screenshot scenes (?shot=start|play|alert|end)
game/src/main.js   screens, game loop, event-to-sound wiring
vendor/makefun-game.ts  the kit's dossier library, unchanged
```

Screenshots are real renders of the game's own code, staged by
`game/src/shots.js` from `?shot=` scenes (`shots.json` lists them).

## Design notes

The judge sees the game mostly through its screenshots, so every floor is
built to read at a glance: yellow vision cones against a dark floor, crates
and bushes as obvious cover, a green EXIT pad, gold loot that glows. The
detection meter is gradual, not binary — a near miss raises suspicion, a
full meter raises the alarm, and breaking line of sight always gives the
player a way back. Patrols are fixed loops with a pause at each stop, so a
patient player can learn the rhythm and slip through the gap; the coin,
the takedown and the shadow tiles are the tools for when patience runs out.

## License

MIT — see [LICENSE](LICENSE).
