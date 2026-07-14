import * as THREE from 'three';
import {
  CARS,
  buildTrafficCar,
  buildCopCar,
  buildCoin,
  buildProp,
  buildBuilding
} from './models.js';
import { AudioKit } from './audio.js';
import { Particles } from './particles.js';

/* ============================================================
   FORTUNER RUSH — a Fast & Furious-style arcade street racer.
   Forward is -Z; the world scrolls toward +Z (camera) to
   simulate driving. Player steers along X.
   ============================================================ */

const CONFIG = {
  laneCount: 3,
  laneWidth: 3.1,
  roadLength: 400,
  spawnZ: -220,
  despawnZ: 24,
  baseSpeed: 34,
  maxSpeed: 96,
  nitroBoost: 48,
  nitroDrain: 40,
  nitroRegen: 8,
  steerSpeed: 15,
  kmhDisplay: 2.4
};

const roadHalf = (CONFIG.laneCount * CONFIG.laneWidth) / 2;
const lanePositions = [];
for (let i = 0; i < CONFIG.laneCount; i++) {
  lanePositions.push(-roadHalf + CONFIG.laneWidth * (i + 0.5));
}

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const canvas = el('game-canvas');
const ui = {
  hud: el('hud'),
  score: el('hud-score'),
  coins: el('hud-coins'),
  speed: el('hud-speed'),
  mult: el('hud-mult'),
  nitroFill: el('nitro-fill'),
  wanted: el('wanted'),
  combo: el('combo-popup'),
  menu: el('menu'),
  garage: el('garage'),
  gameover: el('gameover'),
  loader: el('loader'),
  best: el('best-score'),
  bank: el('bank-coins'),
  goScore: el('go-score'),
  goCoins: el('go-coins'),
  goDist: el('go-distance'),
  goNewBest: el('go-newbest'),
  touch: el('touch-controls'),
  speedlines: el('speedlines'),
  vignette: el('vignette'),
  carList: el('car-list'),
  garageBank: el('garage-bank')
};

// ---------- Renderer / Scene / Camera ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1020, 60, 200);

const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 500);
const camBase = new THREE.Vector3(0, 5.4, 10.8);
camera.position.copy(camBase);

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x243046, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(18, 40, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.target.position.set(0, 0, -10);
scene.add(sun, sun.target);

// Moon/sun disc
const celestial = new THREE.Mesh(
  new THREE.SphereGeometry(6, 20, 20),
  new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
);
celestial.position.set(-60, 60, -180);
scene.add(celestial);

// ---------- Ground + Road ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 900),
  new THREE.MeshStandardMaterial({ color: 0x13351f, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -180;
ground.receiveShadow = true;
scene.add(ground);

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#23262d';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  g.fillStyle = '#e8e8e8';
  g.fillRect(10, 0, 6, c.height);
  g.fillRect(c.width - 16, 0, 6, c.height);
  g.fillStyle = '#f4c531';
  for (let lane = 1; lane < CONFIG.laneCount; lane++) {
    const x = (c.width / CONFIG.laneCount) * lane - 3;
    for (let y = 0; y < c.height; y += 64) g.fillRect(x, y, 6, 36);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
const roadTex = makeRoadTexture();
roadTex.repeat.set(1, CONFIG.roadLength / 16);
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(roadHalf * 2 + 1, CONFIG.roadLength),
  new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.8 })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, -CONFIG.roadLength / 2 + CONFIG.despawnZ);
road.receiveShadow = true;
scene.add(road);

const curbMat = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.9 });
for (const side of [-1, 1]) {
  const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, CONFIG.roadLength), curbMat);
  curb.position.set(side * (roadHalf + 0.3), 0.2, road.position.z);
  curb.receiveShadow = true;
  scene.add(curb);
}

// ---------- Persistent save ----------
const save = {
  best: Number(localStorage.getItem('fr_best') || 0),
  bank: Number(localStorage.getItem('fr_bank') || 0),
  owned: JSON.parse(localStorage.getItem('fr_owned') || '["fortuner"]'),
  selected: localStorage.getItem('fr_selected') || 'fortuner'
};
function persist() {
  localStorage.setItem('fr_best', String(save.best));
  localStorage.setItem('fr_bank', String(save.bank));
  localStorage.setItem('fr_owned', JSON.stringify(save.owned));
  localStorage.setItem('fr_selected', save.selected);
}

