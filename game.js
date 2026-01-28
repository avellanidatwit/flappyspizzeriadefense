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
const highScoreEl = document.getElementById("highScore");

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
  baseSpawnInterval: 6000,
  minSpawnInterval: 5000,
  hazardLineHeight: 8, // Height of red hazard lines
};

const toppingCatalog = {
  pepperoni: { label: "Pepperoni", emoji: "🍕", cost: 30, damage: 2, fireRate: 500, shots: 10 },
  mushroom: { label: "Mushroom", emoji: "🍄", cost: 20, damage: 1, fireRate: 200, shots: 20 },
  olive: { label: "Olive", emoji: "🫒", cost: 40, damage: 5, fireRate: 1200, shots: 5 },
};

const state = {
  lives: 5,
  baseHealth: 5,
  coins: 40,
  wave: 1,
  score: 0,
  highScore: localStorage.getItem("flappyHighScore") ? parseInt(localStorage.getItem("flappyHighScore")) : 0,
  selectedTopping: null,
  orders: [],
  turrets: [],
  zombies: [],
  projectiles: [],
  obstacles: [],
  collectibleCoins: [],
  speedBoostActive: false,
  speedBoostTimer: 0,
  sizeBoostActive: false,
  sizeBoostTimer: 0,
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
  state.collectibleCoins = [];
  state.speedBoostActive = false;
  state.speedBoostTimer = 0;
  state.sizeBoostActive = false;
  state.sizeBoostTimer = 0;
  state.player.y = 270;
  state.player.velocity = 0;
  GAME.running = false;
  GAME.paused = false;
  GAME.lastTime = 0;
  GAME.spawnTimer = 0;
  GAME.obstacleTimer = 0;
  GAME.waveTimer = 0;
  GAME.orderTimer = 0;
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
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
  highScoreEl.textContent = state.highScore;
}

function addOrder() {
  const toppings = Object.keys(toppingCatalog);
  const topping = toppings[Math.floor(Math.random() * toppings.length)];
  state.orders.push({ id: crypto.randomUUID(), topping });
  if (state.orders.length > 10) {
    state.orders.shift();
  }
  renderOrders();
}

