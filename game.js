(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const coinCountEl = document.getElementById('coinCount');
  const overlay = document.getElementById('overlay');
  const finalScoreEl = document.getElementById('finalScore');
  const startHint = document.getElementById('startHint');
  const restartButton = document.getElementById('restartButton');
  const livesEl = document.getElementById('lives');
  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');

  const KEY_SET = new Set(['Space', 'ArrowUp', 'KeyW']);
  const HAZARD_MOTIONS = ['stationary', 'vertical', 'horizontal'];
  const state = {
    width: innerWidth,
    height: innerHeight,
    dpr: Math.min(devicePixelRatio || 1, 2),
    pressing: false,
    started: false,
    gameOver: false,
    score: 0,
    speed: 220,
    terrain: [],
    seabedLayers: [],
    backgroundPlants: [],
    coins: [],
    hazards: [],
    medkits: [],
    terrainCursorY: 0,
    terrainTargetY: 0,
    coinDistance: 0,
    hazardDistance: 500,
    hazardPatternIndex: 0,
    medkitDistance: 1500,
    time: 0,
    damageFlash: 0,
    invulnerableFor: 0,
    health: 3,
    maxHealth: 3,
    reducedMotion: reducedMotionQuery.matches,
    submarine: { x: 0, y: 0, vy: 0, r: 24 },
  };

  function resize() {
    state.width = innerWidth;
    state.height = innerHeight;
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.submarine.x = Math.max(120, state.width * 0.3);
    state.submarine.r = Math.max(18, Math.min(28, state.width * 0.022));

    if (state.started || state.gameOver) refreshBackgroundScene();
    if (!state.started && !state.gameOver) resetWorld(false);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function refreshBackgroundScene() {
    const scene = GameCore.createBackgroundScene(state.width, state.height);
    state.seabedLayers = scene.seabedLayers;
    state.backgroundPlants = scene.backgroundPlants;
  }

  function resetWorld(resetScore = true) {
    if (resetScore) state.score = 0;
    state.gameOver = false;
    state.pressing = false;
    state.time = 0;
    state.speed = clamp(state.width * 0.18, 180, 290);
    state.submarine.y = state.height * 0.46;
    state.submarine.vy = 0;
    state.terrain.length = 0;
    refreshBackgroundScene();
    state.coins.length = 0;
    state.hazards.length = 0;
    state.medkits.length = 0;
    state.terrainCursorY = state.height * 0.78;
    state.terrainTargetY = state.terrainCursorY;
    state.coinDistance = GameCore.coinSpawnDistance(Math.random, true);
    state.hazardDistance = rand(560, 820);
    state.hazardPatternIndex = 0;
    state.medkitDistance = rand(1300, 1900);
    state.health = state.maxHealth;
    state.damageFlash = 0;
    state.invulnerableFor = 0;

    const step = 32;
    for (let x = -step; x <= state.width + 360; x += step) {
      appendTerrainPoint(x, step);
    }

    updateHud();
    overlay.classList.add('hidden');
  }

  function appendTerrainPoint(x, step = 32) {
    const minY = state.height * 0.54;
    const maxY = state.height * 0.9;

    if (Math.random() < 0.11) {
      state.terrainTargetY = rand(minY, maxY);
    }
    const pull = (state.terrainTargetY - state.terrainCursorY) * 0.11;
    const wave = Math.sin((x + state.time * 80) * 0.012) * 4;
    state.terrainCursorY = clamp(state.terrainCursorY + pull + rand(-5, 5) + wave, minY, maxY);
    state.terrain.push({ x, y: state.terrainCursorY });
  }

  function spawnCoin(x) {
    const floorY = GameCore.terrainYAt(state.terrain, x);
    const minY = Math.max(90, floorY - rand(185, 270));
    const maxY = Math.max(minY + 20, floorY - 70);
    const y = clamp(rand(minY, maxY), 88, state.height - 95);
    state.coins.push({ x, y, r: Math.max(11, Math.min(16, state.width * 0.012)), collected: false });
  }

  function safeSpawnY(x, clearance, minY = 85 + clearance) {
    const floorY = GameCore.terrainYAt(state.terrain, x);
    const maxY = Math.max(minY, floorY - clearance);
    return clamp(rand(minY, maxY), minY, state.height - clearance - 30);
  }

  function spawnHazard(x) {
    const squid = Math.random() < 0.46;
    const r = squid ? clamp(state.width * 0.05, 42, 62) : clamp(state.width * 0.04, 32, 48);
    const motion = HAZARD_MOTIONS[state.hazardPatternIndex];
    state.hazardPatternIndex = (state.hazardPatternIndex + 1) % HAZARD_MOTIONS.length;
    const verticalRange = motion === 'vertical' ? clamp(state.height * 0.075, 28, 65) : 0;
    const horizontalRange = motion === 'horizontal' ? clamp(state.width * 0.075, 30, 72) : 0;
    const clearance = r + 82 + verticalRange;
    const baseY = safeSpawnY(
      x,
      clearance,
      GameCore.hazardSpawnMinY(state.height, r, verticalRange),
    );
    state.hazards.push({
      x,
      baseX: x,
      y: baseY,
      baseY,
      r,
      // Damage follows the tentacles, not the empty area above the creature's head.
      damageRadius: r * (squid ? 1.35 : 1.2),
      damageOffsetY: r * (squid ? 0.3 : 0.36),
      type: squid ? 'squid' : 'jellyfish',
      motion,
      phase: Math.random() * Math.PI * 2,
      verticalRange,
      horizontalRange,
      motionSpeed: rand(1.1, 1.8),
    });
  }

  function spawnMedkit(x) {
    const r = clamp(state.width * 0.017, 15, 21);
    state.medkits.push({ x, y: safeSpawnY(x, r + 45), r, phase: Math.random() * Math.PI * 2 });
  }

  function updateHud() {
    coinCountEl.textContent = String(state.score).padStart(2, '0');
    livesEl.innerHTML = Array.from({ length: state.maxHealth }, (_, index) =>
      `<span class="heart ${index < state.health ? '' : 'empty'}" aria-hidden="true">♥</span>`).join('');
    livesEl.setAttribute('aria-label', `${state.health} of ${state.maxHealth} lives remaining`);
  }

  function beginInput() {
    if (state.gameOver) {
      state.started = true;
      resetWorld(true);
    }
    state.started = true;
    state.pressing = true;
    startHint.classList.add('hidden');
  }

  function restartGame() {
    state.started = false;
    resetWorld(true);
    startHint.classList.remove('hidden');
  }

  function endInput() {
    state.pressing = false;
  }

  addEventListener('keydown', (e) => {
    if (!KEY_SET.has(e.code)) return;
    e.preventDefault();
    beginInput();
  });
  addEventListener('keyup', (e) => {
    if (!KEY_SET.has(e.code)) return;
    e.preventDefault();
    endInput();
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    beginInput();
  });
  canvas.addEventListener('pointerup', endInput);
  canvas.addEventListener('pointercancel', endInput);
  restartButton.addEventListener('click', restartGame);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) restartGame();
  });
  addEventListener('blur', endInput);
  addEventListener('resize', resize);
  reducedMotionQuery.addEventListener?.('change', (event) => {
    state.reducedMotion = event.matches;
  });

  function update(dt) {
    if (!state.started || state.gameOver) return;

    state.time += dt;
    state.damageFlash = Math.max(0, state.damageFlash - dt * 2.8);
    state.invulnerableFor = Math.max(0, state.invulnerableFor - dt);
    const sub = state.submarine;
    const gravity = clamp(state.height * 0.8, 620, 1040);
    const lift = clamp(state.height * 2.7, 1300, 2200);
    const descentBrake = clamp(state.height * 1.8, 1100, 1650);
    const maxRise = -clamp(state.height * 0.56, 330, 560);
    const maxFall = clamp(state.height * 0.65, 370, 650);

    sub.vy += gravity * dt;
    if (state.pressing) {
      sub.vy -= lift * dt;
      // A falling submarine gets extra braking thrust, so touch input remains responsive.
      if (sub.vy > 0) sub.vy -= descentBrake * dt;
    }
    sub.vy = clamp(sub.vy, maxRise, maxFall);
    sub.y += sub.vy * dt;

    if (sub.y - sub.r < 0) {
      sub.y = sub.r;
      sub.vy = Math.max(0, sub.vy * 0.25);
    }

    const dx = state.speed * dt;
    for (const p of state.terrain) p.x -= dx;
    for (const c of state.coins) c.x -= dx;
    for (const hazard of state.hazards) {
      hazard.baseX -= dx;
      const motionOffset = Math.sin(state.time * hazard.motionSpeed + hazard.phase);
      hazard.x = hazard.baseX + (hazard.motion === 'horizontal' ? motionOffset * hazard.horizontalRange : 0);
      hazard.y = hazard.baseY + (hazard.motion === 'vertical' ? motionOffset * hazard.verticalRange : 0);
    }
    for (const medkit of state.medkits) medkit.x -= dx;

    while (state.terrain.length && state.terrain[1]?.x < -45) state.terrain.shift();
    while (state.terrain[state.terrain.length - 1].x < state.width + 340) {
      const lastX = state.terrain[state.terrain.length - 1].x;
      appendTerrainPoint(lastX + 32, 32);
    }

    state.coinDistance -= dx;
    if (state.coinDistance <= 0) {
      const batch = Math.random() < 0.55 ? 3 : 1;
      for (let i = 0; i < batch; i += 1) spawnCoin(state.width + 80 + i * 55);
      state.coinDistance = GameCore.coinSpawnDistance(Math.random);
    }

    state.hazardDistance -= dx;
    if (state.hazardDistance <= 0) {
      spawnHazard(state.width + rand(100, 180));
      state.hazardDistance = rand(520, 860);
    }

    state.medkitDistance -= dx;
    if (state.medkitDistance <= 0) {
      if (state.health < state.maxHealth) spawnMedkit(state.width + rand(100, 170));
      state.medkitDistance = rand(1400, 2300);
    }

    // One generous shared hitbox keeps collecting and taking damage consistent.
    const subCircle = { x: sub.x, y: sub.y, r: sub.r * 1.1 };
    for (const coin of state.coins) {
      if (!coin.collected && GameCore.circlesOverlap(subCircle, coin)) {
        coin.collected = true;
        state.score += 1;
        updateHud();
      }
    }
    state.coins = state.coins.filter((coin) => !coin.collected && coin.x > -40);

    for (const medkit of state.medkits) {
      if (GameCore.circlesOverlap(subCircle, { ...medkit, r: medkit.r * 1.15 })) {
        state.health = GameCore.nextHealth(state.health, 1, state.maxHealth);
        medkit.collected = true;
        updateHud();
      }
    }
    state.medkits = state.medkits.filter((medkit) => !medkit.collected && medkit.x > -60);

    if (!state.invulnerableFor) {
      const hitHazard = state.hazards.find((hazard) =>
        GameCore.circlesOverlap(subCircle, {
          x: hazard.x,
          y: hazard.y + hazard.damageOffsetY,
          r: hazard.damageRadius,
        }));
      if (hitHazard) damageSubmarine();
    }
    state.hazards = state.hazards.filter((hazard) =>
      hazard.baseX > -hazard.r * 2 - hazard.horizontalRange);

    if (GameCore.circleHitsTerrain(subCircle, state.terrain)) endGame();
  }

  function damageSubmarine() {
    state.health = GameCore.nextHealth(state.health, -1, state.maxHealth);
    state.damageFlash = 1;
    state.invulnerableFor = 1.15;
    updateHud();
    if (state.health === 0) endGame();
  }

  function endGame() {
    state.gameOver = true;
    state.pressing = false;
    finalScoreEl.textContent = String(state.score);
    overlay.classList.remove('hidden');
  }

  function drawBackground() {
    const motionTime = GameCore.motionTime(state.time, state.reducedMotion);
    const g = ctx.createLinearGradient(0, 0, 0, state.height);
    g.addColorStop(0, '#88c8e5');
    g.addColorStop(0.4, '#367da8');
    g.addColorStop(1, '#103e69');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.width, state.height);

    const deepGlow = ctx.createRadialGradient(
      state.width * 0.5, state.height * 0.05, 0,
      state.width * 0.5, state.height * 0.05, state.height * 0.9,
    );
    deepGlow.addColorStop(0, 'rgba(216, 249, 255, 0.23)');
    deepGlow.addColorStop(0.55, 'rgba(24, 104, 144, 0.02)');
    deepGlow.addColorStop(1, 'rgba(3, 29, 65, 0.38)');
    ctx.fillStyle = deepGlow;
    ctx.fillRect(0, 0, state.width, state.height);

    drawLightRays(motionTime);

    drawSeabedLayer('far', motionTime);
    drawDecorationLayer('far', motionTime);
    drawSeabedLayer('mid', motionTime);
    drawDecorationLayer('mid', motionTime);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 220 - motionTime * (10 + i * 2)) % (state.width + 260)) - 100;
      const y = 74 + (i % 4) * 96;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawSeabedLayer('near', motionTime);
    drawDecorationLayer('near', motionTime);
  }

  function drawLightRays(motionTime) {
    const farLayer = state.seabedLayers.find((item) => item.layer === 'far');
    if (!farLayer) return;

    const scroll = motionTime * state.speed * farLayer.parallax;
    const seabedSurface = GameCore.createSeabedSurfacePoints(farLayer, state.width, scroll);
    const firstPoint = seabedSurface[0];
    const lastPoint = seabedSurface[seabedSurface.length - 1];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, 0);
    ctx.lineTo(lastPoint.x, 0);
    for (let index = seabedSurface.length - 1; index >= 0; index -= 1) {
      const point = seabedSurface[index];
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.clip();

    ctx.globalAlpha = 0.075;
    ctx.fillStyle = '#e5fbff';
    for (let i = 0; i < 5; i += 1) {
      const startX = ((i * 260 + motionTime * 9) % (state.width + 300)) - 150;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + state.width * 0.14, 0);
      ctx.lineTo(startX + state.width * 0.39, state.height);
      ctx.lineTo(startX + state.width * 0.21, state.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSeabedLayer(layerName, motionTime) {
    const layer = state.seabedLayers.find((item) => item.layer === layerName);
    if (!layer) return;

    const palette = {
      far: { top: '#d4deb7', bottom: '#789480', ridge: '#edf2cd' },
      mid: { top: '#d8c989', bottom: '#8f7547', ridge: '#f0dfa1' },
      near: { top: '#e2c97d', bottom: '#8a6238', ridge: '#f4d98d' },
    }[layerName];
    const scroll = motionTime * state.speed * layer.parallax;
    const seabedSurface = GameCore.createSeabedSurfacePoints(layer, state.width, scroll);
    const firstPoint = seabedSurface[0];
    const lastPoint = seabedSurface[seabedSurface.length - 1];
    const topY = Math.max(0, layer.baseY - layer.amplitude * 2);

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    const sand = ctx.createLinearGradient(0, topY, 0, state.height);
    sand.addColorStop(0, palette.top);
    sand.addColorStop(1, palette.bottom);
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, state.height + 8);
    for (const point of seabedSurface) ctx.lineTo(point.x, point.y);
    ctx.lineTo(lastPoint.x, state.height + 8);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = layer.opacity * 0.82;
    ctx.strokeStyle = palette.ridge;
    ctx.lineWidth = Math.max(1.4, state.height * 0.003);
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);
    for (let index = 1; index < seabedSurface.length; index += 1) {
      const point = seabedSurface[index];
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawDecorationLayer(layer, motionTime) {
    const palette = {
      far: {
        colors: { kelp: '#2c7a77', coral: '#317d75', seaFan: '#358682', sprig: '#3b8572', bush: '#2e766e' },
        shadow: '#0b3e59',
        width: 2.2,
        alpha: 0.31,
      },
      mid: {
        colors: { kelp: '#1b8a70', coral: '#4f9974', seaFan: '#238d83', sprig: '#5b9870', bush: '#347f6d' },
        shadow: '#0c4b55',
        width: 3.2,
        alpha: 0.52,
      },
      near: {
        colors: { kelp: '#22a06d', coral: '#69a86b', seaFan: '#20a293', sprig: '#79b75e', bush: '#2f9275' },
        shadow: '#0a4a44',
        width: 4.6,
        alpha: 0.79,
      },
    }[layer];
    const seabedLayer = state.seabedLayers.find((item) => item.layer === layer);
    if (!seabedLayer) return;

    ctx.save();
    ctx.globalAlpha = palette.alpha;
    for (const plant of state.backgroundPlants) {
      if (plant.layer !== layer) continue;
      drawBackgroundDecoration(plant, palette, seabedLayer, motionTime);
    }
    ctx.restore();
  }

  function drawBackgroundDecoration(plant, palette, seabedLayer, motionTime) {
    const scroll = motionTime * state.speed * plant.parallax;
    const sway = Math.sin(motionTime * 1.25 + plant.phase) * plant.height * 0.085;
    const overflow = plant.spread * 0.62 + plant.height * 0.11 + palette.width * 2;

    for (const position of GameCore.createRepeatingBackgroundPositions(
      plant.x,
      scroll,
      state.width,
      overflow,
    )) {
      const baseY = GameCore.seabedYAt(seabedLayer, position.worldX);
      ctx.save();
      ctx.translate(position.x, baseY + 4);
      ctx.fillStyle = palette.colors[plant.type] || palette.colors.kelp;
      ctx.strokeStyle = palette.shadow;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (plant.type === 'coral') drawBranchingCoral(plant, palette, sway);
      else if (plant.type === 'seaFan') drawSeaFan(plant, palette, sway);
      else if (plant.type === 'sprig') drawLeafySprig(plant, palette, sway);
      else if (plant.type === 'bush') drawBubbleBush(plant, palette, sway);
      else drawKelpFronds(plant, sway);
      ctx.restore();
    }
  }

  function drawKelpFronds(plant, sway) {
    const bladeWidth = Math.max(4, plant.spread / (plant.blades * 1.55));
    for (let blade = 0; blade < plant.blades; blade += 1) {
      const ratio = plant.blades === 1 ? 0 : blade / (plant.blades - 1) - 0.5;
      const baseX = ratio * plant.spread * 0.32;
      const tipX = baseX + ratio * plant.spread * 0.26 + sway;
      ctx.beginPath();
      ctx.moveTo(baseX - bladeWidth * 0.46, 0);
      ctx.bezierCurveTo(
        baseX - bladeWidth * 0.6 + sway * 0.16,
        -plant.height * 0.34,
        tipX - bladeWidth * 0.42,
        -plant.height * 0.93,
        tipX,
        -plant.height,
      );
      ctx.bezierCurveTo(
        tipX + bladeWidth * 0.42,
        -plant.height * 0.93,
        baseX + bladeWidth * 0.6 + sway * 0.24,
        -plant.height * 0.34,
        baseX + bladeWidth * 0.46,
        0,
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBranchingCoral(plant, palette, sway) {
    const strokeBranch = (color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sway * 0.2, -plant.height * 0.4, sway * 0.34, -plant.height * 0.88);
      ctx.moveTo(sway * 0.04, -plant.height * 0.22);
      ctx.quadraticCurveTo(-plant.spread * 0.14, -plant.height * 0.5, -plant.spread * 0.46 + sway * 0.35, -plant.height * 0.62);
      ctx.moveTo(sway * 0.14, -plant.height * 0.37);
      ctx.quadraticCurveTo(plant.spread * 0.16, -plant.height * 0.57, plant.spread * 0.42 + sway * 0.5, -plant.height * 0.76);
      ctx.moveTo(sway * 0.22, -plant.height * 0.58);
      ctx.quadraticCurveTo(-plant.spread * 0.14, -plant.height * 0.72, -plant.spread * 0.34 + sway * 0.55, -plant.height * 0.92);
      ctx.moveTo(sway * 0.3, -plant.height * 0.7);
      ctx.quadraticCurveTo(plant.spread * 0.13, -plant.height * 0.83, plant.spread * 0.27 + sway * 0.6, -plant.height);
      ctx.stroke();
    };

    strokeBranch(palette.shadow, palette.width + 2);
    strokeBranch(ctx.fillStyle, palette.width);
  }

  function drawSeaFan(plant, palette, sway) {
    const strokeFan = (color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (let branch = 0; branch < plant.blades; branch += 1) {
        const ratio = plant.blades === 1 ? 0 : branch / (plant.blades - 1) - 0.5;
        const tipX = ratio * plant.spread * 0.68 + sway * (0.55 + Math.abs(ratio));
        const tipY = -plant.height * (0.76 - Math.abs(ratio) * 0.22);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(ratio * plant.spread * 0.2 + sway * 0.26, -plant.height * 0.46, tipX, tipY);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-plant.spread * 0.42 + sway * 0.36, -plant.height * 0.48);
      ctx.quadraticCurveTo(sway * 0.42, -plant.height * 0.65, plant.spread * 0.43 + sway * 0.5, -plant.height * 0.54);
      ctx.stroke();
    };

    strokeFan(palette.shadow, palette.width + 1.8);
    strokeFan(ctx.fillStyle, palette.width);
  }

  function drawLeafySprig(plant, palette, sway) {
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = palette.width + 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.24, -plant.height * 0.46, sway * 0.48, -plant.height);
    ctx.stroke();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = palette.width;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.24, -plant.height * 0.46, sway * 0.48, -plant.height);
    ctx.stroke();

    const leafWidth = Math.max(4, plant.spread * 0.18);
    const leafHeight = Math.max(8, plant.height * 0.15);
    for (let leaf = 0; leaf < plant.blades; leaf += 1) {
      const side = leaf % 2 === 0 ? -1 : 1;
      const progress = 0.2 + leaf * 0.15;
      const x = sway * progress + side * plant.spread * (0.22 + (leaf % 3) * 0.045);
      const y = -plant.height * progress;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * (0.72 - leaf * 0.045));
      ctx.beginPath();
      ctx.ellipse(0, 0, leafWidth, leafHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBubbleBush(plant, palette, sway) {
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = palette.width + 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.16, -plant.height * 0.4, -plant.spread * 0.2 + sway * 0.42, -plant.height * 0.74);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.3, -plant.height * 0.45, plant.spread * 0.22 + sway * 0.58, -plant.height * 0.84);
    ctx.stroke();

    const clusters = [
      [-0.23, -0.38, 0.2], [0.04, -0.52, 0.24], [0.28, -0.46, 0.18],
      [-0.32, -0.66, 0.16], [0.02, -0.75, 0.22], [0.32, -0.75, 0.15],
      [-0.1, -0.93, 0.14], [0.22, -0.96, 0.13],
    ];
    for (const [xRatio, yRatio, size] of clusters) {
      ctx.beginPath();
      ctx.arc(
        xRatio * plant.spread + sway * (0.45 + yRatio * -0.18),
        yRatio * plant.height,
        Math.max(3, plant.spread * size),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  function drawTerrain() {
    if (state.terrain.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(state.terrain[0].x, state.height + 10);
    ctx.lineTo(state.terrain[0].x, state.terrain[0].y);
    for (let i = 1; i < state.terrain.length; i += 1) ctx.lineTo(state.terrain[i].x, state.terrain[i].y);
    ctx.lineTo(state.terrain[state.terrain.length - 1].x, state.height + 10);
    ctx.closePath();
    const highestPoint = Math.min(...state.terrain.map((point) => point.y));
    const sand = ctx.createLinearGradient(0, highestPoint - 6, 0, state.height);
    sand.addColorStop(0, '#f2d98e');
    sand.addColorStop(0.38, '#c69a57');
    sand.addColorStop(1, '#69482d');
    ctx.fillStyle = sand;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 235, 171, 0.78)';
    ctx.lineWidth = Math.max(2, state.height * 0.004);
    ctx.beginPath();
    ctx.moveTo(state.terrain[0].x, state.terrain[0].y);
    for (let i = 1; i < state.terrain.length; i += 1) ctx.lineTo(state.terrain[i].x, state.terrain[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawCoin(coin) {
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, coin.r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd927';
    ctx.beginPath();
    ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff16a';
    ctx.lineWidth = Math.max(3, coin.r * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, coin.r * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawJellyfish(hazard) {
    const { x, y, r, phase } = hazard;
    ctx.save();
    ctx.translate(x, y);
    const pulse = Math.sin(state.time * 4 + phase) * r * 0.08;
    const glow = ctx.createRadialGradient(0, -r * 0.18, r * 0.1, 0, -r * 0.1, r * 1.22);
    glow.addColorStop(0, '#f4a5ff');
    glow.addColorStop(0.45, '#b828e0');
    glow.addColorStop(1, '#56106f');
    ctx.fillStyle = glow;
    ctx.strokeStyle = '#2b063d';
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r + pulse, Math.PI, 0);
    ctx.lineTo(r * 0.9, r * 0.32);
    ctx.lineTo(-r * 0.9, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.52;
    ctx.fillStyle = '#fa6dff';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.47, r * 0.19, 0, Math.PI * 2);
    ctx.arc(r * 0.26, -r * 0.4, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#e55cff';
    ctx.lineWidth = Math.max(3, r * 0.1);
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i += 1) {
      const tx = i * r * 0.27;
      ctx.beginPath();
      ctx.moveTo(tx, r * 0.23);
      ctx.quadraticCurveTo(tx + Math.sin(state.time * 5 + i) * r * 0.45, r * 0.88, tx + Math.cos(state.time * 4 + i) * r * 0.32, r * 1.55);
      ctx.stroke();
    }
    ctx.fillStyle = '#eaff58';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.12, r * 0.17, r * 0.23, -0.28, 0, Math.PI * 2);
    ctx.ellipse(r * 0.3, -r * 0.12, r * 0.17, r * 0.23, 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16021f';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.075, 0, Math.PI * 2);
    ctx.arc(r * 0.25, -r * 0.1, r * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#25062f';
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.48);
    ctx.lineTo(-r * 0.12, -r * 0.34);
    ctx.moveTo(r * 0.55, -r * 0.48);
    ctx.lineTo(r * 0.12, -r * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  function drawSquid(hazard) {
    const { x, y, r, phase } = hazard;
    ctx.save();
    ctx.translate(x, y);
    const body = ctx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, '#ff9074');
    body.addColorStop(0.48, '#dc3c4b');
    body.addColorStop(1, '#68182c');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#3c1020';
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.08, r * 0.82, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#68182c';
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.65);
    ctx.lineTo(-r * 1.25, -r * 1.12);
    ctx.lineTo(-r * 0.62, -r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -r * 0.65);
    ctx.lineTo(r * 1.25, -r * 1.12);
    ctx.lineTo(r * 0.62, -r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4b0c1f';
    ctx.lineWidth = Math.max(3, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.56, -r * 0.58);
    ctx.lineTo(-r * 0.09, -r * 0.47);
    ctx.moveTo(r * 0.56, -r * 0.58);
    ctx.lineTo(r * 0.09, -r * 0.47);
    ctx.stroke();
    ctx.fillStyle = '#ffe86a';
    ctx.beginPath();
    ctx.ellipse(-r * 0.29, -r * 0.25, r * 0.21, r * 0.28, -0.32, 0, Math.PI * 2);
    ctx.ellipse(r * 0.29, -r * 0.25, r * 0.21, r * 0.28, 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#261226';
    ctx.beginPath();
    ctx.ellipse(-r * 0.24, -r * 0.2, r * 0.065, r * 0.14, -0.12, 0, Math.PI * 2);
    ctx.ellipse(r * 0.24, -r * 0.2, r * 0.065, r * 0.14, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d0716';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.34, r * 0.38, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d5';
    for (let i = -2; i <= 2; i += 1) {
      const toothX = i * r * 0.15;
      ctx.beginPath();
      ctx.moveTo(toothX - r * 0.065, r * 0.19);
      ctx.lineTo(toothX, r * 0.42);
      ctx.lineTo(toothX + r * 0.065, r * 0.19);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#a7243d';
    ctx.lineWidth = Math.max(4, r * 0.14);
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i += 1) {
      const tx = i * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(tx, r * 0.75);
      ctx.quadraticCurveTo(tx + Math.sin(state.time * 4 + phase + i) * r * 0.62, r * 1.15, tx + Math.sin(state.time * 5 + i) * r * 0.38, r * 1.68);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHazard(hazard) {
    if (hazard.type === 'squid') drawSquid(hazard);
    else drawJellyfish(hazard);
  }

  function drawMedkit(medkit) {
    const { x, y, r } = medkit;
    ctx.save();
    ctx.translate(x, y + Math.sin(state.time * 3 + medkit.phase) * 4);
    ctx.fillStyle = '#f6f7f9';
    ctx.strokeStyle = '#d3314b';
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.73, r * 2, r * 1.46, r * 0.24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e83d50';
    ctx.fillRect(-r * 0.19, -r * 0.54, r * 0.38, r * 1.08);
    ctx.fillRect(-r * 0.54, -r * 0.19, r * 1.08, r * 0.38);
    ctx.restore();
  }

  function drawSubmarine() {
    const { x, y, vy, r } = state.submarine;
    const w = r * 4.5;
    const h = r * 1.35;
    const tilt = clamp(vy / 1600, -0.11, 0.13);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    if (state.invulnerableFor > 0 && Math.floor(state.time * 12) % 2 === 0) ctx.globalAlpha = 0.42;

    ctx.fillStyle = '#080808';
    ctx.beginPath();
    ctx.ellipse(w * 0.43, 0, h * 0.44, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd21a';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.roundRect(-w * 0.48, -h * 0.5, w * 0.9, h, h * 0.24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#050505';
    ctx.fillRect(-w * 0.28, -h * 0.15, w * 0.52, h * 0.3);

    ctx.fillStyle = '#cfd4da';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.fillRect(-r * 0.35, -h * 0.73, r * 0.65, h * 0.22);
    ctx.strokeRect(-r * 0.35, -h * 0.73, r * 0.65, h * 0.22);

    ctx.fillStyle = '#d5aa13';
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, -h * 0.3);
    ctx.lineTo(-w * 0.63, -h * 0.62);
    ctx.lineTo(-w * 0.42, -h * 0.47);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, h * 0.3);
    ctx.lineTo(-w * 0.63, h * 0.62);
    ctx.lineTo(-w * 0.42, h * 0.47);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    drawBackground();
    for (const coin of state.coins) drawCoin(coin);
    for (const medkit of state.medkits) drawMedkit(medkit);
    for (const hazard of state.hazards) drawHazard(hazard);
    drawTerrain();
    drawSubmarine();
    if (state.damageFlash > 0) {
      ctx.fillStyle = `rgba(222, 37, 60, ${state.damageFlash * 0.23})`;
      ctx.fillRect(0, 0, state.width, state.height);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  resetWorld(true);
  requestAnimationFrame(frame);
})();