// ---------- Player ----------
let player = new THREE.Group();
let playerWheels = [];
let playerStats = CARS[0];
const flameMat = new THREE.MeshStandardMaterial({
  color: 0x2de2e6,
  emissive: 0x2de2e6,
  emissiveIntensity: 2,
  transparent: true,
  opacity: 0.9
});

function loadSelectedCar() {
  scene.remove(player);
  playerStats = CARS.find((c) => c.id === save.selected) || CARS[0];
  const built = playerStats.build(playerStats.color);
  player = built.group;
  playerWheels = built.wheels;
  player.position.set(lanePositions[1], 0.55, 0);
  scene.add(player);
  // nitro flame
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 10), flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.1, 2.6);
  flame.visible = false;
  player.add(flame);
  player.userData.flame = flame;
}

// ---------- Object pools ----------
const traffic = [];
const coins = [];
const props = [];
const buildings = [];
const cops = [];
const particles = new Particles(scene);

function spawnTraffic() {
  const car = buildTrafficCar();
  const lane = (Math.random() * CONFIG.laneCount) | 0;
  car.position.set(lanePositions[lane], 0.55, CONFIG.spawnZ - Math.random() * 120);
  car.userData.lane = lane;
  car.userData.speed = 10 + Math.random() * 14;
  car.userData.minDx = 999;
  car.userData.scored = false;
  scene.add(car);
  traffic.push(car);
}

function spawnCoinRow() {
  const lane = (Math.random() * CONFIG.laneCount) | 0;
  const count = 3 + ((Math.random() * 4) | 0);
  const startZ = CONFIG.spawnZ - Math.random() * 60;
  for (let i = 0; i < count; i++) {
    const coin = buildCoin();
    coin.position.set(lanePositions[lane], 1.0, startZ - i * 3.2);
    scene.add(coin);
    coins.push(coin);
  }
}

function spawnPropRow() {
  for (const side of [-1, 1]) {
    const kind = Math.random() < 0.5 ? 'tree' : 'light';
    const p = buildProp(kind);
    p.position.set(side * (roadHalf + 3 + Math.random() * 3), 0, CONFIG.spawnZ - Math.random() * 40);
    scene.add(p);
    props.push(p);
  }
}

function spawnBuilding() {
  for (const side of [-1, 1]) {
    if (Math.random() < 0.4) continue;
    const b = buildBuilding();
    b.position.set(side * (roadHalf + 14 + Math.random() * 14), 0, CONFIG.spawnZ - Math.random() * 60);
    scene.add(b);
    buildings.push(b);
  }
}

function spawnCop() {
  const { group, bar } = buildCopCar();
  group.position.set(lanePositions[(Math.random() * CONFIG.laneCount) | 0], 0.55, 26 + Math.random() * 20);
  group.userData.bar = bar;
  group.userData.wheels = [];
  scene.add(group);
  cops.push(group);
}

