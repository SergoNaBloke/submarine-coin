(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const coinCountEl = document.getElementById('coinCount');
  const overlay = document.getElementById('overlay');
  const finalScoreEl = document.getElementById('finalScore');
  const startHint = document.getElementById('startHint');

  const KEY_SET = new Set(['Space', 'ArrowUp', 'KeyW']);
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
    terrainCursorY: 0,
    terrainTargetY: 0,
    coinDistance: 0,
    time: 0,
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

    if (!state.started || state.gameOver) resetWorld(false);
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
    state.terrainCursorY = state.height * 0.78;
    state.terrainTargetY = state.terrainCursorY;
    state.coinDistance = 180;

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

  function updateHud() {
    coinCountEl.textContent = `x ${String(state.score).padStart(2, '0')}`;
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
  addEventListener('blur', endInput);
  addEventListener('resize', resize);

  function update(dt) {
    if (!state.started || state.gameOver) return;

    state.time += dt;
    const sub = state.submarine;
    const gravity = clamp(state.height * 0.8, 620, 1040);
    const lift = clamp(state.height * 50.65, 980, 2400);
    const maxRise = -clamp(state.height * 0.56, 330, 560);
    const maxFall = clamp(state.height * 0.65, 370, 650);

    sub.vy += gravity * dt;
    if (state.pressing) sub.vy -= lift * dt;
    sub.vy = clamp(sub.vy, maxRise, maxFall);
    sub.y += sub.vy * dt;

    if (sub.y - sub.r < 0) {
      sub.y = sub.r;
      sub.vy = Math.max(0, sub.vy * 0.25);
    }

    const dx = state.speed * dt;
    for (const p of state.terrain) p.x -= dx;
    for (const c of state.coins) c.x -= dx;

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

    const subCircle = { x: sub.x, y: sub.y, r: sub.r * 0.78 };
    for (const coin of state.coins) {
      if (!coin.collected && GameCore.circlesOverlap(subCircle, coin)) {
        coin.collected = true;
        state.score += 1;
        updateHud();
      }
    }
    state.coins = state.coins.filter((coin) => !coin.collected && coin.x > -40);

    if (GameCore.circleHitsTerrain(subCircle, state.terrain)) endGame();
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

  function drawSubmarine() {
    const { x, y, vy, r } = state.submarine;
    const w = r * 4.5;
    const h = r * 1.35;
    const tilt = clamp(vy / 1600, -0.11, 0.13);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

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
    drawTerrain();
    drawSubmarine();
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
