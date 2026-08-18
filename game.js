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

    if (!state.started && !state.gameOver) resetWorld(false);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function rand(min, max) {
    return min + Math.random() * (max - min);
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
    state.coins.length = 0;
    state.hazards.length = 0;
    state.medkits.length = 0;
    state.terrainCursorY = state.height * 0.78;
    state.terrainTargetY = state.terrainCursorY;
    state.coinDistance = 180;
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

  function safeSpawnY(x, clearance, upperPadding = 85) {
    const floorY = GameCore.terrainYAt(state.terrain, x);
    const minY = upperPadding + clearance;
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
    const baseY = safeSpawnY(x, r + 82 + verticalRange);
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
      state.coinDistance = rand(210, 380);
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
    const g = ctx.createLinearGradient(0, 0, 0, state.height);
    g.addColorStop(0, '#6d9df0');
    g.addColorStop(1, '#4f83dc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 220 - state.time * 16) % (state.width + 260)) - 100;
      const y = 80 + (i % 4) * 95;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTerrain() {
    if (state.terrain.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(state.terrain[0].x, state.height + 10);
    ctx.lineTo(state.terrain[0].x, state.terrain[0].y);
    for (let i = 1; i < state.terrain.length; i += 1) ctx.lineTo(state.terrain[i].x, state.terrain[i].y);
    ctx.lineTo(state.terrain[state.terrain.length - 1].x, state.height + 10);
    ctx.closePath();
    ctx.fillStyle = '#050505';
    ctx.fill();
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
