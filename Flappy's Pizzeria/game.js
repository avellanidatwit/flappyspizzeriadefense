const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const ordersList = document.getElementById("ordersList");
const livesEl = document.getElementById("lives");
const baseEl = document.getElementById("base");
const coinsEl = document.getElementById("coins");
const waveEl = document.getElementById("wave");
const scoreEl = document.getElementById("score");

const shopButtons = document.querySelectorAll(".shop-btn");

const GAME = {
  width: canvas.width,
  height: canvas.height,
  lanes: [140, 270, 400],
  turretXPositions: [220, 360],
  running: false,
  paused: false,
  lastTime: 0,
  spawnTimer: 0,
  obstacleTimer: 0,
  waveTimer: 0,
  orderTimer: 0,
  baseSpawnInterval: 3200,
  minSpawnInterval: 1600,
  spawnRampPerWave: 150,
};

const toppingCatalog = {
  pepperoni: { label: "Pepperoni", emoji: "🍕", cost: 30, damage: 2, fireRate: 500, shots: 10 },
  mushroom: { label: "Mushroom", emoji: "🍄", cost: 20, damage: 1, fireRate: 200, shots: 20 },
  olive: { label: "Olive", emoji: "🫒", cost: 40, damage: 3, fireRate: 1000, shots: 4 },
};

const state = {
  lives: 5,
  baseHealth: 5,
  coins: 40,
  wave: 1,
  score: 0,
  selectedTopping: null,
  orders: [],
  turrets: [],
  zombies: [],
  projectiles: [],
  obstacles: [],
  player: {
    x: 120,
    y: 270,
    radius: 18,
    velocity: 0,
    gravity: 0.15,
    flapStrength: -5,
  },
  playerShotTimer: 0,
  playerShotInterval: 700,
};

function getLaneCenter(laneIndex) {
  return GAME.lanes[laneIndex];
}

function resetGame() {
  state.lives = 5;
  state.baseHealth = 5;
  state.coins = 40;
  state.wave = 1;
  state.score = 0;
  state.selectedTopping = null;
  state.orders = [];
  state.turrets = [];
  state.zombies = [];
  state.projectiles = [];
  state.obstacles = [];
  state.player.y = 270;
  state.player.velocity = 0;
  GAME.running = false;
  GAME.paused = false;
  GAME.lastTime = 0;
  GAME.spawnTimer = 0;
  GAME.obstacleTimer = 0;
  GAME.waveTimer = 0;
  GAME.orderTimer = 0;
  updateHud();
  renderOrders();
  renderScene();
  pauseBtn.disabled = true;
}