// ---------- Input ----------
const input = { left: false, right: false, nitro: false, tilt: 0 };
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'Space') input.nitro = true;
  if (e.code === 'Enter' && state === 'gameover') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'Space') input.nitro = false;
});
function bindHold(id, prop) {
  const b = el(id);
  const on = (e) => {
    e.preventDefault();
    input[prop] = true;
  };
  const off = (e) => {
    e.preventDefault();
    input[prop] = false;
  };
  b.addEventListener('touchstart', on, { passive: false });
  b.addEventListener('touchend', off, { passive: false });
  b.addEventListener('touchcancel', off, { passive: false });
  b.addEventListener('mousedown', on);
  b.addEventListener('mouseup', off);
  b.addEventListener('mouseleave', off);
}
bindHold('btn-left', 'left');
bindHold('btn-right', 'right');
bindHold('btn-nitro', 'nitro');
function enableTilt() {
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    input.tilt = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
  });
}
if (!(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')) {
  enableTilt();
}

// ---------- Game state ----------
let state = 'menu';
const game = {
  speed: CONFIG.baseSpeed,
  distance: 0,
  score: 0,
  coins: 0,
  nitro: 100,
  dayTime: 0.22,
  mult: 1,
  combo: 0,
  comboTimer: 0,
  wanted: 0,
  heat: 0,
  copTimer: 0,
  spawnTimer: 0,
  coinTimer: 0,
  propTimer: 0,
  buildTimer: 0
};
const audio = new AudioKit();

function clearWorld() {
  for (const arr of [traffic, coins, props, buildings, cops]) {
    for (const o of arr) scene.remove(o);
    arr.length = 0;
  }
  particles.clear();
}

function resetGameVars() {
  Object.assign(game, {
    speed: CONFIG.baseSpeed,
    distance: 0,
    score: 0,
    coins: 0,
    nitro: 100,
    mult: 1,
    combo: 0,
    comboTimer: 0,
    wanted: 0,
    heat: 0,
    copTimer: 0,
    spawnTimer: 0,
    coinTimer: 0,
    propTimer: 0,
    buildTimer: 0
  });
}

function startGame() {
  clearWorld();
  resetGameVars();
  loadSelectedCar();
  state = 'playing';
  ui.menu.classList.add('hidden');
  ui.garage.classList.add('hidden');
  ui.gameover.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.touch.classList.remove('hidden');
  audio.init();
  audio.resume();
}

function endGame() {
  state = 'gameover';
  audio.crash();
  audio.stopEngine();
  audio.stopSiren();
  particles.burst(player.position, 0xff7a1a, 30, { speed: 9, life: 0.9 });
  particles.burst(player.position, 0xffd23f, 20, { speed: 7, life: 0.8 });
  const flame = player.userData.flame;
  if (flame) flame.visible = false;

  save.bank += game.coins;
  const isBest = game.score > save.best;
  if (isBest) save.best = game.score;
  persist();

  ui.best.textContent = save.best;
  ui.bank.textContent = save.bank;
  ui.goScore.textContent = game.score;
  ui.goCoins.textContent = game.coins;
  ui.goDist.textContent = `${Math.floor(game.distance)} m`;
  ui.goNewBest.classList.toggle('hidden', !isBest);
  ui.hud.classList.add('hidden');
  ui.touch.classList.add('hidden');
  ui.gameover.classList.remove('hidden');
}

// ---------- Garage UI ----------
function renderGarage() {
  ui.garageBank.textContent = save.bank;
  ui.carList.innerHTML = '';
  for (const car of CARS) {
    const owned = save.owned.includes(car.id);
    const selected = save.selected === car.id;
    const card = document.createElement('div');
    card.className = 'car-card' + (selected ? ' selected' : '');
    const stat = (label, v) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v * 62)}%"></i></div></div>`;
    let action;
    if (selected) action = `<button class="car-btn owned" disabled>SELECTED</button>`;
    else if (owned) action = `<button class="car-btn select" data-select="${car.id}">SELECT</button>`;
    else {
      const afford = save.bank >= car.price;
      action = `<button class="car-btn buy${afford ? '' : ' disabled'}" data-buy="${car.id}" ${afford ? '' : 'disabled'}>🪙 ${car.price}</button>`;
    }
    card.innerHTML = `
      <div class="car-swatch" style="background:#${car.color.toString(16).padStart(6, '0')}"></div>
      <div class="car-name">${car.name}</div>
      <div class="car-stats">
        ${stat('SPD', car.topSpeed)}
        ${stat('ACC', car.accel)}
        ${stat('HND', car.handling)}
      </div>
      ${action}`;
    ui.carList.appendChild(card);
  }
  ui.carList.querySelectorAll('[data-buy]').forEach((b) =>
    b.addEventListener('click', () => {
      const car = CARS.find((c) => c.id === b.dataset.buy);
      if (save.bank >= car.price) {
        save.bank -= car.price;
        save.owned.push(car.id);
        save.selected = car.id;
        persist();
        audio.init();
        audio.coin();
        renderGarage();
      }
    })
  );
  ui.carList.querySelectorAll('[data-select]').forEach((b) =>
    b.addEventListener('click', () => {
      save.selected = b.dataset.select;
      persist();
      renderGarage();
    })
  );
}

