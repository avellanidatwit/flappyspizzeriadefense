// ============================================================================
// DOM ELEMENTS
// ============================================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const UI = {
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  ordersList: document.getElementById("ordersList"),
  lives: document.getElementById("lives"),
  base: document.getElementById("base"),
  coins: document.getElementById("coins"),
  wave: document.getElementById("wave"),
  score: document.getElementById("score"),
  highScore: document.getElementById("highScore"),
  shopButtons: document.querySelectorAll(".shop-btn"),
};

// ============================================================================
// GAME CONSTANTS
// ============================================================================

const CANVAS = {
  width: canvas.width,
  height: canvas.height,
};

const LANES = [140, 270, 400];
const TURRET_X_POSITIONS = [220, 360];

const GAME_CONFIG = {
  running: false,
  paused: false,
  lastTime: 0,
  spawnTimer: 0,
  obstacleTimer: 0,
  waveTimer: 0,
  baseSpawnInterval: 6000,
  minSpawnInterval: 5000,
  hazardLineHeight: 8,
  spawnRampPerWave: 200,
};

const TOPPINGS = {
  pepperoni: { label: "Pepperoni", emoji: "🍕", cost: 30, damage: 2, fireRate: 500, shots: 10 },
  mushroom: { label: "Mushroom", emoji: "🍄", cost: 20, damage: 1, fireRate: 200, shots: 20 },
  olive: { label: "Olive", emoji: "🫒", cost: 40, damage: 5, fireRate: 1200, shots: 5 },
};

const PHYSICS = {
  gravity: 0.15,
  flapStrength: -5,
  playerRadius: 18,
  projectileSpeed: 5.5,
  projectileRadius: 6,
};

const TIMINGS = {
  obstacleSpawnInterval: 2400,
  waveInterval: 22000,
  speedBoostDuration: 10000,
  sizeBoostDuration: 10000,
  gravityReverseDuration: 8000,
  coinSpawnChance: 0.002,
};

const COLORS = {
  hazard: "#ff0000",
  background: "#1f2640",
  turret: "#2ec4b6",
  turretPad: "rgba(46,196,182,0.18)",
  turretPadBorder: "rgba(46,196,182,0.5)",
  projectile: "#ff9f1c",
  zombie: "#7bc96f",
  zombieHealth: "#ff5757",
  obstacle: "#9e6a3a",
  obstacleFill: "#f0c27b",
  player: "#ffd166",
  speedBoost: "#FF1493",
  sizeBoost: "#00FF00",
  gravityReverse: "#9D4EDD",
  coin: "#FFD700",
  coinStroke: "#FFA500",
  text: "#ffffff",
  overlay: "rgba(0,0,0,0.6)",
};

// ============================================================================
// GAME STATE
// ============================================================================

const GameState = {
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
  gravityReverseActive: false,
  gravityReverseTimer: 0,
  player: {
    x: 120,
    y: 270,
    radius: PHYSICS.playerRadius,
    velocity: 0,
  },
};

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function getLaneCenter(laneIndex) {
  return LANES[laneIndex];
}

