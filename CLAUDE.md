# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A clone of the classic arcade game **Asteroids**, built with plain HTML5 Canvas and vanilla JavaScript (ES6+). No frameworks, no bundler, no dependencies, no package.json. The entire game logic lives in a single file, `game.js` (~420 lines).

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
- **Entity classes** — `Bullet`, `Asteroid`, `Ship`, `Particle`. Each has its own `update(dt)` and `draw()`; entities mark themselves `dead = true` and get filtered out of their arrays each frame rather than being removed in place.
- **Game state** — module-level `let` variables (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`, `state`, `deadTimer`) rather than a state object/class. `state` is one of `'playing' | 'dead' | 'gameover'`.
- **`update(dt)` / `draw()`** — the two halves of the frame; `update` branches on `state` first (gameover/dead have short-circuit logic), otherwise runs input → physics → collision detection → level-completion check.
- **Main loop** — `requestAnimationFrame` loop passing frame delta `dt` (in seconds, clamped to 0.05 max) into `update`.

Key gameplay mechanics to know when modifying behavior:

- **Toroidal space**: all positions wrap via `wrap(v, max)` — ship, asteroids, and bullets exit one edge and re-enter the opposite one.
- **Asteroid sizes**: size `3` (large) → `2` (medium) → `1` (small), with `RADII`, `SPEEDS`, `POINTS` arrays indexed by size. `Asteroid.split()` produces two smaller asteroids at size − 1 (or none at size 1).
- **Collision detection** is plain circle-radius distance checks (`dist(a, b) < a.radius + b.radius`), done as O(n×m) nested loops over bullets/asteroids and ship/asteroids each frame — no spatial partitioning.
- **Ship invincibility**: after spawn/respawn, `ship.invincible` counts down and the ship blinks (skips drawing on alternating frames) and is immune to collisions until it reaches 0.
- **Level progression**: when `asteroids.length === 0`, `nextLevel()` fires, incrementing `level` and spawning `3 + level` new large asteroids.
- Canvas is a fixed `800×600` (`W`, `H` constants), rendered in black/white/orange line-art in the classic vector-arcade style.
