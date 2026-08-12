# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A clone of the classic arcade game **Asteroids**, built with plain HTML5 Canvas and vanilla JavaScript (ES6+). No frameworks, no bundler, no dependencies, no package.json. All the game logic lives in a single file, `game.js`; `touch.js` adds the on-screen gamepad for phones and tablets.

## Running the game

Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
```

There is no build step, linter, or test suite configured in this repo — changes to `game.js` take effect on page reload.

## Architecture

Everything is in `game.js`, organized top-to-bottom into these sections (marked by `// ──` comment headers):

- **Input** — `keys` (held state) and `justPressed` (edge-triggered, consumed via `pressed(code)`) are populated from `keydown`/`keyup` listeners.
- **Utils** — `wrap` (toroidal position wrapping), `dist`, `rand`, `randInt`.
- **Entity classes** — `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`. Each has its own `update(dt)` and `draw()`; entities mark themselves `dead = true` and get filtered out of their arrays each frame rather than being removed in place.
- **Game state** — module-level `let` variables (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `paused`) rather than a state object/class. `state` is one of `'playing' | 'dead' | 'gameover'`; `paused` short-circuits `update()` and is only ever set by `touch.js`.
- **`update(dt)` / `draw()`** — the two halves of the frame; `update` branches on `state` first (gameover/dead have short-circuit logic), otherwise runs input → physics → collision detection → level-completion check.
- **Main loop** — `requestAnimationFrame` loop passing frame delta `dt` (in seconds, clamped to 0.05 max) into `update`.

Key gameplay mechanics to know when modifying behavior:

- **Toroidal space**: all positions wrap via `wrap(v, max)` — ship, asteroids, and bullets exit one edge and re-enter the opposite one.
- **Asteroid sizes**: size `3` (large) → `2` (medium) → `1` (small), with `RADII`, `SPEEDS`, `POINTS` arrays indexed by size. `Asteroid.split()` produces two smaller asteroids at size − 1 (or none at size 1).
- **Collision detection** is plain circle-radius distance checks (`dist(a, b) < a.radius + b.radius`), done as O(n×m) nested loops over bullets/asteroids and ship/asteroids each frame — no spatial partitioning.
- **Ship invincibility**: after spawn/respawn, `ship.invincible` counts down and the ship blinks (skips drawing on alternating frames) and is immune to collisions until it reaches 0.
- **Level progression**: when `asteroids.length === 0`, `nextLevel()` fires, incrementing `level` and spawning `3 + level` new large asteroids.
- **Power-ups**: all four types share one `PowerUp` class (`type` field: `'triple' | 'shield' | 'hyper' | 'nova'`), one drifting-diamond/circle/triangle blinking pickup shape (style per type in `POWERUP_STYLES`), and one `powerUps` array/collection loop. `spawnPowerUp(x, y, type)` is called from the bullet-vs-asteroid collision handler, gated so at most one pickup drifts on screen at a time (`powerUps.length === 0`) and each type rolls its own chance (`TRIPLE_SHOT_CHANCE`, `SHIELD_CHANCE`, `HYPER_CHANCE`, `NOVA_BOMB_CHANCE`) in priority order. The ship must fly into a pickup to collect it; what happens on pickup differs per type:
  - **Triple Shot**: `activateTripleShot()` sets `tripleShotActive` for `TRIPLE_SHOT_DURATION`s, during which `Ship.tryShoot()` fires 3 fanned bullets instead of 1. Guaranteed at least once per level — if a level empties out without one having spawned, it's forced (`tripleShotSpawnedThisLevel`, reset in `nextLevel()`/`initGame()`).
  - **Escudo Temporal (Shield)**: `activateShield()` sets `shieldActive` for `SHIELD_DURATION`s (drawn as a green ring around the ship). The next asteroid that would hit the ship is destroyed instead (scored, exploded, split) and the shield is consumed immediately, whichever comes first.
  - **Hiperpropulsión (Hyperspeed)**: `activateHyperSpeed()` sets `hyperSpeedActive` for `HYPER_DURATION`s; `Ship.update()` swaps in a higher thrust (`HYPER_THRUST_MULT`) and lower drag (`HYPER_DRAG`) while active.
  - **Bomba Nova**: rarest drop (`NOVA_BOMB_CHANCE`); picking it up increments the `novaBombs` inventory count instead of auto-activating. Pressing `B` (`triggerNovaBomb()`) while `novaBombs > 0` instantly scores and destroys every asteroid on screen (no splitting) and consumes one bomb.
  Uncollected pickups persist across level transitions.
- **Playfield size**: `W`/`H` are *variables*, not constants — `resizeCanvas()` recomputes them from the canvas's CSS size (and scales the backing store by `devicePixelRatio`, so all drawing stays in logical px). On desktop the CSS pins the canvas to `800×600`, so the field is the classic one; in touch mode the canvas fills the screen and the field grows with it. Everything already reads `W`/`H` at call time, so nothing else needs to know. `draw()` outlines the field with a white `strokeRect`, which is exactly the `wrap()` boundary.
- **HUD** lives entirely in the top band, so the touch controls at the bottom never cover it: title `ASTEROID DIEGO` centered, `SCORE`/`NIVEL`/`BOMBAS NOVA` stacked at the left, lives at the right, active power-up timers stacked under the title.
- **Touch controls** (`touch.js`, loaded after `game.js`): activates only on touch devices (`(hover: none) and (pointer: coarse)`, overridable with `?touch=1` / `?touch=0`), adding the class `touch` to `<html>` — every mobile-only style in `index.html` hangs off that class, so desktop is untouched. Its only contract with the game is writing into `keys` / `justPressed` with the same `KeyboardEvent.code` values the keyboard uses (`data-key` attribute per button), so no game logic is touch-aware. D-pad at the bottom left (`◀ ▶` turn, `▲` thrusts, bomb button appears only when `novaBombs > 0`), fire button at the bottom right (auto-repeats while held; `shootCooldown` still caps the rate). Portrait orientation shows a "rotate the device" notice and sets `paused`; the real game is initialized on the first landscape layout, since a hidden canvas has no measurable size.
- Rendered in black/white/orange line-art in the classic vector-arcade style.