function startGame() {
  if (!GAME.running) {
    GAME.running = true;
    GAME.paused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.disabled = false;
    GAME.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function pauseGame() {
  if (!GAME.running) return;
  GAME.paused = !GAME.paused;
  pauseBtn.textContent = GAME.paused ? "Resume" : "Pause";
  if (!GAME.paused) {
    GAME.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function updateHud() {
  livesEl.textContent = state.lives;
  baseEl.textContent = state.baseHealth;
  coinsEl.textContent = state.coins;
  waveEl.textContent = state.wave;
  scoreEl.textContent = state.score;
}

function addOrder() {
  const toppings = Object.keys(toppingCatalog);
  const topping = toppings[Math.floor(Math.random() * toppings.length)];
  state.orders.push({ id: crypto.randomUUID(), topping });
  if (state.orders.length > 3) {
    state.orders.shift();
  }
  renderOrders();
}

function renderOrders() {
  ordersList.innerHTML = "";
  state.orders.forEach((order, index) => {
    const item = document.createElement("li");
    item.className = `order-item ${index === 0 ? "active" : ""}`;
    const info = toppingCatalog[order.topping];
    item.innerHTML = `<span>${info.emoji} ${info.label}</span><span>+${10 + index * 5} coins</span>`;
    ordersList.appendChild(item);
  });
}

function selectTopping(topping) {
  state.selectedTopping = topping;
  shopButtons.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.topping === topping);
  });
}

function placeTurret(laneIndex, columnIndex) {
  const topping = state.selectedTopping;
  if (!topping) return;
  const config = toppingCatalog[topping];
  if (state.coins < config.cost) return;

  const laneY = getLaneCenter(laneIndex);
  const turretX = GAME.turretXPositions[columnIndex];
  if (turretX === undefined) return;
  const existing = state.turrets.find(
    (t) => t.laneIndex === laneIndex && t.columnIndex === columnIndex
  );
  if (existing) return;

  state.coins -= config.cost;
  state.turrets.push({
    topping,
    laneIndex,
    columnIndex,
    x: turretX,
    y: laneY,
    cooldown: 0,
    shotsLeft: config.shots,
  });

  const topOrder = state.orders[0];
  if (topOrder && topOrder.topping === topping) {
    state.orders.shift();
    state.coins += 25;
    state.score += 50;
    renderOrders();
  }

  updateHud();
}

function spawnZombie() {
  const laneIndex = Math.floor(Math.random() * GAME.lanes.length);
  const laneY = getLaneCenter(laneIndex);
  const speed = 0.9 + state.wave * 0.1;
  const health = 3 + state.wave;
  state.zombies.push({
    x: GAME.width + 40,
    y: laneY,
    laneIndex,
    speed,
    health,
    maxHealth: health,
  });
}

function spawnObstacle() {
  const y = 80 + Math.random() * 380;
  state.obstacles.push({
    x: GAME.width + 60,
    y,
    width: 30,
    height: 100,
    speed: 1.5,
    rewarded: false,
  });
}

function fireProjectile(turret, delta) {
  if (turret.shotsLeft <= 0) return;
  turret.cooldown -= delta;
  const hasTarget = state.zombies.some(
    (zombie) => zombie.laneIndex === turret.laneIndex && zombie.x > turret.x - 10
  );
  if (!hasTarget) return;
  if (turret.cooldown > 0) return;
  const config = toppingCatalog[turret.topping];
  turret.cooldown = config.fireRate;
  state.projectiles.push({
    x: turret.x + 20,
    y: turret.y,
    speed: 5.5,
    damage: config.damage,
    laneIndex: turret.laneIndex,
  });
  turret.shotsLeft -= 1;
}

function updatePlayer(delta) {
  state.player.velocity += state.player.gravity;
  state.player.y += state.player.velocity;

  if (state.player.y < 40) {
    state.player.y = 40;
    state.player.velocity = 0;
    state.lives = 0;
    updateHud();
  }
  if (state.player.y > GAME.height - 40) {
    state.player.y = GAME.height - 40;
    state.player.velocity = 0;
    state.lives = 0;
    updateHud();
  }
}

function checkCollisions() {
  const player = state.player;

  state.obstacles = state.obstacles.filter((obs) => {
    const hit =
      player.x + player.radius > obs.x &&
      player.x - player.radius < obs.x + obs.width &&
      player.y + player.radius > obs.y &&
      player.y - player.radius < obs.y + obs.height;
    if (hit) {
      state.lives -= 1;
      updateHud();
      return false;
    }
    return true;
  });

  state.zombies = state.zombies.filter((zombie) => {
    if (zombie.x < 60) {
      state.baseHealth -= 1;
      updateHud();
      return false;
    }
    return zombie.health > 0;
  });

  if (state.lives <= 0 || state.baseHealth <= 0) {
    GAME.running = false;
    pauseBtn.disabled = true;
  }
}

function update(delta) {
  GAME.spawnTimer += delta;
  GAME.obstacleTimer += delta;
  GAME.waveTimer += delta;
  GAME.orderTimer += delta;
  state.playerShotTimer += delta;

  const spawnInterval = Math.max(
    GAME.minSpawnInterval,
    GAME.baseSpawnInterval - state.wave * GAME.spawnRampPerWave
  );

  if (GAME.spawnTimer > spawnInterval) {
    GAME.spawnTimer = 0;
    spawnZombie();
  }

  if (GAME.obstacleTimer > 2400) {
    GAME.obstacleTimer = 0;
    spawnObstacle();
  }

  if (GAME.waveTimer > 22000) {
    GAME.waveTimer = 0;
    state.wave += 1;
    state.coins += 20;
  }

  if (GAME.orderTimer > 7000) {
    GAME.orderTimer = 0;
    addOrder();
  }

  updatePlayer(delta);

  state.zombies.forEach((zombie) => {
    zombie.x -= zombie.speed;
  });

  state.obstacles.forEach((obs) => {
    obs.x -= obs.speed;
    if (!obs.rewarded && obs.x + obs.width < state.player.x - state.player.radius) {
      obs.rewarded = true;
      state.coins += 2;
      state.score += 5;
    }
  });

  state.turrets.forEach((turret) => fireProjectile(turret, delta));
  state.turrets = state.turrets.filter((turret) => turret.shotsLeft > 0);

  state.projectiles.forEach((shot) => {
    shot.x += shot.speed;
  });

  state.projectiles = state.projectiles.filter((shot) => shot.x < GAME.width + 50);

  state.projectiles.forEach((shot) => {
    state.zombies.forEach((zombie) => {
      if (zombie.laneIndex !== shot.laneIndex) return;
      const hit = Math.abs(zombie.x - shot.x) < 18 && Math.abs(zombie.y - shot.y) < 18;
      if (hit) {
        zombie.health -= shot.damage;
        shot.x = GAME.width + 100;
        if (zombie.health <= 0) {
          state.coins += 6;
          state.score += 20;
        }
      }
    });
  });


  state.zombies = state.zombies.filter((zombie) => zombie.health > 0);

  state.obstacles = state.obstacles.filter((obs) => obs.x > -60);

  checkCollisions();
  updateHud();
}

function renderScene() {
  ctx.clearRect(0, 0, GAME.width, GAME.height);

  // Danger zones (fire/flames at top and bottom)
  ctx.fillStyle = "rgba(255, 69, 0, 0.3)";
  ctx.fillRect(0, 0, GAME.width, 80);
  ctx.fillRect(0, GAME.height - 40, GAME.width, 40);

  // Flame graphics at top
  for (let i = 0; i < GAME.width; i += 40) {
    ctx.fillStyle = "rgba(255, 140, 0, 0.6)";
    ctx.beginPath();
    ctx.moveTo(i, 75);
    ctx.lineTo(i + 15, 50);
    ctx.lineTo(i + 30, 75);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 200, 0, 0.5)";
    ctx.beginPath();
    ctx.moveTo(i + 5, 70);
    ctx.lineTo(i + 15, 55);
    ctx.lineTo(i + 25, 70);
    ctx.fill();
  }

  // Flame graphics at bottom
  for (let i = 0; i < GAME.width; i += 40) {
    ctx.fillStyle = "rgba(255, 140, 0, 0.6)";
    ctx.beginPath();
    ctx.moveTo(i, GAME.height - 40);
    ctx.lineTo(i + 15, GAME.height - 15);
    ctx.lineTo(i + 30, GAME.height - 40);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 200, 0, 0.5)";
    ctx.beginPath();
    ctx.moveTo(i + 5, GAME.height - 35);
    ctx.lineTo(i + 15, GAME.height - 20);
    ctx.lineTo(i + 25, GAME.height - 35);
    ctx.fill();
  }

  ctx.fillStyle = "#1f2640";
  ctx.fillRect(0, 80, GAME.width, 420);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  GAME.lanes.forEach((laneY) => {
    ctx.beginPath();
    ctx.moveTo(0, laneY + 40);
    ctx.lineTo(GAME.width, laneY + 40);
    ctx.stroke();
  });

  // Turret placement pads (two columns per lane)
  GAME.lanes.forEach((laneY) => {
    GAME.turretXPositions.forEach((turretX) => {
      ctx.fillStyle = "rgba(46,196,182,0.18)";
      ctx.strokeStyle = "rgba(46,196,182,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(turretX - 28, laneY - 28, 56, 56, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "12px Segoe UI";
      ctx.fillText("PLACE", turretX - 18, laneY + 42);
    });
  });

  ctx.fillStyle = "#3e2b1d";
  ctx.fillRect(0, 0, GAME.width, 80);
  ctx.fillStyle = "#e7a84b";
  ctx.font = "20px Segoe UI";
  ctx.fillText("Flappy's Pizza Skyway", 20, 50);

  state.turrets.forEach((turret) => {
    const config = toppingCatalog[turret.topping];
    ctx.fillStyle = "#2ec4b6";
    ctx.beginPath();
    ctx.arc(turret.x, turret.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101010";
    ctx.font = "14px Segoe UI";
    ctx.fillText(config.emoji, turret.x - 8, turret.y + 5);
  });

  state.projectiles.forEach((shot) => {
    ctx.fillStyle = "#ff9f1c";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });


  state.zombies.forEach((zombie) => {
    ctx.fillStyle = "#7bc96f";
    ctx.beginPath();
    ctx.roundRect(zombie.x - 16, zombie.y - 20, 32, 40, 6);
    ctx.fill();

    const healthRatio = zombie.health / zombie.maxHealth;
    ctx.fillStyle = "#111";
    ctx.fillRect(zombie.x - 18, zombie.y - 30, 36, 6);
    ctx.fillStyle = "#ff5757";
    ctx.fillRect(zombie.x - 18, zombie.y - 30, 36 * healthRatio, 6);
  });

  state.obstacles.forEach((obs) => {
    ctx.fillStyle = "#9e6a3a";
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.fillStyle = "#f0c27b";
    ctx.fillRect(obs.x + 6, obs.y + 10, obs.width - 12, obs.height - 20);
  });

  const player = state.player;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(player.x + 6, player.y - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  if (!GAME.running) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    ctx.fillStyle = "#fff";
    ctx.font = "28px Segoe UI";
    const message =
      state.lives <= 0
        ? "Flappy Down!"
        : state.baseHealth <= 0
          ? "Kitchen Overrun"
          : "Click Start";
    ctx.fillText(message, GAME.width / 2 - 120, GAME.height / 2);
  }
}

function gameLoop(timestamp) {
  if (!GAME.running || GAME.paused) return;
  const delta = timestamp - GAME.lastTime;
  GAME.lastTime = timestamp;
  update(delta);
  renderScene();
  requestAnimationFrame(gameLoop);
}

function handleFlap() {
  if (!GAME.running) return;
  state.player.velocity = state.player.flapStrength;
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * GAME.width;
  const y = ((event.clientY - rect.top) / rect.height) * GAME.height;
  const laneIndex = GAME.lanes.findIndex((laneY) => Math.abs(laneY - y) < 50);
  const columnIndex = GAME.turretXPositions.findIndex(
    (turretX) => Math.abs(turretX - x) < 40
  );
  if (laneIndex !== -1 && columnIndex !== -1) {
    placeTurret(laneIndex, columnIndex);
  }
}

startBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", pauseGame);

canvas.addEventListener("click", (event) => {
  handleCanvasClick(event);
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    handleFlap();
  }
});

shopButtons.forEach((btn) => {
  btn.addEventListener("click", () => selectTopping(btn.dataset.topping));
});

addOrder();
addOrder();
renderOrders();
renderScene();
updateHud();
