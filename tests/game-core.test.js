const assert = require('node:assert/strict');
const core = require('../game-core.js');

assert.equal(core.terrainYAt([{x: 0, y: 100}, {x: 100, y: 200}], 50), 150);
assert.equal(core.terrainYAt([{x: 0, y: 100}, {x: 100, y: 200}], -10), 100);
assert.equal(core.terrainYAt([{x: 0, y: 100}, {x: 100, y: 200}], 120), 200);

assert.equal(core.circleHitsTerrain({x: 50, y: 130, r: 10}, [{x: 0, y: 160}, {x: 100, y: 160}]), false);
assert.equal(core.circleHitsTerrain({x: 50, y: 155, r: 10}, [{x: 0, y: 160}, {x: 100, y: 160}]), true);

assert.equal(core.circlesOverlap({x: 0, y: 0, r: 10}, {x: 15, y: 0, r: 6}), true);
assert.equal(core.circlesOverlap({x: 0, y: 0, r: 10}, {x: 30, y: 0, r: 6}), false);

console.log('game-core tests passed');
