import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CARS,
  buildTrafficCar,
  buildRivalCar,
  buildCopCar,
  buildCoin,
  buildProp,
  buildBuilding,
  buildPalm,
  buildBush,
  buildRock,
  buildCactus,
  buildMountainRidge,
  buildArch,
  buildBillboard,
  buildBoostPad,
  buildGuardrail,
  makeStarfield
} from './models.js';
import { AudioKit } from './audio.js';
import { Particles } from './particles.js';

/* ============================================================
   FORTUNER RUSH — a Fast & Furious-style arcade street racer
   with biomes (Neon City / Jungle / Desert Hills), neon bloom,
   boost pads, police chases and near-miss combos.
   Forward is -Z; the world scrolls toward +Z (camera).
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
  accel: 30, // throttle acceleration (units/s^2)
  brakeDecel: 62, // braking deceleration
  coastDecel: 16, // engine braking when off throttle
  kmhDisplay: 2.4,
  biomeDistance: 1100
};

const roadHalf = (CONFIG.laneCount * CONFIG.laneWidth) / 2;
const lanePositions = [];
for (let i = 0; i < CONFIG.laneCount; i++) {
  lanePositions.push(-roadHalf + CONFIG.laneWidth * (i + 0.5));
}

// ---------- Biomes (visual palettes / terrain) ----------
const BIOMES = [
  { name: 'NEON CITY', tag: 'Downtown lights', ground: 0x1a1f2e, skyDay: 0x8fb4ff, skyNight: 0x0a0f1e, fogDay: 0xaecbff, fogNight: 0x0a0f1e, mtn: 0x2a3550, prop: 'city' },
  { name: 'OPEN HIGHWAY', tag: 'Full throttle', ground: 0x2b2f3a, skyDay: 0x9fc0ff, skyNight: 0x0b1120, fogDay: 0xc2d6ff, fogNight: 0x0b1120, mtn: 0x39445c, prop: 'highway' },
  { name: 'JUNGLE RUN', tag: 'Into the wild', ground: 0x1f4d24, skyDay: 0x9fe6c6, skyNight: 0x081810, fogDay: 0xbfeecf, fogNight: 0x08160f, mtn: 0x1f5a33, prop: 'jungle' },
  { name: 'DESERT HILLS', tag: 'Sun & dust', ground: 0x8a6a3a, skyDay: 0xffd39a, skyNight: 0x1c1226, fogDay: 0xffdca8, fogNight: 0x1a1020, mtn: 0x7a5a3a, prop: 'hills' },
  { name: 'MUD TRAIL', tag: 'Off-road mayhem', ground: 0x4a3826, skyDay: 0xa9b0a0, skyNight: 0x14110c, fogDay: 0xbcc0ad, fogNight: 0x140f0a, mtn: 0x3d3020, prop: 'mud' },
  { name: 'ICE PASS', tag: 'Frozen edge', ground: 0xd2dced, skyDay: 0xdce9ff, skyNight: 0x142033, fogDay: 0xe8f2ff, fogNight: 0x16233a, mtn: 0xaebfd6, prop: 'ice' }
];

// ---------- Tracks (selectable; unlocked by winning the previous one) ----------
const TRACKS = [
  { key: 'city', biome: 0, name: 'CITY HIGHWAY', tag: 'Neon downtown', goal: 1500 },
  { key: 'highway', biome: 1, name: 'OPEN HIGHWAY', tag: 'Full throttle', goal: 1800 },
  { key: 'jungle', biome: 2, name: 'JUNGLE RUN', tag: 'Into the wild', goal: 2100 },
  { key: 'hills', biome: 3, name: 'DESERT HILLS', tag: 'Sun & dust', goal: 2400 },
  { key: 'mud', biome: 4, name: 'MUD TRAIL', tag: 'Off-road mayhem', goal: 2700 },
  { key: 'ice', biome: 5, name: 'ICE PASS', tag: 'Frozen edge', goal: 3000 },
  { key: 'all', mixed: true, name: 'ALL TERRAIN', tag: 'Every biome, no limits', goal: 4200 }
];

// ---------- Selectable body colours ----------
const BODY_COLORS = [
  { name: 'Pearl White', hex: 0xffffff },
  { name: 'Jet Black', hex: 0x0c0d10 },
  { name: 'Gunmetal', hex: 0x3a3f47 },
  { name: 'Silver', hex: 0xc4cad2 },
  { name: 'Racing Red', hex: 0xd8231f },
  { name: 'Electric Blue', hex: 0x1560ff },
  { name: 'Midnight Navy', hex: 0x14213d },
  { name: 'Forest Green', hex: 0x1f7a44 },
  { name: 'Sunset Orange', hex: 0xff6a1a },
  { name: 'Golden', hex: 0xe0a92e },
  { name: 'Purple Haze', hex: 0x7b3ff2 },
  { name: 'Bronze', hex: 0x8a5a2b }
];

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
  banner: el('biome-banner'),
  bannerName: el('banner-name'),
  bannerTag: el('banner-tag'),
  menu: el('menu'),
  garage: el('garage'),
  tracks: el('tracks'),
  trackList: el('track-list'),
  win: el('win'),
  winUnlock: el('win-unlock'),
  winScore: el('win-score'),
  winCoins: el('win-coins'),
  winTrack: el('win-track'),
  btnNextTrack: el('btn-next-track'),
  colorList: el('color-list'),
  trackFill: el('track-fill'),
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
const steerWheelEl = el('steering-wheel');

// ---------- Renderer / Scene / Camera ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1020, 60, 210);

// Realistic reflections for metal/glass (image-based lighting)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 600);
const camBase = new THREE.Vector3(0, 5.4, 10.8);
camera.position.copy(camBase);
camera.layers.enable(1); // layer 1 = HUD mirror plane
scene.add(camera); // so camera-attached mirror renders

// ---------- Rear-view mirror (real render of what's behind you) ----------
const rearRT = new THREE.WebGLRenderTarget(512, 174, { samples: 0 });
const rearCam = new THREE.PerspectiveCamera(58, 512 / 174, 0.1, 260);
const mirrorFrame = new THREE.Mesh(
  new THREE.PlaneGeometry(1.12, 0.4),
  new THREE.MeshBasicMaterial({ color: 0x05070d })
);
mirrorFrame.position.set(0, 0.62, -1.45);
mirrorFrame.layers.set(1);
camera.add(mirrorFrame);
const mirror = new THREE.Mesh(
  new THREE.PlaneGeometry(1.04, 0.34),
  new THREE.MeshBasicMaterial({ map: rearRT.texture, side: THREE.DoubleSide, toneMapped: false })
);
mirror.position.set(0, 0.62, -1.44);
mirror.scale.x = -1; // mirror image
mirror.layers.set(1);
camera.add(mirror);

// Post-processing: neon bloom
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.7, 0.78);
composer.addPass(bloom);

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

const celestial = new THREE.Mesh(
  new THREE.SphereGeometry(6, 20, 20),
  new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
);
celestial.position.set(-60, 60, -180);
scene.add(celestial);

const stars = makeStarfield();
scene.add(stars);

// ---------- Ground + Road ----------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 1000), groundMat);
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
  new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.5, metalness: 0.25, envMapIntensity: 0.6 })
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
  selected: localStorage.getItem('fr_selected') || 'fortuner',
  colors: JSON.parse(localStorage.getItem('fr_colors') || '{}'),
  unlocked: JSON.parse(localStorage.getItem('fr_unlocked') || '[0]'),
  track: Number(localStorage.getItem('fr_track') || 0)
};
function persist() {
  localStorage.setItem('fr_best', String(save.best));
  localStorage.setItem('fr_bank', String(save.bank));
  localStorage.setItem('fr_owned', JSON.stringify(save.owned));
  localStorage.setItem('fr_selected', save.selected);
  localStorage.setItem('fr_colors', JSON.stringify(save.colors));
  localStorage.setItem('fr_unlocked', JSON.stringify(save.unlocked));
  localStorage.setItem('fr_track', String(save.track));
}
function carColor(id) {
  const c = save.colors[id];
  if (c !== undefined && c !== null) return c;
  const car = CARS.find((x) => x.id === id);
  return car ? car.color : 0xffffff;
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
  const built = playerStats.build(carColor(playerStats.id));
  // Models are authored with the front at +Z; the car travels toward -Z,
  // so wrap the body in a container rotated 180° and steer the container.
  const body = built.group;
  body.rotation.y = Math.PI;
  player = new THREE.Group();
  player.add(body);
  player.position.set(lanePositions[1], 0.55, 0);
  scene.add(player);
  playerWheels = built.wheels;
  player.userData.headlights = body.userData.headlights;
  player.userData.windshield = body.userData.windshield;
  // Exhaust nitro flame at the rear (world +Z when facing -Z)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 10), flameMat);
  flame.rotation.x = Math.PI / 2;
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
const mountains = [];
const arches = [];
const boostpads = [];
const rails = [];
const rivals = [];
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
function currentBiome() {
  return BIOMES[game.biome];
}
function spawnPropRow() {
  const biome = currentBiome().prop;
  for (const side of [-1, 1]) {
    let p;
    if (biome === 'jungle') {
      const r = Math.random();
      p = r < 0.5 ? buildPalm() : r < 0.8 ? buildProp('tree') : buildBush();
    } else if (biome === 'hills') {
      p = Math.random() < 0.55 ? buildRock() : buildCactus();
    } else if (biome === 'mud') {
      const r = Math.random();
      p = r < 0.45 ? buildRock() : r < 0.8 ? buildBush() : buildProp('tree');
    } else if (biome === 'ice') {
      p = Math.random() < 0.55 ? buildProp('tree') : buildRock();
    } else {
      p = Math.random() < 0.55 ? buildProp('light') : buildBillboard();
    }
    p.position.set(side * (roadHalf + 3 + Math.random() * 3), 0, CONFIG.spawnZ - Math.random() * 40);
    scene.add(p);
    props.push(p);
  }
}
function spawnBuilding() {
  if (currentBiome().prop !== 'city') return;
  for (const side of [-1, 1]) {
    if (Math.random() < 0.4) continue;
    const b = buildBuilding();
    b.position.set(side * (roadHalf + 14 + Math.random() * 14), 0, CONFIG.spawnZ - Math.random() * 60);
    scene.add(b);
    buildings.push(b);
  }
}
function spawnMountain() {
  for (const side of [-1, 1]) {
    const m = buildMountainRidge(currentBiome().mtn);
    m.position.set(side * (72 + Math.random() * 16), 0, CONFIG.spawnZ - Math.random() * 60);
    scene.add(m);
    mountains.push(m);
  }
}
const ARCH_COLORS = [0x2de2e6, 0xff2a6d, 0xffd23f, 0x9b4dd2];
function spawnArch() {
  const a = buildArch(ARCH_COLORS[(Math.random() * ARCH_COLORS.length) | 0]);
  a.position.set(0, 0, CONFIG.spawnZ);
  scene.add(a);
  arches.push(a);
}
function spawnBoostPad() {
  const pad = buildBoostPad();
  pad.position.set(lanePositions[(Math.random() * CONFIG.laneCount) | 0], 0.05, CONFIG.spawnZ - Math.random() * 40);
  pad.userData.used = false;
  scene.add(pad);
  boostpads.push(pad);
}
function spawnRival() {
  const car = buildRivalCar();
  const lane = (Math.random() * CONFIG.laneCount) | 0;
  car.position.set(lanePositions[lane], 0.55, CONFIG.spawnZ - Math.random() * 60);
  // rivals drive fast; the player overtakes the slower ones (a race pack)
  car.userData.speed = 58 + Math.random() * 26;
  scene.add(car);
  rivals.push(car);
}
function spawnRail() {
  for (const side of [-1, 1]) {
    const r = buildGuardrail(20);
    r.position.set(side * (roadHalf + 0.8), 0, CONFIG.spawnZ);
    scene.add(r);
    rails.push(r);
  }
}
function spawnCop() {
  const { group, bar } = buildCopCar();
  group.position.set(lanePositions[(Math.random() * CONFIG.laneCount) | 0], 0.55, 26 + Math.random() * 20);
  group.userData.bar = bar;
  scene.add(group);
  cops.push(group);
}

// ---------- Input ----------
const input = { left: false, right: false, gas: false, brake: false, nitro: false, tilt: 0 };
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') input.gas = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.brake = true;
  if (e.code === 'Space') input.nitro = true;
  if (e.code === 'Enter' && state === 'gameover') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') input.gas = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.brake = false;
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
bindHold('btn-gas', 'gas');
bindHold('btn-brake', 'brake');
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
let viewMode = localStorage.getItem('fr_view') || 'chase'; // 'chase' | 'cockpit'
let steerSmooth = 0;
function setView(v) {
  viewMode = v;
  localStorage.setItem('fr_view', v);
  const cockpit = v === 'cockpit';
  el('cockpit').classList.toggle('hidden', !cockpit);
  if (player.userData.windshield) player.userData.windshield.visible = !cockpit;
  const vb = el('btn-view');
  if (vb) vb.textContent = cockpit ? '🎥 Cockpit' : '🎥 Chase';
}
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
  buildTimer: 0,
  mtnTimer: 0,
  archTimer: 0,
  boostTimer: 0,
  railTimer: 0,
  rivalTimer: 3,
  biome: 0,
  track: 0,
  mixed: false,
  goal: 1500,
  won: false,
  nextBiomeAt: CONFIG.biomeDistance,
  boostBurst: 0
};
const audio = new AudioKit();

// Live palette (lerps toward the active biome for smooth transitions)
const pal = {
  ground: new THREE.Color(BIOMES[0].ground),
  skyDay: new THREE.Color(BIOMES[0].skyDay),
  skyNight: new THREE.Color(BIOMES[0].skyNight),
  fogDay: new THREE.Color(BIOMES[0].fogDay),
  fogNight: new THREE.Color(BIOMES[0].fogNight)
};
const tgt = { ground: new THREE.Color(), skyDay: new THREE.Color(), skyNight: new THREE.Color(), fogDay: new THREE.Color(), fogNight: new THREE.Color() };
function setBiomeTarget() {
  const b = currentBiome();
  tgt.ground.setHex(b.ground);
  tgt.skyDay.setHex(b.skyDay);
  tgt.skyNight.setHex(b.skyNight);
  tgt.fogDay.setHex(b.fogDay);
  tgt.fogNight.setHex(b.fogNight);
}
setBiomeTarget();

function clearWorld() {
  for (const arr of [traffic, coins, props, buildings, cops, mountains, arches, boostpads, rails, rivals]) {
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
    buildTimer: 0,
    mtnTimer: 0,
    archTimer: 0,
    boostTimer: 0,
    railTimer: 0,
    rivalTimer: 3,
    won: false,
    nextBiomeAt: CONFIG.biomeDistance,
    boostBurst: 0
  });
  const t = TRACKS[save.track] || TRACKS[0];
  game.track = save.track;
  game.mixed = !!t.mixed;
  game.biome = t.mixed ? 0 : t.biome;
  game.goal = t.goal;
  setBiomeTarget();
}

function startGame() {
  clearWorld();
  resetGameVars();
  loadSelectedCar();
  setView(viewMode);
  state = 'playing';
  ui.menu.classList.add('hidden');
  ui.garage.classList.add('hidden');
  ui.tracks.classList.add('hidden');
  ui.gameover.classList.add('hidden');
  ui.win.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.touch.classList.remove('hidden');
  audio.init();
  audio.resume();
  const t = TRACKS[game.track];
  showBanner(t.name, t.tag);
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

function winRun() {
  state = 'win';
  game.won = true;
  audio.stopEngine();
  audio.stopSiren();
  audio.nitro();
  const flame = player.userData.flame;
  if (flame) flame.visible = false;
  particles.burst(player.position, 0x2de2e6, 40, { speed: 10, life: 1.1 });
  particles.burst(player.position, 0xffd23f, 30, { speed: 8, life: 1.0 });
  save.bank += game.coins;
  if (game.score > save.best) save.best = game.score;
  // Unlock the next track
  const next = save.track + 1;
  const hasNext = next < TRACKS.length;
  const newlyUnlocked = hasNext && !save.unlocked.includes(next);
  if (newlyUnlocked) save.unlocked.push(next);
  persist();
  ui.winTrack.textContent = TRACKS[game.track].name;
  ui.winScore.textContent = game.score;
  ui.winCoins.textContent = game.coins;
  if (hasNext) {
    ui.btnNextTrack.classList.remove('hidden');
    ui.btnNextTrack.dataset.track = String(next);
    ui.winUnlock.textContent = newlyUnlocked ? `🔓 Unlocked: ${TRACKS[next].name}` : '';
    ui.winUnlock.classList.toggle('hidden', !newlyUnlocked);
  } else {
    ui.btnNextTrack.classList.add('hidden');
    ui.winUnlock.textContent = '🏁 All tracks cleared — you legend!';
    ui.winUnlock.classList.remove('hidden');
  }
  ui.hud.classList.add('hidden');
  ui.touch.classList.add('hidden');
  ui.win.classList.remove('hidden');
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
      <div class="car-swatch" style="background:#${carColor(car.id).toString(16).padStart(6, '0')}"></div>
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
  renderColors();
}

function renderColors() {
  if (!ui.colorList) return;
  const current = carColor(save.selected);
  ui.colorList.innerHTML = '';
  for (const c of BODY_COLORS) {
    const hexStr = '#' + c.hex.toString(16).padStart(6, '0');
    const sw = document.createElement('button');
    sw.className = 'color-swatch' + (c.hex === current ? ' active' : '');
    sw.style.background = hexStr;
    sw.title = c.name;
    sw.setAttribute('aria-label', c.name);
    sw.addEventListener('click', () => {
      save.colors[save.selected] = c.hex;
      persist();
      renderGarage();
    });
    ui.colorList.appendChild(sw);
  }
}

// ---------- Track select UI ----------
function renderTracks() {
  if (!ui.trackList) return;
  ui.trackList.innerHTML = '';
  TRACKS.forEach((t, i) => {
    const unlocked = save.unlocked.includes(i);
    const selected = save.track === i;
    const card = document.createElement('div');
    card.className = 'track-card' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked');
    const action = !unlocked
      ? `<span class="track-lock">🔒 Win previous</span>`
      : selected
      ? `<button class="car-btn owned" disabled>SELECTED</button>`
      : `<button class="car-btn select" data-track="${i}">SELECT</button>`;
    card.innerHTML = `
      <div class="track-name">${t.name}</div>
      <div class="track-tag">${t.tag}</div>
      <div class="track-goal">🏁 ${t.goal} m to win</div>
      ${action}`;
    ui.trackList.appendChild(card);
  });
  ui.trackList.querySelectorAll('[data-track]').forEach((b) =>
    b.addEventListener('click', () => {
      save.track = Number(b.dataset.track);
      persist();
      renderTracks();
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
el('btn-tracks').addEventListener('click', () => {
  renderTracks();
  ui.menu.classList.add('hidden');
  ui.tracks.classList.remove('hidden');
});
el('btn-tracks-back').addEventListener('click', () => {
  ui.tracks.classList.add('hidden');
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
el('btn-win-menu').addEventListener('click', () => {
  state = 'menu';
  ui.best.textContent = save.best;
  ui.bank.textContent = save.bank;
  ui.win.classList.add('hidden');
  ui.menu.classList.remove('hidden');
});
el('btn-win-retry').addEventListener('click', startGame);
ui.btnNextTrack.addEventListener('click', () => {
  const idx = Number(ui.btnNextTrack.dataset.track);
  if (!Number.isNaN(idx) && save.unlocked.includes(idx)) save.track = idx;
  persist();
  startGame();
});
el('btn-view').addEventListener('click', () => setView(viewMode === 'chase' ? 'cockpit' : 'chase'));

// ---------- Helpers ----------
function hits(px, pz, phw, phl, ox, oz, ohw, ohl) {
  return Math.abs(px - ox) < phw + ohw && Math.abs(pz - oz) < phl + ohl;
}
function showCombo(text) {
  ui.combo.textContent = text;
  ui.combo.classList.remove('show');
  void ui.combo.offsetWidth;
  ui.combo.classList.add('show');
}
function showBanner(name, tag) {
  ui.bannerName.textContent = name;
  ui.bannerTag.textContent = tag;
  ui.banner.classList.remove('show');
  void ui.banner.offsetWidth;
  ui.banner.classList.add('show');
}

// ---------- Environment (biome palette + day/night) ----------
const tmp = new THREE.Color();
function applyEnvironment(dt) {
  // lerp live palette toward active biome
  const k = Math.min(dt * 0.8, 1);
  pal.ground.lerp(tgt.ground, k);
  pal.skyDay.lerp(tgt.skyDay, k);
  pal.skyNight.lerp(tgt.skyNight, k);
  pal.fogDay.lerp(tgt.fogDay, k);
  pal.fogNight.lerp(tgt.fogNight, k);

  const d = (Math.sin(game.dayTime * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 1 day, 0 night
  const night = 1 - d;
  tmp.copy(pal.skyNight).lerp(pal.skyDay, d);
  scene.background = tmp.clone();
  scene.fog.color.copy(pal.fogNight).lerp(pal.fogDay, d);
  groundMat.color.copy(pal.ground).multiplyScalar(0.5 + d * 0.6);

  sun.intensity = 0.2 + d * 1.4;
  hemi.intensity = 0.22 + d * 0.6;
  sun.color.setHSL(0.09 + d * 0.04, 0.6, 0.5 + d * 0.4);
  celestial.material.color.setHex(d > 0.5 ? 0xfff2c0 : 0xdfe6ff);
  stars.material.opacity = Math.max(0, night - 0.15) * 1.1;

  if (player.userData.headlights) player.userData.headlights.emissiveIntensity = 0.4 + night * 1.8;
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
  // gently animate arch/boost glow always
  const gt = performance.now() * 0.004;
  for (const a of arches) if (a.userData.mat) a.userData.mat.emissiveIntensity = 1.6 + Math.sin(gt + a.position.z) * 0.8;
  for (const p of boostpads) if (p.userData.mat) p.userData.mat.emissiveIntensity = 1.8 + Math.sin(gt * 2 + p.position.z) * 1.0;

  if (state !== 'playing') {
    applyEnvironment(dt);
    return;
  }

  const usingNitro = input.nitro && game.nitro > 0;
  // top speed ceiling (grows a little with distance, scaled by the car)
  let vmax = Math.min(CONFIG.baseSpeed + game.distance * 0.02, CONFIG.maxSpeed) * playerStats.topSpeed;
  if (usingNitro) vmax += CONFIG.nitroBoost;
  if (game.boostBurst > 0) {
    vmax += 40;
    game.boostBurst -= dt;
  }
  // Player-controlled throttle / brake / coast
  if (input.brake) {
    game.speed -= CONFIG.brakeDecel * dt;
    if (game.speed > 4) particles.trail(new THREE.Vector3(player.position.x, 0.15, player.position.z + 2.4), 0xffffff);
  } else if (input.gas || usingNitro) {
    game.speed += CONFIG.accel * playerStats.accel * dt;
  } else {
    game.speed -= CONFIG.coastDecel * dt;
  }
  game.speed = THREE.MathUtils.clamp(game.speed, 0, vmax);

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

  // On "All Terrain" the biome cycles as you drive; fixed tracks stay put.
  if (game.mixed && game.distance >= game.nextBiomeAt) {
    game.biome = (game.biome + 1) % BIOMES.length;
    game.nextBiomeAt += CONFIG.biomeDistance;
    setBiomeTarget();
    showBanner(currentBiome().name, currentBiome().tag);
    game.nitro = Math.min(100, game.nitro + 25);
  }

  // Win when the track goal distance is reached.
  if (!game.won && game.distance >= game.goal) {
    winRun();
    return;
  }

  // combo decay
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 0;
      game.mult = 1;
    }
  }
  game.score = Math.floor(game.distance * game.mult) + game.coins * 25;

  // Steering
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (Math.abs(input.tilt) > 0.08) dir += input.tilt;
  dir = THREE.MathUtils.clamp(dir, -1, 1);
  steerSmooth = THREE.MathUtils.lerp(steerSmooth, dir, dt * 8);
  if (steerWheelEl) steerWheelEl.style.transform = `translateX(-50%) rotate(${(steerSmooth * 130).toFixed(1)}deg)`;
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
    if (!car.userData.scored && car.position.z > player.position.z + phl + ohl) {
      car.userData.scored = true;
      if (car.userData.minDx < 2.4) registerNearMiss(car.position.x);
    }
    if (car.position.z > CONFIG.despawnZ) {
      scene.remove(car);
      traffic.splice(i, 1);
    }
  }

  // ---- Rival racers (the pack you race against) ----
  game.rivalTimer -= dt;
  if (game.rivalTimer <= 0 && rivals.length < 4) {
    spawnRival();
    game.rivalTimer = 3.5 + Math.random() * 4;
  }
  for (let i = rivals.length - 1; i >= 0; i--) {
    const r = rivals[i];
    r.position.z += (game.speed - r.userData.speed) * dt;
    if (hits(player.position.x, player.position.z, phw, phl, r.position.x, r.position.z, 0.95, 2.25)) {
      endGame();
      return;
    }
    if (r.position.z > CONFIG.despawnZ) {
      scene.remove(r);
      rivals.splice(i, 1);
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
      audio.coin(THREE.MathUtils.clamp((player.position.x) / 6, -1, 1));
      continue;
    }
    if (coin.position.z > CONFIG.despawnZ) {
      scene.remove(coin);
      coins.splice(i, 1);
    }
  }

  // ---- Boost pads ----
  game.boostTimer -= dt;
  if (game.boostTimer <= 0) {
    spawnBoostPad();
    game.boostTimer = 3.5 + Math.random() * 3;
  }
  for (let i = boostpads.length - 1; i >= 0; i--) {
    const pad = boostpads[i];
    pad.position.z += game.speed * dt;
    if (!pad.userData.used && hits(player.position.x, player.position.z, phw, phl, pad.position.x, pad.position.z, 1.1, 2)) {
      pad.userData.used = true;
      game.boostBurst = 1.4;
      game.nitro = Math.min(100, game.nitro + 20);
      particles.burst(new THREE.Vector3(player.position.x, 0.6, player.position.z), 0x2de2e6, 16, { speed: 8, life: 0.6 });
      audio.nitro();
      showCombo('BOOST!');
    }
    if (pad.position.z > CONFIG.despawnZ) {
      scene.remove(pad);
      boostpads.splice(i, 1);
    }
  }

  // ---- Police ----
  updatePolice(dt, phw, phl);

  // ---- Scenery ----
  game.propTimer -= dt;
  if (game.propTimer <= 0) {
    spawnPropRow();
    game.propTimer = 0.5;
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
  game.mtnTimer -= dt;
  if (game.mtnTimer <= 0) {
    spawnMountain();
    game.mtnTimer = 2.4;
  }
  for (let i = mountains.length - 1; i >= 0; i--) {
    mountains[i].position.z += game.speed * dt * 0.85;
    if (mountains[i].position.z > CONFIG.despawnZ + 80) {
      scene.remove(mountains[i]);
      mountains.splice(i, 1);
    }
  }
  // guardrails tile continuously along the road edges (adaptive to speed)
  game.railTimer -= dt;
  if (game.railTimer <= 0) {
    spawnRail();
    game.railTimer = 19 / Math.max(game.speed, 1);
  }
  for (let i = rails.length - 1; i >= 0; i--) {
    rails[i].position.z += game.speed * dt;
    if (rails[i].position.z > CONFIG.despawnZ + 12) {
      scene.remove(rails[i]);
      rails.splice(i, 1);
    }
  }
  game.archTimer -= dt;
  if (game.archTimer <= 0) {
    spawnArch();
    game.archTimer = 5 + Math.random() * 4;
  }
  for (let i = arches.length - 1; i >= 0; i--) {
    arches[i].position.z += game.speed * dt;
    if (arches[i].position.z > CONFIG.despawnZ + 6) {
      scene.remove(arches[i]);
      arches.splice(i, 1);
    }
  }

  updateCamera(dt, usingNitro || game.boostBurst > 0);
  audio.setEngine(THREE.MathUtils.clamp((game.speed - CONFIG.baseSpeed) / CONFIG.maxSpeed + 0.3, 0, 1));
  applyEnvironment(dt);
  updateSpeedFx(usingNitro);
  updateHud();
}

function registerNearMiss(x) {
  game.combo += 1;
  game.comboTimer = 2.2;
  game.mult = Math.min(8, 1 + game.combo * 0.5);
  game.nitro = Math.min(100, game.nitro + 12);
  game.heat += 0.6;
  particles.burst(new THREE.Vector3(x, 1.2, player.position.z), 0x2de2e6, 8, { speed: 5, life: 0.5 });
  const msgs = ['NEAR MISS!', 'CLOSE ONE!', 'INSANE!', 'CRAZY!'];
  showCombo(`${msgs[Math.min(msgs.length - 1, game.combo - 1)] || 'COMBO'} x${game.mult.toFixed(1)}`);
  audio.blip(900 + game.combo * 80, 0.08, 'square', 0.14);
}

function updatePolice(dt, phw, phl) {
  game.heat += dt * (0.25 + (game.speed / CONFIG.maxSpeed) * 0.5);
  const newWanted = Math.min(5, Math.floor(game.heat / 12));
  if (newWanted > game.wanted) {
    game.wanted = newWanted;
    if (game.wanted === 1) audio.startSiren();
  }
  game.copTimer -= dt;
  if (game.wanted > 0 && cops.length < game.wanted + 1 && game.copTimer <= 0) {
    spawnCop();
    game.copTimer = 2.5;
  }
  if (game.wanted === 0) audio.stopSiren();

  const t = performance.now() * 0.006;
  let nearestCopDz = Infinity;
  let sirenPan = 0;
  let sirenVol = 0;
  for (let i = cops.length - 1; i >= 0; i--) {
    const cop = cops[i];
    const bar = cop.userData.bar;
    if (bar) {
      bar.userData.redMat.emissiveIntensity = Math.sin(t) > 0 ? 3 : 0.2;
      bar.userData.blueMat.emissiveIntensity = Math.sin(t) > 0 ? 0.2 : 3;
    }
    const usingNitro = input.nitro && game.nitro > 0;
    let closing = 5 + game.wanted * 1.5 - (game.speed - CONFIG.baseSpeed) * 0.28;
    if (usingNitro || game.boostBurst > 0) closing -= 34;
    cop.position.z -= closing * dt;
    cop.position.x = THREE.MathUtils.lerp(cop.position.x, player.position.x, dt * 1.6);
    const cdz = Math.abs(cop.position.z - player.position.z);
    if (cdz < nearestCopDz) {
      nearestCopDz = cdz;
      sirenPan = THREE.MathUtils.clamp((cop.position.x - player.position.x) / 6, -1, 1);
      sirenVol = THREE.MathUtils.clamp(1 - cdz / 80, 0, 1);
    }
    if (hits(player.position.x, player.position.z, phw, phl, cop.position.x, cop.position.z, 0.95, 2.2)) {
      endGame();
      return;
    }
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
  audio.updateSiren(sirenPan, sirenVol);
}

function updateCamera(dt, hot) {
  const shake = hot ? 0.09 : 0.025;
  const speedT = (game.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed + CONFIG.nitroBoost - CONFIG.baseSpeed);
  let baseFov;
  if (viewMode === 'cockpit') {
    // Sit inside: eye at the driver's seat looking down the road.
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x + 0.32, dt * 10);
    camera.position.y = 1.28 + (Math.random() - 0.5) * shake * 0.6;
    camera.position.z = player.position.z + 0.25;
    camera.lookAt(player.position.x + steerSmooth * 3, 1.02, player.position.z - 26);
    baseFov = 74;
  } else {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.35, dt * 4);
    camera.position.y = camBase.y + (Math.random() - 0.5) * shake;
    camera.position.z = camBase.z;
    camera.lookAt(player.position.x * 0.4, 1.2, -14);
    baseFov = 64;
  }
  const targetFov = baseFov + THREE.MathUtils.clamp(speedT, 0, 1.3) * 18;
  camera.fov += (targetFov - camera.fov) * dt * 4;
  camera.updateProjectionMatrix();
}

// Rear camera follows the player, looking backward (+Z) to feed the mirror.
function updateRearCam() {
  rearCam.position.set(player.position.x, 1.6, player.position.z + 0.2);
  rearCam.lookAt(player.position.x, 1.2, player.position.z + 30);
}

function updateSpeedFx(usingNitro) {
  const speedT = THREE.MathUtils.clamp((game.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
  ui.speedlines.style.opacity = (speedT * 0.55 + (usingNitro ? 0.35 : 0)).toFixed(2);
  ui.vignette.style.opacity = (usingNitro || game.boostBurst > 0 ? 0.7 : speedT * 0.3).toFixed(2);
}

function updateHud() {
  ui.score.textContent = game.score;
  ui.coins.textContent = game.coins;
  ui.speed.textContent = Math.round(game.speed * CONFIG.kmhDisplay);
  ui.nitroFill.style.width = `${game.nitro}%`;
  ui.mult.textContent = `x${game.mult.toFixed(1)}`;
  ui.mult.style.opacity = game.mult > 1 ? '1' : '0.4';
  ui.wanted.textContent = game.wanted > 0 ? '★'.repeat(game.wanted) : '';
  if (ui.trackFill) ui.trackFill.style.width = `${Math.min(100, (game.distance / game.goal) * 100)}%`;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  // Render the rear-view first into the mirror texture, then the main view.
  updateRearCam();
  renderer.setRenderTarget(rearRT);
  renderer.clear();
  renderer.render(scene, rearCam);
  renderer.setRenderTarget(null);
  composer.render();
  requestAnimationFrame(animate);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Boot ----------
ui.best.textContent = save.best;
ui.bank.textContent = save.bank;
loadSelectedCar();
setView(viewMode);
applyEnvironment(1);
for (let i = 0; i < 6; i++) {
  spawnPropRow();
  spawnBuilding();
  spawnMountain();
}
// pre-fill guardrails so the road edges are continuous at start
for (let i = 0; i < 16; i++) {
  spawnRail();
  const a = rails[rails.length - 1];
  const b = rails[rails.length - 2];
  if (a) a.position.z = CONFIG.spawnZ + i * 20;
  if (b) b.position.z = CONFIG.spawnZ + i * 20;
}
for (const arr of [props, buildings, mountains]) for (const o of arr) o.position.z += Math.random() * 200 - 100;
ui.loader.classList.add('hidden');
animate();