function addOrderBatch() {
  // Add exactly 2 orders to the bottom of the list
  for (let i = 0; i < 2; i++) {
    const toppings = Object.keys(toppingCatalog);
    const topping = toppings[Math.floor(Math.random() * toppings.length)];
    state.orders.push({ id: crypto.randomUUID(), topping });
  }
  // Keep only the 10 most recent orders
  if (state.orders.length > 10) {
    state.orders = state.orders.slice(-10);
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

function spawnZombieWave() {
  const zombiesPerLane = 2 + Math.floor(Math.random() * 4); // Random 2-5 zombies per lane
  const speed = 0.9 + state.wave * 0.1;
  const health = 3 + state.wave;
  
  // Spawn zombies spread across each lane
  for (let laneIndex = 0; laneIndex < GAME.lanes.length; laneIndex++) {
    for (let i = 0; i < zombiesPerLane; i++) {
      const laneY = getLaneCenter(laneIndex);
      state.zombies.push({
        x: GAME.width + 40 + (i * 60), // Spread them out horizontally
        y: laneY,
        laneIndex,
        speed,
        health,
        maxHealth: health,
      });
    }
  }
  // Trigger new orders when wave spawns
  addOrderBatch();
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

function spawnCollectibleCoin() {
  const y = 80 + Math.random() * 380;
  const rand = Math.random();
  let type = "coin";
  if (rand < 0.10) {
    type = "speedboost";
  } else if (rand < 0.15) {
    type = "sizeboost";
  }
  state.collectibleCoins.push({
    x: GAME.width + 40,
    y,
    radius: 15,
    speed: 1.5,
    collected: false,
    type: type,
  });
}

function fireProjectile(turret, delta) {
  if (turret.shotsLeft <= 0) return;
  turret.cooldown -= delta;
  const hasTarget = state.zombies.some(
    (zombie) => zombie.laneIndex === turret.laneIndex && zombie.x > turret.x - 10
  );
  if (!hasTarget) return;
  
  const config = toppingCatalog[turret.topping];
  let fireRate = config.fireRate;
  
  // Apply speed boost multiplier if active
  if (state.speedBoostActive) {
    fireRate = fireRate / 2;
  }
  
  if (turret.cooldown > 0) return;
  turret.cooldown = fireRate;
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

  // Check collision with top red hazard line
  if (state.player.y - state.player.radius <= GAME.hazardLineHeight) {
    state.lives = 0;
    updateHud();
  }
  // Check collision with bottom red hazard line
  if (state.player.y + state.player.radius >= GAME.height - GAME.hazardLineHeight) {
    state.lives = 0;
    updateHud();
  }
}

function checkCollisions() {
  const player = state.player;

  state.collectibleCoins = state.collectibleCoins.filter((coin) => {
    const hit =
      player.x + player.radius > coin.x - coin.radius &&
      player.x - player.radius < coin.x + coin.radius &&
      player.y + player.radius > coin.y - coin.radius &&
      player.y - player.radius < coin.y + coin.radius;
    if (hit) {
      if (coin.type === "speedboost") {
        state.speedBoostActive = true;
        state.speedBoostTimer = 10000; // 10 seconds
        state.score += 25;
      } else if (coin.type === "sizeboost") {
        state.sizeBoostActive = true;
        state.sizeBoostTimer = 10000; // 10 seconds
        state.score += 25;
      } else {
        state.coins += 5;
        state.score += 10;
      }
      updateHud();
      return false;
    }
    return true;
  });

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
    spawnZombieWave();
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
    addOrderBatch();
  }

  if (Math.random() < 0.002) {
    spawnCollectibleCoin();
  }

  // Update speed boost timer
  if (state.speedBoostActive) {
    state.speedBoostTimer -= delta;
    if (state.speedBoostTimer <= 0) {
      state.speedBoostActive = false;
    }
  }

  // Update size boost timer
  if (state.sizeBoostActive) {
    state.sizeBoostTimer -= delta;
    if (state.sizeBoostTimer <= 0) {
      state.sizeBoostActive = false;
    }
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

  state.collectibleCoins.forEach((coin) => {
    coin.x -= coin.speed;
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

  state.collectibleCoins = state.collectibleCoins.filter((coin) => coin.x > -30);

  checkCollisions();
  updateHud();
  
  // Update high score if current score is higher
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("flappyHighScore", state.highScore);
  }
}

function renderScene() {
  ctx.clearRect(0, 0, GAME.width, GAME.height);

  // Draw solid red hazard lines at top and bottom
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, GAME.width, GAME.hazardLineHeight);
  ctx.fillRect(0, GAME.height - GAME.hazardLineHeight, GAME.width, GAME.hazardLineHeight);

  // Add shadow/glow effect to make the hazard lines more visible
  ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, GAME.width, GAME.hazardLineHeight);
  ctx.fillRect(0, GAME.height - GAME.hazardLineHeight, GAME.width, GAME.hazardLineHeight);
  ctx.shadowBlur = 0;

  // Draw solid red hazard line at top
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, GAME.width, GAME.hazardLineHeight);

  // Add shadow/glow effect to make the hazard line more visible
  ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, GAME.width, GAME.hazardLineHeight);
  ctx.shadowBlur = 0;

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

  state.collectibleCoins.forEach((coin) => {
    if (coin.type === "speedboost") {
      // Draw powerup with glowing effect
      ctx.fillStyle = "#FF1493";
      ctx.shadowColor = "#FF1493";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚡", coin.x, coin.y);
    } else if (coin.type === "sizeboost") {
      // Draw size boost powerup
      ctx.fillStyle = "#00FF00";
      ctx.shadowColor = "#00FF00";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↔", coin.x, coin.y);
    } else {
      // Draw regular coin
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFA500";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  const player = state.player;
  ctx.fillStyle = "#ffd166";
  const playerRadius = state.sizeBoostActive ? player.radius * 2 : player.radius;
  ctx.beginPath();
  ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
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

addOrderBatch();
addOrderBatch();
addOrderBatch();
addOrderBatch();
addOrderBatch();
renderOrders();
renderScene();
updateHud();
