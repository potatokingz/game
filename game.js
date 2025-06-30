// Triangle In Space - Improved Version
(() => {
  // --- Utility ---
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
  function randomBetween(a, b) { return Math.random() * (b - a) + a; }
  function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints;
  }

  // --- DOM & Canvas Init ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const mobBtn = document.getElementById('mobileShootBtn');
  let WIDTH = 0, HEIGHT = 0, scale = 1, dpr = 1;

  // --- Game State ---
  const BASE = {
    triW: 38, triH: 50, triSpeed: 5,
    projW: 6, projH: 12, projSpeed: 10,
    smallCount: 20, midCount: 20, bigCount: 3,
    shooterSize: 26, bulletSize: 10, bulletSpeed: 3,
    timer: 40
  };

  let triangle = { x: null, y: null, width: 0, height: 0, speed: 0 };
  let projectiles = [], circles = [], shooters = [], shooterBullets = [];
  let scaleParams = {};
  let UI_SAFE_ZONE = 0;
  let score = 0, gameOver = false, levelTimer = BASE.timer, levelTimerInterval = null;
  let triangleImmune = false, triangleImmuneTimeout = null, pendingLevelClearImmunity = false;
  let scoreboard = [];
  const SCOREBOARD_KEY = 'triangleGameScoreboard';

  // Input
  const keys = {};
  let draggingTriangle = false, dragOffsetX = 0, dragOffsetY = 0;
  let nameInputElement = null;

  // --- Resize and Scaling ---
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    canvas.style.height = HEIGHT + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    scale = WIDTH / 400;
    if (HEIGHT < WIDTH) scale = HEIGHT / 700;
    scale = Math.min(scale, 1.5);

    scaleParams = {
      triangleWidth: BASE.triW * scale,
      triangleHeight: BASE.triH * scale,
      triangleSpeed: BASE.triSpeed * scale,
      projectileWidth: BASE.projW * scale,
      projectileHeight: BASE.projH * scale,
      projectileSpeed: BASE.projSpeed * scale,
      shooterSize: BASE.shooterSize * scale,
      shooterBulletSize: BASE.bulletSize * scale,
      shooterBulletSpeed: BASE.bulletSpeed * scale
    };

    UI_SAFE_ZONE = Math.max(100 * scale, 0.13 * HEIGHT);

    if (triangle.x === null || triangle.y === null) {
      triangle.x = WIDTH / 2;
      triangle.y = Math.max(HEIGHT - scaleParams.triangleHeight * 2, UI_SAFE_ZONE + scaleParams.triangleHeight / 2 + 10 * scale);
    } else {
      triangle.x = clamp(triangle.x, scaleParams.triangleWidth / 2, WIDTH - scaleParams.triangleWidth / 2);
      triangle.y = clamp(triangle.y, UI_SAFE_ZONE + scaleParams.triangleHeight / 2 + 10 * scale, HEIGHT - scaleParams.triangleHeight / 2);
    }
    triangle.width = scaleParams.triangleWidth;
    triangle.height = scaleParams.triangleHeight;
    triangle.speed = scaleParams.triangleSpeed;

    updateMobileShootBtnVisibility();
  }

  // --- Mobile Shoot Button ---
  function updateMobileShootBtnVisibility() {
    mobBtn.style.display = isTouchDevice() ? 'block' : 'none';
  }

  // --- Scoreboard Persistence ---
  function loadScoreboard() {
    try {
      scoreboard = JSON.parse(localStorage.getItem(SCOREBOARD_KEY)) || [];
    } catch {
      scoreboard = [];
    }
  }
  function saveScoreboard() {
    try {
      localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scoreboard));
    } catch {}
  }

  // --- Game Reset & Init ---
  function resetGame() {
    resizeCanvas();
    triangle.x = WIDTH / 2;
    triangle.y = HEIGHT - scaleParams.triangleHeight * 2;
    projectiles = [];
    score = 0;
    gameOver = false;
    window._scoreSubmittedForThisGame = false;
    spawnBackgroundCircles();
    spawnCircles();
    spawnShooters();
    triangleImmune = true;
    clearTimeout(triangleImmuneTimeout);
    triangleImmuneTimeout = setTimeout(() => (triangleImmune = false), 2000 * scale);
    startLevelTimer();
    hidePlayAgainButton();
    hideNameInput();
    updateMobileShootBtnVisibility();
  }

  window.addEventListener('resize', resetGame);

  // --- Spawning Entities ---
  let backgroundCircles = [];
  function spawnBackgroundCircles() {
    backgroundCircles = [];
    const numStars = Math.floor(WIDTH * HEIGHT / (1200 * scale));
    for (let i = 0; i < numStars; i++) {
      const r = Math.random() < 0.7
        ? randomBetween(0.5, 1.5) * scale
        : randomBetween(1.5, 2.5) * scale;
      backgroundCircles.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        r,
        color: '#fff'
      });
    }
  }

  function spawnCircles() {
    circles = [];
    const triRad = Math.min(scaleParams.triangleWidth, scaleParams.triangleHeight) / 2;
    // small
    for (let i = 0; i < BASE.smallCount; i++) {
      if (Math.random() < 0.25) {
        const r = triRad / 2;
        const vx = (Math.random() < 0.5 ? -1 : 1) * randomBetween(1.5, 3.5) * scale;
        const vy = Math.random() < 0.65
          ? (Math.random() < 0.5 ? -1 : 1) * randomBetween(1, 2.5) * scale
          : 0;
        circles.push({
          x: randomBetween(r, WIDTH - r),
          y: randomBetween(UI_SAFE_ZONE + r + 8 * scale, HEIGHT - r),
          r, hits: 0, maxHits: 1, color: '#ff2222', vx, vy
        });
      }
    }
    // mid
    for (let i = 0; i < BASE.midCount; i++) {
      if (Math.random() < 0.5) {
        const r = triRad;
        const vx = (Math.random() < 0.5 ? -1 : 1) * randomBetween(1, 2.5) * scale;
        const vy = Math.random() < 0.65
          ? (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.7, 2) * scale
          : 0;
        circles.push({
          x: randomBetween(r, WIDTH - r),
          y: randomBetween(UI_SAFE_ZONE + r + 8 * scale, HEIGHT - r),
          r, hits: 0, maxHits: 5, color: '#ff2222', vx, vy
        });
      }
    }
    // big
    for (let i = 0; i < BASE.bigCount; i++) {
      if (Math.random() < 0.25) {
        const r = triRad * 2;
        let x, y, ok, tries = 0;
        do {
          x = randomBetween(r, WIDTH - r);
          y = randomBetween(UI_SAFE_ZONE + r + 8 * scale, HEIGHT - r);
          ok = !circles.some(c => Math.hypot(x - c.x, y - c.y) < c.r + r + 4);
          tries++;
        } while (!ok && tries < 100);
        const vx = (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.5, 1.5) * scale;
        const vy = Math.random() < 0.65
          ? (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.3, 1) * scale
          : 0;
        circles.push({ x, y, r, hits: 0, maxHits: 10, color: '#ff2222', vx, vy });
      }
    }
  }

  function spawnShooters() {
    shooters = [];
    shooterBullets = [];
    const cols = 3, spacing = WIDTH / (cols + 1);
    for (let i = 0; i < cols; i++) {
      shooters.push({
        x: spacing * (i + 1),
        y: UI_SAFE_ZONE / 2 + scaleParams.shooterSize / 2 + 6 * scale,
        size: scaleParams.shooterSize,
        color: '#00ff44',
        nextShot: Date.now() + 5000 * (1 + Math.random())
      });
      shooterBullets.push(null);
    }
  }

  // --- Timer & Physics ---
  function startLevelTimer() {
    levelTimer = BASE.timer;
    clearInterval(levelTimerInterval);
    levelTimerInterval = setInterval(() => {
      if (gameOver) return;
      levelTimer--;
      if (levelTimer <= 0) {
        levelTimer = 0; gameOver = true; clearInterval(levelTimerInterval);
      }
    }, 1000);
  }
  function stopLevelTimer() { clearInterval(levelTimerInterval); }

  // --- Input Handling ---
  // Mouse
  canvas.addEventListener('mousedown', e => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (
      mx >= triangle.x - triangle.width / 2 &&
      mx <= triangle.x + triangle.width / 2 &&
      my >= triangle.y - triangle.height / 2 &&
      my <= triangle.y + triangle.height / 2
    ) {
      draggingTriangle = true;
      dragOffsetX = mx - triangle.x;
      dragOffsetY = my - triangle.y;
    }
  });
  canvas.addEventListener('mousemove', e => {
    if (!draggingTriangle) return;
    const r = canvas.getBoundingClientRect();
    triangle.x = e.clientX - r.left - dragOffsetX;
    triangle.y = e.clientY - r.top - dragOffsetY;
    triangle.x = clamp(triangle.x, triangle.width / 2, WIDTH - triangle.width / 2);
    triangle.y = clamp(triangle.y, UI_SAFE_ZONE + triangle.height / 2 + 10 * scale, HEIGHT - triangle.height / 2);
  });
  ['mouseup', 'mouseleave'].forEach(evt =>
    canvas.addEventListener(evt, () => (draggingTriangle = false))
  );

  // Touch
  canvas.addEventListener('touchstart', e => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = t.clientX - r.left, y = t.clientY - r.top;
    if (
      x >= triangle.x - triangle.width / 2 &&
      x <= triangle.x + triangle.width / 2 &&
      y >= triangle.y - triangle.height / 2 &&
      y <= triangle.y + triangle.height / 2
    ) {
      draggingTriangle = true;
      dragOffsetX = x - triangle.x; dragOffsetY = y - triangle.y;
    } else {
      // Tap above triangle to shoot
      if (y < triangle.y - triangle.height / 2) {
        projectiles.push({ x: triangle.x, y: triangle.y - triangle.height / 2 });
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (!draggingTriangle) return;
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    triangle.x = t.clientX - r.left - dragOffsetX;
    triangle.y = t.clientY - r.top - dragOffsetY;
    triangle.x = clamp(triangle.x, triangle.width / 2, WIDTH - triangle.width / 2);
    triangle.y = clamp(triangle.y, triangle.height / 2, HEIGHT - triangle.height / 2);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { draggingTriangle = false; });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (gameOver && (e.key === 'r' || e.key === 'R')) {
      if (nameInputElement && document.activeElement === nameInputElement) return;
      resetGame(); return;
    }
    keys[e.key.toLowerCase()] = true;
    if (!gameOver && (e.code === 'Space' || e.key === ' ')) {
      projectiles.push({ x: triangle.x, y: triangle.y - triangle.height / 2 });
    }
  });
  document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // Mobile Shoot Button
  let fireInterval = null;
  mobBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    startFiring();
  }, { passive: false });
  mobBtn.addEventListener('touchend', stopFiring, { passive: false });
  mobBtn.addEventListener('touchcancel', stopFiring, { passive: false });
  mobBtn.addEventListener('mousedown', e => {
    e.preventDefault();
    startFiring();
  });
  mobBtn.addEventListener('mouseup', stopFiring);
  mobBtn.addEventListener('mouseleave', stopFiring);

  function startFiring() {
    if (fireInterval) return;
    projectiles.push({ x: triangle.x, y: triangle.y - triangle.height / 2 });
    if (navigator.vibrate) navigator.vibrate(30);
    fireInterval = setInterval(() => {
      projectiles.push({ x: triangle.x, y: triangle.y - triangle.height / 2 });
      if (navigator.vibrate) navigator.vibrate(10);
    }, 120);
  }
  function stopFiring() {
    clearInterval(fireInterval);
    fireInterval = null;
  }

  // --- Collision & Update ---
  function triangleSquareCollision(tx, ty, tw, th, sx, sy, sr) {
    // Axis-aligned bounding box for simplicity
    const triL = tx - tw / 2, triR = tx + tw / 2;
    const triT = ty - th / 2, triB = ty + th / 2;
    const sqL = sx - sr, sqR = sx + sr;
    const sqT = sy - sr, sqB = sy + sr;
    return triL < sqR && triR > sqL && triT < sqB && triB > sqT;
  }

  function updateProjectiles() {
    projectiles.forEach(p => p.y -= scaleParams.projectileSpeed);
    projectiles = projectiles.filter(p => p.y > -scaleParams.projectileHeight);
    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const p = projectiles[j];
        if (Math.hypot(p.x - c.x, (p.y + scaleParams.projectileHeight / 2) - c.y) < c.r + scaleParams.projectileWidth / 2) {
          c.hits++;
          projectiles.splice(j, 1);
          if (c.hits >= c.maxHits) {
            circles.splice(i, 1);
            score++;
            if (!circles.length) pendingLevelClearImmunity = true;
          }
          break;
        }
      }
    }
  }

  function updateCircles() {
    circles.forEach(c => {
      c.x += c.vx; c.y += c.vy;
      if (c.x - c.r < 0 || c.x + c.r > WIDTH) c.vx *= -1;
      if (c.y - c.r < UI_SAFE_ZONE) c.vy = Math.abs(c.vy);
      if (c.y + c.r > HEIGHT - triangle.height * 1.2) {
        c.y = HEIGHT - triangle.height * 1.2 - c.r;
        c.vy = -Math.abs(c.vy);
      }
    });
  }

  function update() {
    shooters.forEach((sh, i) => {
      if (!shooterBullets[i] && Date.now() > sh.nextShot) {
        shooterBullets[i] = {
          x: sh.x, y: sh.y + sh.size / 2, vy: scaleParams.shooterBulletSpeed, size: scaleParams.shooterBulletSize
        };
        sh.nextShot = Date.now() + 5000;
      }
      const b = shooterBullets[i];
      if (b) {
        b.y += b.vy;
        if (
          !triangleImmune &&
          b.x > triangle.x - triangle.width / 2 &&
          b.x < triangle.x + triangle.width / 2 &&
          b.y + b.size / 2 > triangle.y - triangle.height / 2 &&
          b.y - b.size / 2 < triangle.y + triangle.height / 2
        ) {
          gameOver = true;
        }
        if (b.y - b.size > HEIGHT) shooterBullets[i] = null;
      }
    });

    if (gameOver) return;

    updateProjectiles();
    updateCircles();

    if (keys['a']) triangle.x -= triangle.speed;
    if (keys['d']) triangle.x += triangle.speed;
    if (keys['w']) triangle.y -= triangle.speed;
    if (keys['s']) triangle.y += triangle.speed;

    triangle.x = clamp(triangle.x, triangle.width / 2, WIDTH - triangle.width / 2);
    triangle.y = clamp(triangle.y, triangle.height / 2, HEIGHT - triangle.height / 2);

    if (!triangleImmune) {
      for (const c of circles) {
        if (triangleSquareCollision(triangle.x, triangle.y, triangle.width, triangle.height, c.x, c.y, c.r)) {
          gameOver = true;
          break;
        }
      }
    }

    if (pendingLevelClearImmunity) {
      spawnBackgroundCircles();
      spawnCircles();
      spawnShooters();
      triangleImmune = true;
      clearTimeout(triangleImmuneTimeout);
      triangleImmuneTimeout = setTimeout(() => (triangleImmune = false), 2000 * scale);
      pendingLevelClearImmunity = false;
      startLevelTimer();
    }
  }

  // --- Rendering ---
  function drawBackgroundCircles() {
    backgroundCircles.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  function drawCircles() {
    circles.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    });
  }

  function drawProjectiles() {
    projectiles.forEach(p => {
      ctx.fillStyle = '#00ff44';
      ctx.fillRect(p.x - scaleParams.projectileWidth / 2, p.y - scaleParams.projectileHeight, scaleParams.projectileWidth, scaleParams.projectileHeight);
    });
  }

  function drawScoreboard() {
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `bold ${28 * scale}px Arial`;
    ctx.fillText('Top 10 Scores', WIDTH / 2, 32 * scale);
    ctx.font = `${20 * scale}px Arial`;
    scoreboard.forEach((e, i) => {
      ctx.fillText(`${i + 1}. ${e.name}: ${e.score}`, WIDTH / 2, 80 * scale + i * 32 * scale);
    });
    ctx.restore();
  }

  // --- Name Input & Play Again ---
  function showNameInput() {
    if (nameInputElement) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'nameInputWrapper';
    Object.assign(wrapper.style, {
      position: 'fixed',
      left: '50%',
      top: '12%',
      transform: 'translate(-50%, 0)',
      zIndex: 2001,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'rgba(255,255,255,0.97)',
      padding: `${10 * scale}px ${18 * scale}px`,
      borderRadius: `${12 * scale}px`,
      boxShadow: '0 2px 12px #0003',
      gap: `${8 * scale}px`,
    });
    nameInputElement = document.createElement('input');
    nameInputElement.type = 'text';
    nameInputElement.maxLength = 12;
    nameInputElement.placeholder = 'Enter your name';
    Object.assign(nameInputElement.style, {
      fontSize: `${18 * scale}px`,
      padding: `${8 * scale}px ${12 * scale}px`,
      borderRadius: `${8 * scale}px`,
      border: `2px solid #0078ff`,
      outline: 'none',
      textAlign: 'center',
      background: '#fff',
      color: '#0078ff',
      width: `${180 * scale}px`,
      marginBottom: `${8 * scale}px`,
    });
    const submitBtn = document.createElement('button');
    submitBtn.innerText = 'Submit';
    Object.assign(submitBtn.style, {
      fontSize: `${18 * scale}px`,
      padding: `${8 * scale}px ${20 * scale}px`,
      borderRadius: `${8 * scale}px`,
      background: '#0078ff',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      height: `${48 * scale}px`
    });
    const doSubmit = () => {
      const name = nameInputElement.value.trim() || 'Anonymous';
      document.getElementById('nameInputWrapper').remove();
      nameInputElement = null;
      submitScore(name);
    };
    submitBtn.onclick = doSubmit;
    nameInputElement.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
    wrapper.append(nameInputElement, submitBtn);
    document.body.appendChild(wrapper);
    nameInputElement.focus();
  }
  function hideNameInput() {
    const w = document.getElementById('nameInputWrapper');
    if (w) w.remove();
    nameInputElement = null;
  }

  function submitScore(name) {
    scoreboard.push({ name, score });
    scoreboard.sort((a, b) => b.score - a.score);
    if (scoreboard.length > 10) scoreboard.length = 10;
    saveScoreboard();
    window._scoreSubmittedForThisGame = true;
    hideNameInput();
    drawScoreboard();
    showPlayAgainButton();
  }

  function showPlayAgainButton() {
    if (document.getElementById('playAgainBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'playAgainBtn';
    btn.innerText = 'Play Again';
    Object.assign(btn.style, {
      position: 'fixed',
      left: '50%',
      top: `${80 * scale}%`,
      transform: 'translate(-50%,-50%)',
      fontSize: `${16 * scale}px`,
      padding: `${12 * scale}px ${24 * scale}px`,
      borderRadius: `${8 * scale}px`,
      background: '#0078ff',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      zIndex: 2000
    });
    btn.onclick = resetGame;
    document.body.appendChild(btn);
  }
  function hidePlayAgainButton() {
    const b = document.getElementById('playAgainBtn');
    if (b) b.remove();
  }

  // --- Main Game Loop ---
  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawBackgroundCircles();
    drawCircles();
    drawProjectiles();

    shooters.forEach((sh, i) => {
      ctx.fillStyle = sh.color;
      ctx.fillRect(sh.x - sh.size / 2, sh.y - sh.size / 2, sh.size, sh.size);
      const b = shooterBullets[i];
      if (b) {
        ctx.fillStyle = '#a020f0';
        ctx.fillRect(b.x - b.size / 2, b.y - b.size, b.size, b.size * 2);
      }
    });

    ctx.save();
    ctx.font = `bold ${20 * scale}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.92;
    ctx.fillText(`Score: ${score}`, WIDTH - 32 * scale, 24 * scale + 0.04 * HEIGHT);
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${levelTimer}s`, 32 * scale, 24 * scale + 0.04 * HEIGHT);
    ctx.restore();

    if (gameOver) {
      stopLevelTimer();
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${48 * scale}px Arial`;
      ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 60 * scale);
      ctx.font = `${24 * scale}px Arial`;
      ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2 - 10 * scale);
      ctx.font = `bold ${24 * scale}px Arial`;
      ctx.fillText('Top 10 Scores', WIDTH / 2, HEIGHT / 2 + 40 * scale);
      ctx.font = `${18 * scale}px Arial`;
      scoreboard.forEach((e, i) => {
        ctx.fillText(`${i + 1}. ${e.name}: ${e.score}`, WIDTH / 2, HEIGHT / 2 + (80 + 30 * i) * scale);
      });
      ctx.restore();
      if (!nameInputElement && !window._scoreSubmittedForThisGame) showNameInput();
      showPlayAgainButton();
      return;
    }

    if (triangleImmune) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 100);
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 8 * scale;
      ctx.beginPath();
      ctx.moveTo(triangle.x, triangle.y - triangle.height / 2);
      ctx.lineTo(triangle.x - triangle.width / 2, triangle.y + triangle.height / 2);
      ctx.lineTo(triangle.x + triangle.width / 2, triangle.y + triangle.height / 2);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#0078ff';
    ctx.beginPath();
    ctx.moveTo(triangle.x, triangle.y - triangle.height / 2);
    ctx.lineTo(triangle.x - triangle.width / 2, triangle.y + triangle.height / 2);
    ctx.lineTo(triangle.x + triangle.width / 2, triangle.y + triangle.height / 2);
    ctx.closePath();
    ctx.fill();
  }

  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // --- Bootstrap ---
  document.addEventListener('DOMContentLoaded', () => {
    loadScoreboard();
    resizeCanvas();
    resetGame();
    startLevelTimer();
    requestAnimationFrame(gameLoop);
  });
})();
