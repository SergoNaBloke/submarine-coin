const assert = require('node:assert/strict');
const core = require('../game-core.js');

assert.equal(core.terrainYAt([{x: 0, y: 100}, {x: 100, y: 200}], 50), 150);
assert.equal(core.terrainYAt([{x: 0, y: 100}, {x: 100, y: 200}], -10), 100);
assert.equal(core.terrainYAt([{x: 0, y: 100}, {x: 100, y: 200}], 120), 200);

assert.equal(core.circleHitsTerrain({x: 50, y: 130, r: 10}, [{x: 0, y: 160}, {x: 100, y: 160}]), false);
assert.equal(core.circleHitsTerrain({x: 50, y: 155, r: 10}, [{x: 0, y: 160}, {x: 100, y: 160}]), true);

assert.equal(core.circlesOverlap({x: 0, y: 0, r: 10}, {x: 15, y: 0, r: 6}), true);
assert.equal(core.circlesOverlap({x: 0, y: 0, r: 10}, {x: 30, y: 0, r: 6}), false);

assert.equal(core.nextHealth(3, -1), 2);
assert.equal(core.nextHealth(1, -3), 0);
assert.equal(core.nextHealth(2, 5), 3);
assert.equal(core.nextHealth(0, 1, 5), 1);

// Removing the elevation, opacity, or speed progression would flatten the
// decorative seabed instead of making it read as a receding 3D space.
const seabedLayers = core.createSeabedLayers(600);
assert.deepEqual(seabedLayers.map((layer) => layer.layer), ['far', 'mid', 'near']);
assert.ok(seabedLayers[0].baseY < seabedLayers[1].baseY);
assert.ok(seabedLayers[1].baseY < seabedLayers[2].baseY);
assert.ok(seabedLayers[0].opacity < seabedLayers[1].opacity);
assert.ok(seabedLayers[1].opacity < seabedLayers[2].opacity);
assert.ok(seabedLayers[0].parallax < seabedLayers[1].parallax);
assert.ok(seabedLayers[1].parallax < seabedLayers[2].parallax);

const farSeabedY = core.seabedYAt(seabedLayers[0], 0);
assert.ok(
  farSeabedY >= seabedLayers[0].baseY - seabedLayers[0].amplitude - seabedLayers[0].detailAmplitude
    && farSeabedY <= seabedLayers[0].baseY + seabedLayers[0].amplitude + seabedLayers[0].detailAmplitude,
);

// A light mask needs a continuous seabed edge slightly beyond both sides of
// the viewport, otherwise sun rays can leak into the decorative sand.
const lightMaskSurface = core.createSeabedSurfacePoints(
  { baseY: 144, amplitude: 0, detailAmplitude: 0, waveLength: 1, detailWaveLength: 1, phase: 0 },
  48,
  7,
  24,
);
assert.deepEqual(lightMaskSurface, [
  { x: -24, y: 144 },
  { x: 0, y: 144 },
  { x: 24, y: 144 },
  { x: 48, y: 144 },
  { x: 72, y: 144 },
]);

// Reusing a previous viewport's background scene would leave decorative
// seabeds and their kelp at the wrong height after an in-game resize.
const portraitScene = core.createBackgroundScene(360, 640);
assert.equal(portraitScene.seabedLayers[0].baseY, 371.2);
assert.equal(portraitScene.seabedLayers[2].baseY, 512);
assert.equal(portraitScene.backgroundPlants.length, 15);
assert.deepEqual(
  portraitScene.backgroundPlants.slice(0, 3).map((plant) => plant.parallax),
  [portraitScene.seabedLayers[0].parallax, portraitScene.seabedLayers[0].parallax, portraitScene.seabedLayers[0].parallax],
);

// Removing the depth layers or assigning foreground plants to a slower layer
// would make the underwater scene read flat or break the intended parallax.
const plants = core.createBackgroundPlants(900, 600);
assert.equal(plants.length, 15);
assert.deepEqual(
  plants.map((plant) => plant.layer),
  ['far', 'far', 'far', 'far', 'far', 'mid', 'mid', 'mid', 'mid', 'mid', 'near', 'near', 'near', 'near', 'near'],
);
assert.equal(plants[0].x, 90);
assert.equal(plants[0].parallax, seabedLayers[0].parallax);
assert.equal(plants[5].parallax, seabedLayers[1].parallax);
assert.equal(plants[10].parallax, seabedLayers[2].parallax);
assert.ok(plants.every((plant) => plant.height > 0 && plant.blades >= 3));

assert.equal(core.motionTime(3.25, false), 3.25);
assert.equal(core.motionTime(3.25, true), 0);

console.log('game-core tests passed');