function getToppingConfig(topping) {
  return TOPPINGS[topping];
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function generateId() {
  return crypto.randomUUID();
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function circlesCollide(x1, y1, r1, x2, y2, r2) {
  return distance(x1, y1, x2, y2) < r1 + r2;
}

function rectCollide(x1, y1, w1, h1, x2, y2, r2) {
  return (
    x1 + w1 > x2 - r2 &&
    x1 < x2 + r2 &&
    y1 + h1 > y2 - r2 &&
    y1 < y2 + r2
  );
}

// ============================================================================
// GAME STATE MANAGEMENT
// ============================================================================

function resetGameState() {
  GameState.lives = 5;
  GameState.baseHealth = 5;
  GameState.coins = 40;
  GameState.wave = 1;
  GameState.score = 0;
  GameState.selectedTopping = null;
  GameState.orders = [];
  GameState.turrets = [];
  GameState.zombies = [];
  GameState.projectiles = [];
  GameState.obstacles = [];
  GameState.collectibleCoins = [];
  GameState.speedBoostActive = false;
  GameState.speedBoostTimer = 0;
  GameState.sizeBoostActive = false;
  GameState.sizeBoostTimer = 0;
  GameState.gravityReverseActive = false;
  GameState.gravityReverseTimer = 0;
  GameState.player.y = 270;
  GameState.player.velocity = 0;
}

function initializeGameConfig() {
  GAME_CONFIG.running = false;
  GAME_CONFIG.paused = false;
  GAME_CONFIG.lastTime = 0;
  GAME_CONFIG.spawnTimer = 0;
  GAME_CONFIG.obstacleTimer = 0;
  GAME_CONFIG.waveTimer = 0;
}

// ============================================================================
// ORDER SYSTEM
// ============================================================================

function addOrderBatch() {
  for (let i = 0; i < 2; i++) {
    const toppingKeys = Object.keys(TOPPINGS);
    const topping = toppingKeys[Math.floor(Math.random() * toppingKeys.length)];
    GameState.orders.push({ id: generateId(), topping });
  }
  if (GameState.orders.length > 10) {
    GameState.orders = GameState.orders.slice(-10);
  }
  renderOrders();
}

function completeTopOrder(topping) {
  if (GameState.orders.length === 0) return false;
  const topOrder = GameState.orders[0];
  if (topOrder.topping === topping) {
    GameState.orders.shift();
    GameState.coins += 25;
    GameState.score += 50;
    renderOrders();
    return true;
  }
  return false;
}

function renderOrders() {
  UI.ordersList.innerHTML = "";
  GameState.orders.forEach((order, index) => {
    const item = document.createElement("li");
    item.className = `order-item ${index === 0 ? "active" : ""}`;
    const info = getToppingConfig(order.topping);
    item.innerHTML = `<span>${info.emoji} ${info.label}</span><span>+${10 + index * 5} coins</span>`;
    UI.ordersList.appendChild(item);
  });
}

// ============================================================================
// UI & HUD
// ============================================================================

function updateHUD() {
  UI.lives.textContent = GameState.lives;
  UI.base.textContent = GameState.baseHealth;
  UI.coins.textContent = GameState.coins;
  UI.wave.textContent = GameState.wave;
  UI.score.textContent = GameState.score;
  UI.highScore.textContent = GameState.highScore;
}

function selectTopping(topping) {
  GameState.selectedTopping = topping;
  UI.shopButtons.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.topping === topping);
  });
}

// ============================================================================
// TURRET SYSTEM
// ============================================================================

function placeTurret(laneIndex, columnIndex) {
  const topping = GameState.selectedTopping;
  if (!topping) return;
  
  const config = getToppingConfig(topping);
  if (GameState.coins < config.cost) return;

  const laneY = getLaneCenter(laneIndex);
  const turretX = TURRET_X_POSITIONS[columnIndex];
  if (turretX === undefined) return;
  
  // Check if turret already exists
  if (GameState.turrets.some((t) => t.laneIndex === laneIndex && t.columnIndex === columnIndex)) {
    return;
  }

  GameState.coins -= config.cost;
  GameState.turrets.push({
    topping,
    laneIndex,
    columnIndex,
    x: turretX,
    y: laneY,
    cooldown: 0,
    shotsLeft: config.shots,
  });

  if (completeTopOrder(topping)) {
    GameState.coins += 25;
  }

  updateHUD();
}

