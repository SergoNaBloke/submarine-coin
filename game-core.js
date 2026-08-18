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

  return { terrainYAt, circleHitsTerrain, circlesOverlap, nextHealth };
});
