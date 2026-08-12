'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────

const keys = {};
const justPressed = {};

window.addEventListener('keydown', (e) => {
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Power-up: Disparo Triple
const TRIPLE_SHOT_CHANCE   = 0.2;  // probabilidad de que aparezca al destruir un asteroide
const TRIPLE_SHOT_DURATION = 10;   // segundos que dura el efecto tras recogerlo
const POWERUP_RADIUS       = 16;
const POWERUP_SPEED        = 40;   // px/s, deriva lentamente por el espacio

// Power-up: Escudo Temporal
const SHIELD_CHANCE   = 0.15;
const SHIELD_DURATION = 5;   // segundos, o hasta absorber un impacto

// Power-up: Bomba Nova
const NOVA_BOMB_CHANCE = 0.06;  // ítem escaso: probabilidad baja al destruir un asteroide

// Power-up: Hiperpropulsión
const HYPER_CHANCE      = 0.15;
const HYPER_DURATION    = 8;    // segundos
const HYPER_THRUST_MULT = 2.4;  // multiplicador de aceleración
const HYPER_DRAG        = 0.996; // menos rozamiento → mayor velocidad máxima

const POWERUP_STYLES = {
  triple: { color: '#22d3ee', label: '3X', shape: 'square' },
  shield: { color: '#22ff88', label: 'SH', shape: 'circle' },
  hyper:  { color: '#ffd700', label: 'HS', shape: 'triangle' },
  nova:   { color: '#ff4444', label: 'B',  shape: 'circle' },
};

// Formas prediseñadas (vértices normalizados) para asteroides grandes (tamaño 3)
const LARGE_ASTEROID_SHAPES = [
  [
    [-0.071, -0.980],
    [0.500, -0.729],
    [0.393, -0.229],
    [0.964, -0.050],
    [0.786, 0.557],
    [0.393, 0.664],
    [0.071, 0.986],
    [-0.321, 0.593],
    [-0.714, 0.343],
    [-1.000, -0.014],
    [-0.821, -0.514],
  ],
];

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular (con posibilidad de usar una forma prediseñada en tamaño grande)
    if (size === 3 && Math.random() < 0.3) {
      const shape = LARGE_ASTEROID_SHAPES[randInt(0, LARGE_ASTEROID_SHAPES.length - 1)];
      this.verts = shape.map(([x, y]) => [x * this.radius, y * this.radius]);
    } else {
      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = hyperSpeedActive ? 260 * HYPER_THRUST_MULT : 260;  // px/s²
    const DRAG   = hyperSpeedActive ? HYPER_DRAG : 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (tripleShotActive) {
      const SPREAD = 0.25;
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();

    // Anillo de energía del Escudo Temporal
    if (shieldActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 255, 136, 0.85)';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups (recogibles) ─────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = POWERUP_RADIUS;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * POWERUP_SPEED;
    this.vy = Math.sin(angle) * POWERUP_SPEED;
    this.t = 0;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.t += dt;
  }

  draw() {
    // Parpadeo continuo, igual que el efecto de invencibilidad de la nave
    if (Math.floor(this.t * 6) % 2 === 0) return;

    const style = POWERUP_STYLES[this.type];
    const s = this.radius * 0.75;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = style.color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    if (style.shape === 'circle') {
      ctx.arc(0, 0, s, 0, Math.PI * 2);
    } else if (style.shape === 'triangle') {
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.87, s * 0.6);
      ctx.lineTo(-s * 0.87, s * 0.6);
      ctx.closePath();
    } else {
      ctx.rotate(Math.PI / 4);
      ctx.rect(-s, -s, s * 2, s * 2);
    }
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle   = style.color;
    ctx.font        = 'bold 13px monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, this.x, this.y);
    ctx.textBaseline = 'alphabetic';
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let tripleShotActive, tripleShotTimer, tripleShotSpawnedThisLevel;
let shieldActive, shieldTimer;
let hyperSpeedActive, hyperSpeedTimer;
let novaBombs;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  tripleShotActive = false;
  tripleShotTimer  = 0;
  tripleShotSpawnedThisLevel = false;
  shieldActive     = false;
  shieldTimer      = 0;
  hyperSpeedActive = false;
  hyperSpeedTimer  = 0;
  novaBombs        = 0;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  tripleShotSpawnedThisLevel = false;
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function spawnPowerUp(x, y, type) {
  powerUps.push(new PowerUp(x, y, type));
  if (type === 'triple') tripleShotSpawnedThisLevel = true;
}

function activateTripleShot() {
  tripleShotActive = true;
  tripleShotTimer  = TRIPLE_SHOT_DURATION;
}

function activateShield() {
  shieldActive = true;
  shieldTimer  = SHIELD_DURATION;
}

function activateHyperSpeed() {
  hyperSpeedActive = true;
  hyperSpeedTimer  = HYPER_DURATION;
}

function triggerNovaBomb() {
  if (novaBombs <= 0) return;
  novaBombs--;
  for (const a of asteroids) {
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
  }
  asteroids = [];
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Bomba Nova (uso manual, requiere tener al menos una en inventario)
  if (pressed('KeyB') && novaBombs > 0) {
    triggerNovaBomb();
  }

  if (tripleShotActive) {
    tripleShotTimer -= dt;
    if (tripleShotTimer <= 0) tripleShotActive = false;
  }

  if (shieldActive) {
    shieldTimer -= dt;
    if (shieldTimer <= 0) shieldActive = false;
  }

  if (hyperSpeedActive) {
    hyperSpeedTimer -= dt;
    if (hyperSpeedTimer <= 0) hyperSpeedActive = false;
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  let lastDestroyedX = ship.x, lastDestroyedY = ship.y;
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        lastDestroyedX = a.x;
        lastDestroyedY = a.y;
        if (powerUps.length === 0) {
          if (!tripleShotSpawnedThisLevel && !tripleShotActive && Math.random() < TRIPLE_SHOT_CHANCE) {
            spawnPowerUp(a.x, a.y, 'triple');
          } else if (!shieldActive && Math.random() < SHIELD_CHANCE) {
            spawnPowerUp(a.x, a.y, 'shield');
          } else if (!hyperSpeedActive && Math.random() < HYPER_CHANCE) {
            spawnPowerUp(a.x, a.y, 'hyper');
          } else if (Math.random() < NOVA_BOMB_CHANCE) {
            spawnPowerUp(a.x, a.y, 'nova');
          }
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Garantía: si el nivel se completa sin que haya aparecido el disparo triple, generarlo ahora
  if (asteroids.length === 0 && !tripleShotSpawnedThisLevel && powerUps.length === 0) {
    spawnPowerUp(lastDestroyedX, lastDestroyedY, 'triple');
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (shieldActive) {
          shieldActive = false;
          shieldTimer  = 0;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          asteroids = asteroids.filter(x => !x.dead).concat(a.split());
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Nave vs power-up
  for (const p of powerUps) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'triple') activateTripleShot();
      else if (p.type === 'shield') activateShield();
      else if (p.type === 'hyper') activateHyperSpeed();
      else if (p.type === 'nova') novaBombs++;
    }
  }
  powerUps = powerUps.filter(p => !p.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  let statusY = 46;
  ctx.textAlign = 'center';
  if (tripleShotActive) {
    ctx.fillStyle = '#ffa500';
    ctx.fillText(`DISPARO TRIPLE ${Math.ceil(tripleShotTimer)}s`, W / 2, statusY);
    statusY += 20;
  }
  if (shieldActive) {
    ctx.fillStyle = '#22ff88';
    ctx.fillText(`ESCUDO ${Math.ceil(shieldTimer)}s`, W / 2, statusY);
    statusY += 20;
  }
  if (hyperSpeedActive) {
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`HIPERPROPULSIÓN ${Math.ceil(hyperSpeedTimer)}s`, W / 2, statusY);
    statusY += 20;
  }

  if (novaBombs > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff4444';
    ctx.fillText(`BOMBAS NOVA: ${novaBombs}  [B]`, 14, H - 16);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
