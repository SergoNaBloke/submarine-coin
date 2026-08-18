(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function terrainYAt(points, x) {
    if (!points.length) return Infinity;
    if (x <= points[0].x) return points[0].y;
    const last = points[points.length - 1];
    if (x >= last.x) return last.y;

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x || 1);
        return a.y + (b.y - a.y) * t;
      }
    }
    return last.y;
  }

  function circleHitsTerrain(circle, points) {
    const sampleXs = [circle.x - circle.r * 0.7, circle.x, circle.x + circle.r * 0.7];
    return sampleXs.some((x) => circle.y + circle.r >= terrainYAt(points, x));
  }

  function circlesOverlap(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rr = a.r + b.r;
    return dx * dx + dy * dy <= rr * rr;
  }

  function nextHealth(current, change, maximum = 3) {
    return Math.max(0, Math.min(maximum, current + change));
  }

  function hazardSpawnMinY(viewportHeight, radius, verticalRange = 0) {
    return viewportHeight * 0.3 + radius * 1.2 + verticalRange;
  }

  function coinSpawnDistance(random = Math.random, initial = false) {
    return initial ? 360 : 420 + random() * 340;
  }

  function createSeabedLayers(height) {
    return [
      {
        layer: 'far',
        baseY: height * 0.58,
        amplitude: height * 0.018,
        detailAmplitude: height * 0.006,
        waveLength: 290,
        detailWaveLength: 94,
        phase: 0.8,
        parallax: 0.16,
        opacity: 0.2,
        heightScale: 0.24,
      },
      {
        layer: 'mid',
        baseY: height * 0.69,
        amplitude: height * 0.027,
        detailAmplitude: height * 0.009,
        waveLength: 245,
        detailWaveLength: 82,
        phase: 1.7,
        parallax: 0.34,
        opacity: 0.38,
        heightScale: 0.34,
      },
      {
        layer: 'near',
        baseY: height * 0.8,
        amplitude: height * 0.036,
        detailAmplitude: height * 0.012,
        waveLength: 205,
        detailWaveLength: 70,
        phase: 2.6,
        parallax: 0.58,
        opacity: 0.58,
        heightScale: 0.46,
      },
    ];
  }

  function seabedYAt(layer, x) {
    return layer.baseY
      + Math.sin(x / layer.waveLength + layer.phase) * layer.amplitude
      + Math.sin(x / layer.detailWaveLength + layer.phase * 1.7) * layer.detailAmplitude;
  }

  function createSeabedSurfacePoints(layer, width, scroll = 0, step = 24) {
    const startX = -step;
    const endX = width + step;
    const points = [];

    for (let x = startX; x < endX; x += step) {
      points.push({ x, y: seabedYAt(layer, x + scroll) });
    }
    points.push({ x: endX, y: seabedYAt(layer, endX + scroll) });
    return points;
  }

  function createBackgroundPlants(width, height, layers = createSeabedLayers(height)) {
    const plants = [];
    const decorationTypes = ['kelp', 'coral', 'seaFan', 'sprig', 'bush'];
    const heightScales = [0.85, 0.58, 0.72, 0.66, 0.46];
    const spreadScales = [0.4, 0.62, 0.78, 0.5, 0.58];
    const bladeCounts = [5, 4, 6, 5, 5];

    for (const config of layers) {
      for (let index = 0; index < 5; index += 1) {
        const type = decorationTypes[index];
        const plantHeight = height * (config.heightScale * heightScales[index]);
        plants.push({
          layer: config.layer,
          type,
          x: width * (0.1 + index * 0.2),
          height: plantHeight,
          spread: plantHeight * spreadScales[index],
          blades: bladeCounts[index],
          parallax: config.parallax,
          phase: index * 0.92 + config.parallax * 9,
        });
      }
    }
    return plants;
  }

  function createRepeatingBackgroundPositions(x, scroll, width, overflow = 0) {
    if (width <= 0) return [];

    const visibleOverflow = Math.max(0, overflow);
    const firstRepeat = Math.ceil((scroll - x - visibleOverflow) / width);
    const lastRepeat = Math.floor((scroll - x + width + visibleOverflow) / width);
    const positions = [];

    for (let repeat = firstRepeat; repeat <= lastRepeat; repeat += 1) {
      const worldX = x + repeat * width;
      positions.push({ x: worldX - scroll, worldX });
    }
    return positions;
  }

  function createBackgroundScene(width, height) {
    const seabedLayers = createSeabedLayers(height);
    return {
      seabedLayers,
      backgroundPlants: createBackgroundPlants(width, height, seabedLayers),
    };
  }

  function motionTime(time, reduceMotion) {
    return reduceMotion ? 0 : time;
  }

  return {
    terrainYAt,
    circleHitsTerrain,
    circlesOverlap,
    nextHealth,
    hazardSpawnMinY,
    coinSpawnDistance,
    createSeabedLayers,
    seabedYAt,
    createSeabedSurfacePoints,
    createBackgroundPlants,
    createRepeatingBackgroundPositions,
    createBackgroundScene,
    motionTime,
  };
});
