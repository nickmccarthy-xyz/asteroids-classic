const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const helpEl = document.getElementById("help");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const gameShellEl = document.getElementById("game-shell");
const startBtnEl = document.getElementById("start-btn");
const restartBtnEl = document.getElementById("restart-btn");
const leftBtnEl = document.getElementById("btn-left");
const rightBtnEl = document.getElementById("btn-right");
const thrustBtnEl = document.getElementById("btn-thrust");
const shootBtnEl = document.getElementById("btn-shoot");
const autoFireBtnEl = document.getElementById("btn-autofire");
const BASE_WIDTH = Number(canvas.getAttribute("width")) || 960;
const BASE_HEIGHT = Number(canvas.getAttribute("height")) || 640;

const GAME = {
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  maxBullets: 6,
  bulletLife: 1.1,
  bulletSpeed: 620,
  shootCooldown: 0.16,
  friction: 0.992,
  thrust: 360,
  turnSpeed: Math.PI * 1.9,
  shipRadius: 14,
};

const keys = {
  left: false,
  right: false,
  thrust: false,
  shoot: false,
};

let ship;
let bullets;
let asteroids;
let score;
let lives;
let level;
let gameStarted = false;
let gameOver = false;
let shootTimer = 0;
let lastTs = 0;
let autoFireEnabled = false;
let shootHeld = false;
let renderScaleX = 1;
let renderScaleY = 1;
let resizeRaf = 0;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function wrap(obj, radius = 0) {
  if (obj.x < -radius) obj.x = GAME.width + radius;
  if (obj.x > GAME.width + radius) obj.x = -radius;
  if (obj.y < -radius) obj.y = GAME.height + radius;
  if (obj.y > GAME.height + radius) obj.y = -radius;
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function createShip() {
  return {
    x: GAME.width / 2,
    y: GAME.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: GAME.shipRadius,
    invuln: 2,
  };
}

function createAsteroid(size, x, y) {
  const radius = size === 3 ? rand(42, 58) : size === 2 ? rand(24, 34) : rand(14, 20);
  const speedBase = size === 3 ? 42 : size === 2 ? 68 : 95;

  const points = [];
  const verts = Math.floor(rand(9, 14));
  for (let i = 0; i < verts; i += 1) {
    const angle = (Math.PI * 2 * i) / verts;
    const jag = rand(0.74, 1.18);
    points.push({
      x: Math.cos(angle) * radius * jag,
      y: Math.sin(angle) * radius * jag,
    });
  }

  return {
    x,
    y,
    vx: Math.cos(rand(0, Math.PI * 2)) * rand(speedBase * 0.65, speedBase * 1.35),
    vy: Math.sin(rand(0, Math.PI * 2)) * rand(speedBase * 0.65, speedBase * 1.35),
    rotation: rand(-0.75, 0.75),
    angle: rand(0, Math.PI * 2),
    size,
    radius,
    points,
  };
}

function spawnLevel() {
  const count = 3 + level;
  asteroids = [];

  for (let i = 0; i < count; i += 1) {
    let x;
    let y;
    do {
      x = rand(0, GAME.width);
      y = rand(0, GAME.height);
    } while ((x - ship.x) ** 2 + (y - ship.y) ** 2 < 160 ** 2);

    asteroids.push(createAsteroid(3, x, y));
  }
}

function resetGame() {
  ship = createShip();
  bullets = [];
  score = 0;
  lives = 3;
  level = 1;
  gameOver = false;
  shootTimer = 0;
  spawnLevel();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score);
  livesEl.textContent = String(lives);
  levelEl.textContent = String(level);
}

function splitAsteroid(asteroid) {
  if (asteroid.size === 3) {
    asteroids.push(createAsteroid(2, asteroid.x, asteroid.y));
    asteroids.push(createAsteroid(2, asteroid.x, asteroid.y));
    score += 20;
  } else if (asteroid.size === 2) {
    asteroids.push(createAsteroid(1, asteroid.x, asteroid.y));
    asteroids.push(createAsteroid(1, asteroid.x, asteroid.y));
    score += 50;
  } else {
    score += 100;
  }
}

function shoot() {
  if (shootTimer > 0 || bullets.length >= GAME.maxBullets) return;

  const noseX = ship.x + Math.cos(ship.angle) * ship.radius;
  const noseY = ship.y + Math.sin(ship.angle) * ship.radius;

  bullets.push({
    x: noseX,
    y: noseY,
    vx: ship.vx + Math.cos(ship.angle) * GAME.bulletSpeed,
    vy: ship.vy + Math.sin(ship.angle) * GAME.bulletSpeed,
    life: GAME.bulletLife,
  });
  shootTimer = GAME.shootCooldown;
}