function fireProjectile(turret, delta) {
  if (turret.shotsLeft <= 0) return;
  
  turret.cooldown -= delta;
  
  // Check if turret has a target
  const hasTarget = GameState.zombies.some(
    (zombie) => zombie.laneIndex === turret.laneIndex && zombie.x > turret.x - 10
  );
  if (!hasTarget) return;
  
  const config = getToppingConfig(turret.topping);
  let fireRate = config.fireRate;
  
  if (GameState.speedBoostActive) {
    fireRate = fireRate / 2;
  }
  
  if (turret.cooldown > 0) return;
  
  turret.cooldown = fireRate;
  GameState.projectiles.push({
    x: turret.x + 20,
    y: turret.y,
    speed: PHYSICS.projectileSpeed,
    damage: config.damage,
    laneIndex: turret.laneIndex,
  });
  turret.shotsLeft -= 1;
}

// ============================================================================
// ENEMY SYSTEM (ZOMBIES)
// ============================================================================

function spawnZombieWave() {
  const zombiesPerLane = 2 + Math.floor(Math.random() * 4);
  const speed = 0.9 + GameState.wave * 0.1;
  const health = 3 + GameState.wave;
  
  for (let laneIndex = 0; laneIndex < LANES.length; laneIndex++) {
    for (let i = 0; i < zombiesPerLane; i++) {
      const laneY = getLaneCenter(laneIndex);
      GameState.zombies.push({
        x: CANVAS.width + 40 + (i * 60),
        y: laneY,
        laneIndex,
        speed,
        health,
        maxHealth: health,
      });
    }
  }
}

function updateZombies() {
  GameState.zombies.forEach((zombie) => {
    zombie.x -= zombie.speed;
  });
}

// ============================================================================
// OBSTACLE SYSTEM
// ============================================================================

function spawnObstacle() {
  const y = randomRange(80, 460);
  GameState.obstacles.push({
    x: CANVAS.width + 60,
    y,
    width: 30,
    height: 100,
    speed: 1.5,
    rewarded: false,
  });
}

function updateObstacles() {
  GameState.obstacles.forEach((obs) => {
    obs.x -= obs.speed;
    
    if (!obs.rewarded && obs.x + obs.width < GameState.player.x - GameState.player.radius) {
      obs.rewarded = true;
      GameState.coins += 2;
      GameState.score += 5;
    }
  });
}

// ============================================================================
// COLLECTIBLE SYSTEM
// ============================================================================

function spawnCollectibleCoin() {
  const y = randomRange(80, 460);
  const rand = Math.random();
  let type = "coin";
  
  if (rand < 0.08) {
    type = "speedboost";
  } else if (rand < 0.13) {
    type = "sizeboost";
  } else if (rand < 0.18) {
    type = "gravityreverse";
  }
  
  GameState.collectibleCoins.push({
    x: CANVAS.width + 40,
    y,
    radius: 15,
    speed: 1.5,
    collected: false,
    type,
  });
}

function updateCollectibles() {
  GameState.collectibleCoins.forEach((coin) => {
    coin.x -= coin.speed;
  });
}

function applyCollectibleBoost(coin) {
  if (coin.type === "speedboost") {
    GameState.speedBoostActive = true;
    GameState.speedBoostTimer = TIMINGS.speedBoostDuration;
    GameState.score += 25;
  } else if (coin.type === "sizeboost") {
    GameState.sizeBoostActive = true;
    GameState.sizeBoostTimer = TIMINGS.sizeBoostDuration;
    GameState.score += 25;
  } else if (coin.type === "gravityreverse") {
    GameState.gravityReverseActive = true;
    GameState.gravityReverseTimer = TIMINGS.gravityReverseDuration;
    GameState.score += 30;
  } else {
    GameState.coins += 5;
    GameState.score += 10;
  }
}

// ============================================================================
// PLAYER SYSTEM
// ============================================================================

function updatePlayer(delta) {
  const gravityMultiplier = GameState.gravityReverseActive ? -1 : 1;
  GameState.player.velocity += PHYSICS.gravity * gravityMultiplier;
  GameState.player.y += GameState.player.velocity;

  // Check collision with hazard lines
  const hazardHeight = GAME_CONFIG.hazardLineHeight;
  if (GameState.player.y - GameState.player.radius <= hazardHeight) {
    GameState.lives = 0;
  }
  if (GameState.player.y + GameState.player.radius >= CANVAS.height - hazardHeight) {
    GameState.lives = 0;
  }
}