// ---------- Buttons ----------
el('btn-play').addEventListener('click', async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      if ((await DeviceOrientationEvent.requestPermission()) === 'granted') enableTilt();
    } catch (_) {}
  }
  startGame();
});
el('btn-garage').addEventListener('click', () => {
  renderGarage();
  ui.menu.classList.add('hidden');
  ui.garage.classList.remove('hidden');
});
el('btn-garage-back').addEventListener('click', () => {
  ui.garage.classList.add('hidden');
  ui.menu.classList.remove('hidden');
});
el('btn-retry').addEventListener('click', startGame);
el('btn-menu').addEventListener('click', () => {
  state = 'menu';
  ui.best.textContent = save.best;
  ui.bank.textContent = save.bank;
  ui.gameover.classList.add('hidden');
  ui.menu.classList.remove('hidden');
});

// ---------- Helpers ----------
function hits(px, pz, phw, phl, ox, oz, ohw, ohl) {
  return Math.abs(px - ox) < phw + ohw && Math.abs(pz - oz) < phl + ohl;
}
function showCombo(text) {
  ui.combo.textContent = text;
  ui.combo.classList.remove('show');
  void ui.combo.offsetWidth; // restart animation
  ui.combo.classList.add('show');
}

// ---------- Day/Night ----------
const dayColor = new THREE.Color(0x87b6ff);
const nightColor = new THREE.Color(0x070b16);
const dayFog = new THREE.Color(0xaecbff);
const nightFog = new THREE.Color(0x070b16);
const tmp = new THREE.Color();
function applyDayNight() {
  const d = (Math.sin(game.dayTime * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  tmp.copy(nightColor).lerp(dayColor, d);
  scene.background = tmp.clone();
  scene.fog.color.copy(nightFog).lerp(dayFog, d);
  sun.intensity = 0.2 + d * 1.4;
  hemi.intensity = 0.22 + d * 0.6;
  sun.color.setHSL(0.09 + d * 0.04, 0.6, 0.5 + d * 0.4);
  celestial.material.color.setHex(d > 0.5 ? 0xfff2c0 : 0xdfe6ff);
  if (player.userData.headlights) player.userData.headlights.emissiveIntensity = 0.4 + (1 - d) * 1.8;
  const night = 1 - d;
  for (const p of props) {
    if (p.userData.isLight) {
      const bulb = p.children[2];
      if (bulb) bulb.material.emissiveIntensity = 0.2 + night * 2.2;
    }
  }
  for (const b of buildings) if (b.userData.winMat) b.userData.winMat.emissiveIntensity = 0.15 + night * 1.7;
}

// ---------- Main loop ----------
const clock = new THREE.Clock();

function update(dt) {
  particles.update(dt);
  if (state !== 'playing') {
    applyDayNight();
    return;
  }

  const usingNitro = input.nitro && game.nitro > 0;
  let target = Math.min(CONFIG.baseSpeed + game.distance * 0.02, CONFIG.maxSpeed) * playerStats.topSpeed;
  if (usingNitro) target += CONFIG.nitroBoost;
  game.speed += (target - game.speed) * Math.min(dt * 2 * playerStats.accel, 1);

  if (usingNitro) {
    game.nitro = Math.max(0, game.nitro - CONFIG.nitroDrain * dt);
    const flame = player.userData.flame;
    if (flame) {
      flame.visible = true;
      flame.scale.setScalar(0.7 + Math.random() * 0.7);
    }
    particles.trail(new THREE.Vector3(player.position.x, 0.4, player.position.z + 2.8), 0x2de2e6);
    if (!game._nitroSfx) {
      audio.nitro();
      game._nitroSfx = true;
    }
  } else {
    game.nitro = Math.min(100, game.nitro + CONFIG.nitroRegen * dt);
    const flame = player.userData.flame;
    if (flame) flame.visible = false;
    game._nitroSfx = false;
  }

  const move = game.speed * dt;
  game.distance += move;
  game.dayTime = (game.dayTime + dt * 0.014) % 1;

  // combo decay
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 0;
      game.mult = 1;
    }
  }
  game.score = Math.floor(game.distance * game.mult) + game.coins * 25;

  // Steering (handling stat affects responsiveness)
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (Math.abs(input.tilt) > 0.08) dir += input.tilt;
  dir = THREE.MathUtils.clamp(dir, -1, 1);
  player.position.x = THREE.MathUtils.clamp(
    player.position.x + dir * CONFIG.steerSpeed * playerStats.handling * dt,
    -roadHalf + 1,
    roadHalf - 1
  );
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -dir * 0.2, dt * 8);
  player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, -dir * 0.12, dt * 8);
  for (const w of playerWheels) w.rotation.x -= move * 0.4;
  roadTex.offset.y -= move / 16;

  const phw = 1.0;
  const phl = 2.2;

  // ---- Traffic + near-miss ----
  game.spawnTimer -= dt;
  const spawnInterval = Math.max(0.4, 1.3 - game.distance * 0.00028);
  if (game.spawnTimer <= 0) {
    spawnTraffic();
    game.spawnTimer = spawnInterval;
  }
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    car.position.z += (game.speed - car.userData.speed) * dt;
    const ohl = car.userData.length / 2;
    const dx = Math.abs(player.position.x - car.position.x);
    const dz = Math.abs(player.position.z - car.position.z);

    if (dz < 4) car.userData.minDx = Math.min(car.userData.minDx, dx);

    if (hits(player.position.x, player.position.z, phw, phl, car.position.x, car.position.z, 0.95, ohl)) {
      endGame();
      return;
    }

    // scored once the car falls behind the player
    if (!car.userData.scored && car.position.z > player.position.z + phl + ohl) {
      car.userData.scored = true;
      if (car.userData.minDx < 2.4) {
        registerNearMiss(car.position.x);
      }
    }

    if (car.position.z > CONFIG.despawnZ) {
      scene.remove(car);
      traffic.splice(i, 1);
    }
  }

  // ---- Coins ----
  game.coinTimer -= dt;
  if (game.coinTimer <= 0) {
    spawnCoinRow();
    game.coinTimer = 0.9 + Math.random() * 1.2;
  }
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    coin.position.z += game.speed * dt;
    coin.rotation.z += dt * 6;
    if (hits(player.position.x, player.position.z, phw, phl, coin.position.x, coin.position.z, 0.6, 0.6)) {
      particles.burst(coin.position, 0xffd23f, 10, { speed: 5, life: 0.5 });
      scene.remove(coin);
      coins.splice(i, 1);
      game.coins += 1;
      audio.coin();
      continue;
    }
    if (coin.position.z > CONFIG.despawnZ) {
      scene.remove(coin);
      coins.splice(i, 1);
    }
  }

  // ---- Police / wanted ----
  updatePolice(dt, phw, phl);

  // ---- Scenery ----
  game.propTimer -= dt;
  if (game.propTimer <= 0) {
    spawnPropRow();
    game.propTimer = 0.6;
  }
  for (let i = props.length - 1; i >= 0; i--) {
    props[i].position.z += game.speed * dt;
    if (props[i].position.z > CONFIG.despawnZ + 6) {
      scene.remove(props[i]);
      props.splice(i, 1);
    }
  }
  game.buildTimer -= dt;
  if (game.buildTimer <= 0) {
    spawnBuilding();
    game.buildTimer = 1.4;
  }
  for (let i = buildings.length - 1; i >= 0; i--) {
    buildings[i].position.z += game.speed * dt;
    if (buildings[i].position.z > CONFIG.despawnZ + 30) {
      scene.remove(buildings[i]);
      buildings.splice(i, 1);
    }
  }

  updateCamera(dt, usingNitro);
  audio.setEngine(THREE.MathUtils.clamp((game.speed - CONFIG.baseSpeed) / CONFIG.maxSpeed + 0.3, 0, 1));
  applyDayNight();
  updateSpeedFx(usingNitro);
  updateHud();
}