function loseLife() {
  lives -= 1;
  updateHud();

  if (lives <= 0) {
    gameOver = true;
    overlayTitleEl.textContent = "Game Over";
    overlayTextEl.textContent = `Final score: ${score}`;
    overlayEl.classList.remove("hidden");
    return;
  }

  ship = createShip();
}

function update(dt) {
  if (!gameStarted || gameOver) return;

  shootTimer = Math.max(0, shootTimer - dt);

  if (keys.left) ship.angle -= GAME.turnSpeed * dt;
  if (keys.right) ship.angle += GAME.turnSpeed * dt;

  if (keys.thrust) {
    ship.vx += Math.cos(ship.angle) * GAME.thrust * dt;
    ship.vy += Math.sin(ship.angle) * GAME.thrust * dt;
  }

  ship.vx *= GAME.friction;
  ship.vy *= GAME.friction;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  wrap(ship, ship.radius);

  ship.invuln = Math.max(0, ship.invuln - dt);

  if (keys.shoot) shoot();

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    wrap(b, 2);
    b.life -= dt;
    if (b.life <= 0) bullets.splice(i, 1);
  }

  for (const asteroid of asteroids) {
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    asteroid.angle += asteroid.rotation * dt;
    wrap(asteroid, asteroid.radius);
  }

  for (let bi = bullets.length - 1; bi >= 0; bi -= 1) {
    const b = bullets[bi];
    for (let ai = asteroids.length - 1; ai >= 0; ai -= 1) {
      const a = asteroids[ai];
      if (distSq(b, a) <= (a.radius + 2) ** 2) {
        bullets.splice(bi, 1);
        asteroids.splice(ai, 1);
        splitAsteroid(a);
        updateHud();
        break;
      }
    }
  }

  if (ship.invuln <= 0) {
    for (const a of asteroids) {
      if (distSq(ship, a) <= (ship.radius + a.radius * 0.86) ** 2) {
        loseLife();
        break;
      }
    }
  }

  if (!asteroids.length) {
    level += 1;
    updateHud();
    ship.invuln = Math.max(ship.invuln, 1.2);
    spawnLevel();
  }
}