function flap() {
  if (!GAME_CONFIG.running) return;
  GameState.player.velocity = PHYSICS.flapStrength;
}

// ============================================================================
// COLLISION & DAMAGE
// ============================================================================

function checkPlayerCollisions() {
  const player = GameState.player;

  // Collectible coins
  GameState.collectibleCoins = GameState.collectibleCoins.filter((coin) => {
    const hit = circlesCollide(
      player.x, player.y, player.radius,
      coin.x, coin.y, coin.radius
    );
    
    if (hit) {
      applyCollectibleBoost(coin);
      updateHUD();
      return false;
    }
    return true;
  });

  // Obstacles
  GameState.obstacles = GameState.obstacles.filter((obs) => {
    const hit = rectCollide(
      obs.x, obs.y, obs.width, obs.height,
      player.x, player.y, player.radius
    );
    
    if (hit) {
      GameState.lives -= 1;
      updateHUD();
      return false;
    }
    return true;
  });

  // Zombies reaching base
  GameState.zombies = GameState.zombies.filter((zombie) => {
    if (zombie.x < 60) {
      GameState.baseHealth -= 1;
      updateHUD();
      return false;
    }
    return zombie.health > 0;
  });
}

function checkGameOver() {
  if (GameState.lives <= 0 || GameState.baseHealth <= 0) {
    GAME_CONFIG.running = false;
    UI.pauseBtn.disabled = true;
  }
}

function updateProjectileCollisions() {
  GameState.projectiles.forEach((shot) => {
    GameState.zombies.forEach((zombie) => {
      if (zombie.laneIndex !== shot.laneIndex) return;
      
      const hit = Math.abs(zombie.x - shot.x) < 18 && Math.abs(zombie.y - shot.y) < 18;
      
      if (hit) {
        zombie.health -= shot.damage;
        shot.x = CANVAS.width + 100;
        
        if (zombie.health <= 0) {
          GameState.coins += 6;
          GameState.score += 20;
        }
      }
    });
  });
}

// ============================================================================
// BOOST SYSTEM
// ============================================================================

function updateBoosts(delta) {
  if (GameState.speedBoostActive) {
    GameState.speedBoostTimer -= delta;
    if (GameState.speedBoostTimer <= 0) {
      GameState.speedBoostActive = false;
    }
  }

  if (GameState.sizeBoostActive) {
    GameState.sizeBoostTimer -= delta;
    if (GameState.sizeBoostTimer <= 0) {
      GameState.sizeBoostActive = false;
    }
  }

  if (GameState.gravityReverseActive) {
    GameState.gravityReverseTimer -= delta;
    if (GameState.gravityReverseTimer <= 0) {
      GameState.gravityReverseActive = false;
    }
  }
}

// ============================================================================
// GAME LOOP
// ============================================================================

function resetGame() {
  resetGameState();
  initializeGameConfig();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  updateHUD();
  renderOrders();
  renderScene();
  UI.pauseBtn.disabled = true;
}

