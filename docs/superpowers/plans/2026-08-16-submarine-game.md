# Submarine Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive browser submarine game where the player rises while holding Space/W/ArrowUp or touching the screen, falls under gravity, collects coins, and avoids procedurally scrolling seabed terrain.

**Architecture:** Use a full-screen HTML5 Canvas for rendering and a small pure-JavaScript core module for collision/interpolation logic. `game.js` owns input, physics, procedural terrain, coins, rendering, scoring, game-over and restart; `game-core.js` exposes deterministic helpers that can be tested with Node.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Canvas 2D API, Node built-in assertions for tests. No libraries.

## Global Constraints

- Pure HTML/CSS/JavaScript only.
- Canvas-based rendering.
- Keyboard rise controls: Space, ArrowUp, W.
- Touch/pointer hold rises; release falls under gravity.
- Coin counter appears top-left.
- Curved/winding scrolling seabed and collision with it.
- Responsive desktop/mobile layout.

---

### Task 1: Core geometry helpers
**Files:** Create `game-core.js`; Create `tests/game-core.test.js`.
**Interfaces:** Produces `terrainYAt(points, x)`, `circleHitsTerrain(circle, points)`, `circlesOverlap(a, b)`.
- [ ] Write failing tests for interpolation, terrain collision and coin overlap.
- [ ] Run tests and verify they fail because helpers are absent.
- [ ] Implement minimal helpers.
- [ ] Run tests and verify they pass.

### Task 2: Browser shell and rendering
**Files:** Create `index.html`, `style.css`, `game.js`.
**Interfaces:** Consumes `GameCore` helpers from `game-core.js`.
- [ ] Add full-screen Canvas and HUD.
- [ ] Implement fixed-X submarine physics with gravity and rise thrust.
- [ ] Add keyboard and pointer/touch hold input.
- [ ] Generate and scroll smoothed seabed terrain.
- [ ] Spawn collectible coins along safe paths and increment score.
- [ ] Detect terrain collision, show game-over overlay, and restart on input.
- [ ] Scale Canvas for device pixel ratio and viewport resize.

### Task 3: Verification
**Files:** All project files.
- [ ] Run Node tests.
- [ ] Run JavaScript syntax checks.
- [ ] Confirm project can be served as static files with no dependencies.
