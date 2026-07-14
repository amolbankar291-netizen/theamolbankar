import * as THREE from 'three';
import { buildFortuner, buildTrafficCar, buildCoin, buildProp } from './models.js';
import { AudioKit } from './audio.js';

/* ============================================================
   Fortuner Rush — a 3D endless SUV driving game.
   Forward direction is -Z. The world scrolls toward +Z (the
   camera) to simulate driving. The player steers along X.
   ============================================================ */

const CONFIG = {
  laneCount: 3,
  laneWidth: 3.1,
  roadLength: 400,
  spawnZ: -220,
  despawnZ: 24,
  baseSpeed: 34, // world units / sec
  maxSpeed: 92,
  accel: 1.6, // speed gained per second
  steerSpeed: 14, // x units / sec
  nitroBoost: 46,
  nitroDrain: 42, // % per second while held
  nitroRegen: 9, // % per second
  kmhFactor: 3.6
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
  nitroFill: el('nitro-fill'),
  menu: el('menu'),
  gameover: el('gameover'),
  loader: el('loader'),
  best: el('best-score'),
  goScore: el('go-score'),
  goCoins: el('go-coins'),
  goDist: el('go-distance'),
  goNewBest: el('go-newbest'),
  touch: el('touch-controls')
};

// ---------- Renderer / Scene / Camera ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1020, 60, 190);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
const camBase = new THREE.Vector3(0, 5.4, 10.5);
camera.position.copy(camBase);
camera.lookAt(0, 1.2, -14);

// ---------- Lighting (day/night cycle) ----------
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
scene.add(sun);
scene.add(sun.target);

// ---------- Ground + Road ----------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x13351f, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 800), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -180;
ground.receiveShadow = true;
scene.add(ground);

// Asphalt road with painted lane markings via a canvas texture we scroll.
function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#23262d';
  g.fillRect(0, 0, c.width, c.height);
  // subtle asphalt noise
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  // edge lines
  g.fillStyle = '#e8e8e8';
  g.fillRect(10, 0, 6, c.height);
  g.fillRect(c.width - 16, 0, 6, c.height);
  // dashed lane dividers
  g.fillStyle = '#f4c531';
  for (let lane = 1; lane < CONFIG.laneCount; lane++) {
    const x = (c.width / CONFIG.laneCount) * lane - 3;
    for (let y = 0; y < c.height; y += 64) {
      g.fillRect(x, y, 6, 36);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
const roadTex = makeRoadTexture();
const roadWorldRepeat = CONFIG.roadLength / 16; // one texture tile ~ 16 units
roadTex.repeat.set(1, roadWorldRepeat);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.8 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(roadHalf * 2 + 1, CONFIG.roadLength), roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, -CONFIG.roadLength / 2 + CONFIG.despawnZ);
road.receiveShadow = true;
scene.add(road);

// Curbs
const curbMat = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.9 });
for (const side of [-1, 1]) {
  const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, CONFIG.roadLength), curbMat);
  curb.position.set(side * (roadHalf + 0.3), 0.2, road.position.z);
  curb.receiveShadow = true;
  scene.add(curb);
}

// ---------- Player ----------
const { group: player, wheels: playerWheels } = buildFortuner(0xffffff);
player.position.set(lanePositions[1], 0.55, 0);
scene.add(player);

// Nitro flame (behind exhaust)
const flameMat = new THREE.MeshStandardMaterial({
  color: 0x2de2e6,
  emissive: 0x2de2e6,
  emissiveIntensity: 2,
  transparent: true,
  opacity: 0.9
});
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 10), flameMat);
flame.rotation.x = -Math.PI / 2;
flame.position.set(0, 0.1, 2.6);
flame.visible = false;
player.add(flame);

// ---------- Object pools ----------
const traffic = [];
const coins = [];
const props = [];

function spawnTraffic() {
  const car = buildTrafficCar();
  const lane = (Math.random() * CONFIG.laneCount) | 0;
  car.position.set(lanePositions[lane], 0.55, CONFIG.spawnZ - Math.random() * 120);
  car.userData.lane = lane;
  car.userData.speed = 10 + Math.random() * 14; // moves forward slower than player
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
    p.position.set(side * (roadHalf + 3 + Math.random() * 4), 0, CONFIG.spawnZ - Math.random() * 40);
    p.userData.isLight = kind === 'light';
    scene.add(p);
    props.push(p);
  }
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