function registerNearMiss(x) {
  game.combo += 1;
  game.comboTimer = 2.2;
  game.mult = Math.min(8, 1 + game.combo * 0.5);
  game.nitro = Math.min(100, game.nitro + 12); // reward: free nitro
  game.heat += 0.6; // aggressive driving raises heat
  particles.burst(new THREE.Vector3(x, 1.2, player.position.z), 0x2de2e6, 8, { speed: 5, life: 0.5 });
  const msgs = ['NEAR MISS!', 'CLOSE ONE!', 'INSANE!', 'CRAZY!'];
  showCombo(`${msgs[Math.min(msgs.length - 1, game.combo - 1)] || 'COMBO'} x${game.mult.toFixed(1)}`);
  audio.blip(900 + game.combo * 80, 0.08, 'square', 0.14);
}

function updatePolice(dt, phw, phl) {
  // Heat builds with speed/distance and near-misses; wanted = stars.
  game.heat += dt * (0.25 + (game.speed / CONFIG.maxSpeed) * 0.5);
  const newWanted = Math.min(5, Math.floor(game.heat / 12));
  if (newWanted > game.wanted) {
    game.wanted = newWanted;
    if (game.wanted === 1) audio.startSiren();
  }

  // spawn cops based on wanted level
  game.copTimer -= dt;
  if (game.wanted > 0 && cops.length < game.wanted + 1 && game.copTimer <= 0) {
    spawnCop();
    game.copTimer = 2.5;
  }
  if (game.wanted === 0) audio.stopSiren();

  const t = performance.now() * 0.006;
  for (let i = cops.length - 1; i >= 0; i--) {
    const cop = cops[i];
    // flashing lights
    const bar = cop.userData.bar;
    if (bar) {
      bar.userData.redMat.emissiveIntensity = Math.sin(t) > 0 ? 3 : 0.2;
      bar.userData.blueMat.emissiveIntensity = Math.sin(t) > 0 ? 0.2 : 3;
    }
    // chase: close in when player is slow / not boosting, fall back on nitro
    const usingNitro = input.nitro && game.nitro > 0;
    let closing = 5 + game.wanted * 1.5 - (game.speed - CONFIG.baseSpeed) * 0.28;
    if (usingNitro) closing -= 34;
    cop.position.z -= closing * dt; // negative z = catching up toward player
    cop.position.x = THREE.MathUtils.lerp(cop.position.x, player.position.x, dt * 1.6);

    if (hits(player.position.x, player.position.z, phw, phl, cop.position.x, cop.position.z, 0.95, 2.2)) {
      endGame();
      return;
    }
    // escaped ahead
    if (cop.position.z < -70) {
      scene.remove(cop);
      cops.splice(i, 1);
      game.heat = Math.max(0, game.heat - 8);
      game.wanted = Math.min(game.wanted, Math.min(5, Math.floor(game.heat / 12)));
      showCombo('COP DODGED!');
      continue;
    }
    if (cop.position.z > 90) {
      scene.remove(cop);
      cops.splice(i, 1);
    }
  }
}