function startGame() {
  if (!GAME_CONFIG.running) {
    GAME_CONFIG.running = true;
    GAME_CONFIG.paused = false;
    UI.pauseBtn.textContent = "Pause";
    UI.pauseBtn.disabled = false;
    GAME_CONFIG.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function pauseGame() {
  if (!GAME_CONFIG.running) return;
  GAME_CONFIG.paused = !GAME_CONFIG.paused;
  UI.pauseBtn.textContent = GAME_CONFIG.paused ? "Resume" : "Pause";
  if (!GAME_CONFIG.paused) {
    GAME_CONFIG.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function updateGameLogic(delta) {
  GAME_CONFIG.spawnTimer += delta;
  GAME_CONFIG.obstacleTimer += delta;
  GAME_CONFIG.waveTimer += delta;

  const spawnInterval = Math.max(
    GAME_CONFIG.minSpawnInterval,
    GAME_CONFIG.baseSpawnInterval - GameState.wave * GAME_CONFIG.spawnRampPerWave
  );

  if (GAME_CONFIG.spawnTimer > spawnInterval) {
    GAME_CONFIG.spawnTimer = 0;
    spawnZombieWave();
  }

  if (GAME_CONFIG.obstacleTimer > TIMINGS.obstacleSpawnInterval) {
    GAME_CONFIG.obstacleTimer = 0;
    spawnObstacle();
  }

  if (GAME_CONFIG.waveTimer > TIMINGS.waveInterval) {
    GAME_CONFIG.waveTimer = 0;
    GameState.wave += 1;
    GameState.coins += 20;
  }

  if (Math.random() < TIMINGS.coinSpawnChance) {
    spawnCollectibleCoin();
  }

  updateBoosts(delta);
  updatePlayer(delta);
  updateZombies();
  updateObstacles();
  updateCollectibles();

  GameState.turrets.forEach((turret) => fireProjectile(turret, delta));
  GameState.turrets = GameState.turrets.filter((turret) => turret.shotsLeft > 0);

  GameState.projectiles.forEach((shot) => {
    shot.x += shot.speed;
  });

  GameState.projectiles = GameState.projectiles.filter((shot) => shot.x < CANVAS.width + 50);

  updateProjectileCollisions();

  GameState.zombies = GameState.zombies.filter((zombie) => zombie.health > 0);
  GameState.obstacles = GameState.obstacles.filter((obs) => obs.x > -60);
  GameState.collectibleCoins = GameState.collectibleCoins.filter((coin) => coin.x > -30);

  checkPlayerCollisions();
  checkGameOver();
  updateHUD();
  
  if (GameState.score > GameState.highScore) {
    GameState.highScore = GameState.score;
    localStorage.setItem("flappyHighScore", GameState.highScore);
  }
}

function gameLoop(timestamp) {
  if (!GAME_CONFIG.running || GAME_CONFIG.paused) return;
  
  const delta = timestamp - GAME_CONFIG.lastTime;
  GAME_CONFIG.lastTime = timestamp;
  
  updateGameLogic(delta);
  renderScene();
  requestAnimationFrame(gameLoop);
}

// ============================================================================
// RENDERING SYSTEM
// ============================================================================

function drawHazardLines() {
  ctx.fillStyle = COLORS.hazard;
  ctx.fillRect(0, 0, CANVAS.width, GAME_CONFIG.hazardLineHeight);
  ctx.fillRect(0, CANVAS.height - GAME_CONFIG.hazardLineHeight, CANVAS.width, GAME_CONFIG.hazardLineHeight);
  
  ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = COLORS.hazard;
  ctx.fillRect(0, 0, CANVAS.width, GAME_CONFIG.hazardLineHeight);
  ctx.fillRect(0, CANVAS.height - GAME_CONFIG.hazardLineHeight, CANVAS.width, GAME_CONFIG.hazardLineHeight);
  ctx.shadowBlur = 0;
}

function drawBackground() {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 80, CANVAS.width, 420);
  
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  LANES.forEach((laneY) => {
    ctx.beginPath();
    ctx.moveTo(0, laneY + 40);
    ctx.lineTo(CANVAS.width, laneY + 40);
    ctx.stroke();
  });
}

function drawTurretPads() {
  LANES.forEach((laneY) => {
    TURRET_X_POSITIONS.forEach((turretX) => {
      ctx.fillStyle = COLORS.turretPad;
      ctx.strokeStyle = COLORS.turretPadBorder;
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
}

function drawTurrets() {
  GameState.turrets.forEach((turret) => {
    const config = getToppingConfig(turret.topping);
    ctx.fillStyle = COLORS.turret;
    ctx.beginPath();
    ctx.arc(turret.x, turret.y, 18, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#101010";
    ctx.font = "14px Segoe UI";
    ctx.fillText(config.emoji, turret.x - 8, turret.y + 5);
  });
}

function drawProjectiles() {
  GameState.projectiles.forEach((shot) => {
    ctx.fillStyle = COLORS.projectile;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, PHYSICS.projectileRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawZombies() {
  GameState.zombies.forEach((zombie) => {
    ctx.fillStyle = COLORS.zombie;
    ctx.beginPath();
    ctx.roundRect(zombie.x - 16, zombie.y - 20, 32, 40, 6);
    ctx.fill();

    const healthRatio = zombie.health / zombie.maxHealth;
    ctx.fillStyle = "#111";
    ctx.fillRect(zombie.x - 18, zombie.y - 30, 36, 6);
    ctx.fillStyle = COLORS.zombieHealth;
    ctx.fillRect(zombie.x - 18, zombie.y - 30, 36 * healthRatio, 6);
  });
}

function drawObstacles() {
  GameState.obstacles.forEach((obs) => {
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.fillStyle = COLORS.obstacleFill;
    ctx.fillRect(obs.x + 6, obs.y + 10, obs.width - 12, obs.height - 20);
  });
}

function drawCollectibles() {
  GameState.collectibleCoins.forEach((coin) => {
    if (coin.type === "speedboost") {
      ctx.fillStyle = COLORS.speedBoost;
      ctx.shadowColor = COLORS.speedBoost;
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
      ctx.fillStyle = COLORS.sizeBoost;
      ctx.shadowColor = COLORS.sizeBoost;
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
    } else if (coin.type === "gravityreverse") {
      ctx.fillStyle = COLORS.gravityReverse;
      ctx.shadowColor = COLORS.gravityReverse;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 18px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⇅", coin.x, coin.y);
    } else {
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.coinStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

function drawPlayer() {
  const player = GameState.player;
  ctx.fillStyle = COLORS.player;
  const playerRadius = GameState.sizeBoostActive ? player.radius * 2 : player.radius;
  ctx.beginPath();
  ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(player.x + 6, player.y - 4, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGameOverScreen() {
  if (GAME_CONFIG.running) return;
  
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.fillStyle = COLORS.text;
  ctx.font = "28px Segoe UI";
  
  const message =
    GameState.lives <= 0
      ? "Flappy Down!"
      : GameState.baseHealth <= 0
        ? "Kitchen Overrun"
        : "Click Start";
  
  ctx.fillText(message, CANVAS.width / 2 - 120, CANVAS.height / 2);
}

function renderScene() {
  ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);

  drawHazardLines();
  drawBackground();
  drawTurretPads();
  drawTurrets();
  drawProjectiles();
  drawZombies();
  drawObstacles();
  drawCollectibles();
  drawPlayer();
  drawGameOverScreen();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * CANVAS.width;
  const y = ((event.clientY - rect.top) / rect.height) * CANVAS.height;
  
  const laneIndex = LANES.findIndex((laneY) => Math.abs(laneY - y) < 50);
  const columnIndex = TURRET_X_POSITIONS.findIndex(
    (turretX) => Math.abs(turretX - x) < 40
  );
  
  if (laneIndex !== -1 && columnIndex !== -1) {
    placeTurret(laneIndex, columnIndex);
  }
}

function registerEventHandlers() {
  UI.startBtn.addEventListener("click", startGame);
  UI.resetBtn.addEventListener("click", resetGame);
  UI.pauseBtn.addEventListener("click", pauseGame);

  canvas.addEventListener("click", handleCanvasClick);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      flap();
    }
  });

  UI.shopButtons.forEach((btn) => {
    btn.addEventListener("click", () => selectTopping(btn.dataset.topping));
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeGame() {
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  addOrderBatch();
  renderOrders();
  renderScene();
  updateHUD();
}

registerEventHandlers();
initializeGame();