// Device tilt steering (mobile)
function enableTilt() {
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    // gamma: left/right tilt, roughly -90..90
    input.tilt = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
  });
}
if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function') {
  // iOS 13+ needs a gesture-triggered permission request (done on PLAY)
} else {
  enableTilt();
}

// ---------- Game state ----------
let state = 'menu'; // menu | playing | gameover
const game = {
  speed: CONFIG.baseSpeed,
  distance: 0,
  score: 0,
  coins: 0,
  nitro: 100,
  dayTime: 0.25, // 0..1
  spawnTimer: 0,
  coinTimer: 0,
  propTimer: 0
};
let best = Number(localStorage.getItem('fortuner_best') || 0);
ui.best.textContent = best;

const audio = new AudioKit();

function clearWorld() {
  for (const arr of [traffic, coins, props]) {
    for (const o of arr) scene.remove(o);
    arr.length = 0;
  }
}

function startGame() {
  clearWorld();
  Object.assign(game, {
    speed: CONFIG.baseSpeed,
    distance: 0,
    score: 0,
    coins: 0,
    nitro: 100,
    spawnTimer: 0,
    coinTimer: 0,
    propTimer: 0
  });
  player.position.set(lanePositions[1], 0.55, 0);
  player.rotation.set(0, 0, 0);
  state = 'playing';
  ui.menu.classList.add('hidden');
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
  flame.visible = false;
  const isBest = game.score > best;
  if (isBest) {
    best = game.score;
    localStorage.setItem('fortuner_best', String(best));
    ui.best.textContent = best;
  }
  ui.goScore.textContent = game.score;
  ui.goCoins.textContent = game.coins;
  ui.goDist.textContent = `${Math.floor(game.distance)} m`;
  ui.goNewBest.classList.toggle('hidden', !isBest);
  ui.hud.classList.add('hidden');
  ui.touch.classList.add('hidden');
  ui.gameover.classList.remove('hidden');
}

// ---------- Buttons ----------
el('btn-play').addEventListener('click', async () => {
  // iOS motion permission on the required user gesture
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') enableTilt();
    } catch (_) {}
  }
  startGame();
});
el('btn-retry').addEventListener('click', startGame);
el('btn-menu').addEventListener('click', () => {
  state = 'menu';
  ui.gameover.classList.add('hidden');
  ui.menu.classList.remove('hidden');
});

// ---------- Collision helper (AABB in X/Z) ----------
function hits(px, pz, phw, phl, ox, oz, ohw, ohl) {
  return (
    Math.abs(px - ox) < phw + ohw &&
    Math.abs(pz - oz) < phl + ohl
  );
}

// ---------- Day/Night application ----------
const dayColor = new THREE.Color(0x87b6ff);
const nightColor = new THREE.Color(0x0b1020);
const dayFog = new THREE.Color(0xaecbff);
const nightFog = new THREE.Color(0x0b1020);
const tmpColor = new THREE.Color();