function updateCamera(dt, usingNitro) {
  const shake = usingNitro ? 0.09 : 0.025;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.35, dt * 4);
  camera.position.y = camBase.y + (Math.random() - 0.5) * shake;
  camera.position.z = camBase.z;
  camera.lookAt(player.position.x * 0.4, 1.2, -14);
  // dynamic FOV pumps with speed for a sense of velocity
  const speedT = (game.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed + CONFIG.nitroBoost - CONFIG.baseSpeed);
  const targetFov = 64 + THREE.MathUtils.clamp(speedT, 0, 1.3) * 18;
  camera.fov += (targetFov - camera.fov) * dt * 4;
  camera.updateProjectionMatrix();
}

function updateSpeedFx(usingNitro) {
  const speedT = THREE.MathUtils.clamp((game.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
  ui.speedlines.style.opacity = (speedT * 0.55 + (usingNitro ? 0.35 : 0)).toFixed(2);
  ui.vignette.style.opacity = (usingNitro ? 0.7 : speedT * 0.3).toFixed(2);
}

function updateHud() {
  ui.score.textContent = game.score;
  ui.coins.textContent = game.coins;
  ui.speed.textContent = Math.round(game.speed * CONFIG.kmhDisplay);
  ui.nitroFill.style.width = `${game.nitro}%`;
  ui.mult.textContent = `x${game.mult.toFixed(1)}`;
  ui.mult.style.opacity = game.mult > 1 ? '1' : '0.4';
  ui.wanted.textContent = game.wanted > 0 ? '★'.repeat(game.wanted) : '';
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Boot ----------
ui.best.textContent = save.best;
ui.bank.textContent = save.bank;
loadSelectedCar();
applyDayNight();
for (let i = 0; i < 6; i++) {
  spawnPropRow();
  spawnBuilding();
}
for (const p of props) p.position.z += Math.random() * 200 - 100;
for (const b of buildings) b.position.z += Math.random() * 200 - 100;
ui.loader.classList.add('hidden');
animate();