function drawShip() {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle + Math.PI / 2);

  if (ship.invuln > 0 && Math.floor(ship.invuln * 16) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  ctx.strokeStyle = "#f2f7ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -ship.radius);
  ctx.lineTo(ship.radius * 0.78, ship.radius);
  ctx.lineTo(0, ship.radius * 0.38);
  ctx.lineTo(-ship.radius * 0.78, ship.radius);
  ctx.closePath();
  ctx.stroke();

  if (keys.thrust && !gameOver && gameStarted) {
    ctx.strokeStyle = "#8ec5ff";
    ctx.beginPath();
    ctx.moveTo(-ship.radius * 0.42, ship.radius * 0.72);
    ctx.lineTo(0, ship.radius + rand(10, 20));
    ctx.lineTo(ship.radius * 0.42, ship.radius * 0.72);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAsteroids() {
  ctx.strokeStyle = "#d6e5ff";
  ctx.lineWidth = 2;

  for (const a of asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.beginPath();
    ctx.moveTo(a.points[0].x, a.points[0].y);
    for (let i = 1; i < a.points.length; i += 1) {
      ctx.lineTo(a.points[i].x, a.points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets() {
  ctx.fillStyle = "#ffffff";
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStars() {
  ctx.fillStyle = "rgba(170, 200, 255, 0.75)";
  for (let i = 0; i < 52; i += 1) {
    const seed = i * 97;
    const x = (seed * 17) % GAME.width;
    const y = (seed * 53) % GAME.height;
    const r = ((seed * 23) % 20) / 20 + 0.45;
    ctx.fillRect(x, y, r, r);
  }
}

function getRenderScaleTarget() {
  const dpr = window.devicePixelRatio || 1;
  const hasTouch = hasTouchDevice();
  let maxScale = hasTouch ? 1.35 : 2;
  if (hasTouch && Math.min(window.innerWidth, window.innerHeight) < 430) {
    maxScale = 1.1;
  }
  return Math.min(dpr, maxScale);
}

function syncCanvasResolution() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const renderScale = getRenderScaleTarget();
  const targetWidth = Math.max(240, Math.round(rect.width * renderScale));
  const targetHeight = Math.max(160, Math.round(rect.height * renderScale));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  renderScaleX = canvas.width / GAME.width;
  renderScaleY = canvas.height / GAME.height;
  ctx.imageSmoothingEnabled = false;
}

function scheduleCanvasSync() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    syncCanvasResolution();
  });
}

function render() {
  ctx.setTransform(renderScaleX, 0, 0, renderScaleY, 0, 0);
  ctx.clearRect(0, 0, GAME.width, GAME.height);
  drawStars();
  drawAsteroids();
  drawBullets();
  if (gameStarted) drawShip();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function startNewRun() {
  gameStarted = true;
  helpEl.classList.add("hidden");
  overlayEl.classList.add("hidden");
  resetGame();
}

function setControlState(key, isPressed, btnEl) {
  keys[key] = isPressed;
  if (!btnEl) return;
  btnEl.classList.toggle("active", isPressed);
}

function updateShootState() {
  const isShooting = autoFireEnabled || shootHeld;
  keys.shoot = isShooting;
  if (shootBtnEl) shootBtnEl.classList.toggle("active", isShooting);
}

function setAutoFire(isEnabled) {
  autoFireEnabled = isEnabled;
  if (autoFireBtnEl) autoFireBtnEl.classList.toggle("active", autoFireEnabled);
  updateShootState();
}

function hasTouchDevice() {
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return Boolean(coarsePointer || navigator.maxTouchPoints > 0 || "ontouchstart" in window);
}

function bindPressHandlers(btnEl, onStart, onEnd) {
  if (!btnEl) return;

  if (window.PointerEvent) {
    btnEl.addEventListener("pointerdown", (e) => {
      onStart();
      e.preventDefault();
    });
    btnEl.addEventListener("pointerup", (e) => {
      onEnd();
      e.preventDefault();
    });
    btnEl.addEventListener("pointercancel", (e) => {
      onEnd();
      e.preventDefault();
    });
    btnEl.addEventListener("lostpointercapture", () => {
      onEnd();
    });
  } else {
    btnEl.addEventListener("touchstart", (e) => {
      onStart();
      e.preventDefault();
    });
    btnEl.addEventListener("touchend", (e) => {
      onEnd();
      e.preventDefault();
    });
    btnEl.addEventListener("touchcancel", (e) => {
      onEnd();
      e.preventDefault();
    });
    btnEl.addEventListener("mousedown", (e) => {
      onStart();
      e.preventDefault();
    });
    btnEl.addEventListener("mouseup", (e) => {
      onEnd();
      e.preventDefault();
    });
    btnEl.addEventListener("mouseleave", () => {
      onEnd();
    });
  }

  btnEl.addEventListener("contextmenu", (e) => e.preventDefault());
}

function bindHoldControl(btnEl, key) {
  if (!btnEl) return;
  bindPressHandlers(
    btnEl,
    () => setControlState(key, true, btnEl),
    () => setControlState(key, false, btnEl),
  );
}

function bindShootControl(btnEl) {
  if (!btnEl) return;
  bindPressHandlers(
    btnEl,
    () => {
      shootHeld = true;
      updateShootState();
    },
    () => {
      shootHeld = false;
      updateShootState();
    },
  );
}

function enableTouchUiIfAvailable() {
  if (hasTouchDevice()) {
    gameShellEl.classList.add("show-touch");
  }
}

enableTouchUiIfAvailable();
window.addEventListener("resize", scheduleCanvasSync, { passive: true });
window.addEventListener("orientationchange", scheduleCanvasSync, { passive: true });
bindHoldControl(leftBtnEl, "left");
bindHoldControl(rightBtnEl, "right");
bindHoldControl(thrustBtnEl, "thrust");
bindShootControl(shootBtnEl);

if (autoFireBtnEl) {
  autoFireBtnEl.addEventListener("click", () => {
    setAutoFire(!autoFireEnabled);
  });
}

if (startBtnEl) {
  startBtnEl.addEventListener("click", (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver) startNewRun();
  });
  startBtnEl.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (!gameStarted || gameOver) startNewRun();
    },
    { passive: false },
  );
}

if (restartBtnEl) {
  restartBtnEl.addEventListener("click", (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver) startNewRun();
  });
  restartBtnEl.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (!gameStarted || gameOver) startNewRun();
    },
    { passive: false },
  );
}

helpEl.addEventListener(
  "touchend",
  (e) => {
    if (!gameStarted || gameOver) {
      e.preventDefault();
      startNewRun();
    }
  },
  { passive: false },
);

overlayEl.addEventListener(
  "touchend",
  (e) => {
    if (!gameStarted || gameOver) {
      e.preventDefault();
      startNewRun();
    }
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") {
    keys.left = true;
    e.preventDefault();
  }
  if (k === "arrowright" || k === "d") {
    keys.right = true;
    e.preventDefault();
  }
  if (k === "arrowup" || k === "w") {
    keys.thrust = true;
    e.preventDefault();
  }
  if (k === " ") {
    keys.shoot = true;
    e.preventDefault();
  }

  if (k === "enter" && (!gameStarted || gameOver)) {
    startNewRun();
  }
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") keys.left = false;
  if (k === "arrowright" || k === "d") keys.right = false;
  if (k === "arrowup" || k === "w") keys.thrust = false;
  if (k === " ") {
    keys.shoot = autoFireEnabled || shootHeld;
  }
});

syncCanvasResolution();
resetGame();
requestAnimationFrame(frame);