function applyDayNight() {
  // day factor: 1 at noon, 0 at midnight
  const d = (Math.sin(game.dayTime * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  tmpColor.copy(nightColor).lerp(dayColor, d);
  scene.background = tmpColor.clone();
  scene.fog.color.copy(nightFog).lerp(dayFog, d);
  sun.intensity = 0.25 + d * 1.35;
  hemi.intensity = 0.25 + d * 0.6;
  sun.color.setHSL(0.09 + d * 0.04, 0.6, 0.5 + d * 0.4);
  // headlights glow more at night
  player.userData.headlights.emissiveIntensity = 0.4 + (1 - d) * 1.6;
  // streetlights on at night
  for (const p of props) {
    if (p.userData.isLight) {
      const bulb = p.children[2];
      if (bulb) bulb.material.emissiveIntensity = 0.2 + (1 - d) * 2.2;
    }
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();

function update(dt) {
  if (state !== 'playing') {
    applyDayNight();
    return;
  }

  // Speed ramps up over time; nitro adds a burst
  const usingNitro = input.nitro && game.nitro > 0;
  let target = Math.min(CONFIG.baseSpeed + game.distance * 0.02, CONFIG.maxSpeed);
  if (usingNitro) target += CONFIG.nitroBoost;
  game.speed += (target - game.speed) * Math.min(dt * 2, 1);

  if (usingNitro) {
    game.nitro = Math.max(0, game.nitro - CONFIG.nitroDrain * dt);
    flame.visible = true;
    flame.scale.setScalar(0.7 + Math.random() * 0.6);
    if (!flame.userData.sfx) {
      audio.nitro();
      flame.userData.sfx = true;
    }
  } else {
    game.nitro = Math.min(100, game.nitro + CONFIG.nitroRegen * dt);
    flame.visible = false;
    flame.userData.sfx = false;
  }

  const move = game.speed * dt;
  game.distance += move;
  game.score = Math.floor(game.distance) + game.coins * 25;
  game.dayTime = (game.dayTime + dt * 0.015) % 1;

  // Steering
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (Math.abs(input.tilt) > 0.08) dir += input.tilt;
  dir = THREE.MathUtils.clamp(dir, -1, 1);
  player.position.x = THREE.MathUtils.clamp(
    player.position.x + dir * CONFIG.steerSpeed * dt,
    -roadHalf + 1,
    roadHalf - 1
  );
  // Bank the car when steering
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -dir * 0.18, dt * 8);
  player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, -dir * 0.12, dt * 8);

  // Spin wheels
  for (const w of playerWheels) w.rotation.x -= move * 0.4;

  // Scroll road texture
  roadTex.offset.y -= (move / 16);

  // ---- Traffic ----
  game.spawnTimer -= dt;
  const spawnInterval = Math.max(0.45, 1.3 - game.distance * 0.00025);
  if (game.spawnTimer <= 0) {
    spawnTraffic();
    game.spawnTimer = spawnInterval;
  }
  const phw = 1.0;
  const phl = 2.2;
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    car.position.z += (game.speed - car.userData.speed) * dt;
    if (car.position.z > CONFIG.despawnZ) {
      scene.remove(car);
      traffic.splice(i, 1);
      continue;
    }
    const ohl = car.userData.length / 2;
    if (hits(player.position.x, player.position.z, phw, phl, car.position.x, car.position.z, 0.95, ohl)) {
      endGame();
      return;
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
    if (coin.position.z > CONFIG.despawnZ) {
      scene.remove(coin);
      coins.splice(i, 1);
      continue;
    }
    if (hits(player.position.x, player.position.z, phw, phl, coin.position.x, coin.position.z, 0.6, 0.6)) {
      scene.remove(coin);
      coins.splice(i, 1);
      game.coins += 1;
      audio.coin();
    }
  }

  // ---- Scenery ----
  game.propTimer -= dt;
  if (game.propTimer <= 0) {
    spawnPropRow();
    game.propTimer = 0.6;
  }
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    p.position.z += game.speed * dt;
    if (p.position.z > CONFIG.despawnZ + 6) {
      scene.remove(p);
      props.splice(i, 1);
    }
  }

  // Camera subtle follow + shake with speed
  const shake = usingNitro ? 0.06 : 0.02;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.35, dt * 4);
  camera.position.y = camBase.y + (Math.random() - 0.5) * shake;
  camera.lookAt(player.position.x * 0.4, 1.2, -14);

  audio.setEngine(THREE.MathUtils.clamp((game.speed - CONFIG.baseSpeed) / CONFIG.maxSpeed + 0.3, 0, 1));

  applyDayNight();
  updateHud();
}

function updateHud() {
  ui.score.textContent = game.score;
  ui.coins.textContent = game.coins;
  ui.speed.textContent = Math.round(game.speed * (CONFIG.kmhFactor / 2 + 0.6));
  ui.nitroFill.style.width = `${game.nitro}%`;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---------- Resize ----------
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
applyDayNight();
// Prime a couple of prop rows so the world isn't empty behind the menu
for (let i = 0; i < 6; i++) {
  spawnPropRow();
  for (const p of props) p.position.z += i * 30;
}
ui.loader.classList.add('hidden');
animate();
