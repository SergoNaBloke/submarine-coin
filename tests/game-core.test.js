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

// A vertically moving monster must keep its full body below the upper 30% of
// the viewport; otherwise hazards can appear too high in the water column.
const hazardMinY = core.hazardSpawnMinY(600, 50, 45);
assert.equal(hazardMinY, 285);
assert.ok(hazardMinY - 45 - 50 * 1.2 >= 180);

// Doubling the distance between batches halves the number of coins encountered
// over the same stretch of the level without changing the batch composition.
assert.equal(core.coinSpawnDistance(() => 0, true), 360);
assert.equal(core.coinSpawnDistance(() => 0), 420);
assert.equal(core.coinSpawnDistance(() => 1), 760);

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

// Kelp should take a little less space in the playfield while the other
// underwater decoration keeps its established scale.
const kelpPlants = plants.filter((plant) => plant.type === 'kelp');
assert.deepEqual(
  kelpPlants.map((plant) => ({
    height: Math.round(plant.height * 10),
    spread: Math.round(plant.spread * 10),
  })),
  [
    { height: 1224, spread: 490 },
    { height: 1734, spread: 694 },
    { height: 2346, spread: 938 },
  ],
);
assert.equal(plants.find((plant) => plant.type === 'coral').height, 83.52);

// Every depth layer needs a readable mix of silhouettes. Otherwise the scene
// regresses to one repeated kelp shape even when its colour or size changes.
const decorationTypes = ['bush', 'coral', 'kelp', 'seaFan', 'sprig'];
for (const layerName of ['far', 'mid', 'near']) {
  const layerDecorations = plants.filter((plant) => plant.layer === layerName);
  assert.deepEqual(
    layerDecorations.map((plant) => plant.type).sort(),
    decorationTypes,
  );
}
assert.ok(plants.every((plant) => plant.spread > 0));

// A wide decoration must keep its outgoing copy until its visual edge leaves
// the viewport, while its next repeat enters from the opposite edge smoothly.
assert.deepEqual(
  core.createRepeatingBackgroundPositions(64, 65, 640, 40),
  [
    { x: -1, worldX: 64 },
    { x: 639, worldX: 704 },
  ],
);
assert.deepEqual(
  core.createRepeatingBackgroundPositions(64, 105, 640, 40),
  [{ x: 599, worldX: 704 }],
);
assert.deepEqual(
  core.createRepeatingBackgroundPositions(64, 1345, 640, 40),
  [
    { x: -1, worldX: 1344 },
    { x: 639, worldX: 1984 },
  ],
);

assert.equal(core.motionTime(3.25, false), 3.25);
assert.equal(core.motionTime(3.25, true), 0);

console.log('game-core tests passed');
