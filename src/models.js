import * as THREE from 'three';

/**
 * All 3D geometry in Fortuner Rush is generated procedurally in code so the
 * game ships with zero external asset files and runs on any device.
 * Every car builder returns { group, wheels } — wheels are spun in the loop.
 */

function boxMesh(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.5,
    metalness: opts.metalness ?? 0.35,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? false;
  return mesh;
}

const GLASS = () =>
  new THREE.MeshStandardMaterial({
    color: 0x0a0e18,
    metalness: 0.5,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85
  });

function makeWheels(group, bodyWidth, wheelZPositions, radius = 0.42, y = -0.28) {
  const wheelGeo = new THREE.CylinderGeometry(radius, radius, 0.34, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.85, roughness: 0.25 });
  const wheels = [];
  for (const z of wheelZPositions) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * (bodyWidth / 2 + 0.02), y, z);
      wheel.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, 0.36, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  return wheels;
}

function addLights(car, frontZ, backZ, y = 0.2) {
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff4c2,
    emissive: 0xfff0b0,
    emissiveIntensity: 1.4
  });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headMat);
    hl.position.set(side * 0.62, y, frontZ);
    car.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 1.2 });
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.08), tailMat);
    tl.position.set(side * 0.66, y + 0.1, backZ);
    car.add(tl);
  }
  car.userData.headlights = headMat;
}

/* ------------------------------------------------------------------ */
/* Hero cars                                                           */
/* ------------------------------------------------------------------ */

/** Toyota-Fortuner-style tall SUV. */
export function buildFortuner(color = 0xffffff) {
  const car = new THREE.Group();
  const lower = boxMesh(1.9, 0.75, 4.4, color, { metalness: 0.4, roughness: 0.35 });
  lower.position.y = 0.1;
  car.add(lower);
  const cabin = boxMesh(1.72, 0.7, 2.5, color, { metalness: 0.4, roughness: 0.35 });
  cabin.position.set(0, 0.72, -0.15);
  car.add(cabin);
  for (const side of [-1, 1]) {
    const rail = boxMesh(0.08, 0.06, 2.2, 0x1a1c22, { metalness: 0.6 });
    rail.position.set(side * 0.72, 1.09, -0.15);
    car.add(rail);
  }
  const grille = boxMesh(1.86, 0.4, 0.3, 0x15171d, { metalness: 0.7 });
  grille.position.set(0, 0.12, 2.2);
  car.add(grille);
  for (let i = 0; i < 3; i++) {
    const bar = boxMesh(1.5, 0.05, 0.05, 0xd8dde3, { metalness: 0.9, roughness: 0.2 });
    bar.position.set(0, 0.02 + i * 0.12, 2.34);
    car.add(bar);
  }
  // Clearer tinted windshield (stored so cockpit view can hide it)
  const windMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a3a52,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.6,
    transparent: true,
    opacity: 0.5,
    clearcoat: 1
  });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.55, 0.06), windMat);
  windshield.position.set(0, 0.75, 1.12);
  windshield.rotation.x = -0.32;
  car.add(windshield);
  car.userData.windshield = windshield;

  const glass = GLASS();
  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 0.08), glass);
  rear.position.set(0, 0.75, -1.42);
  rear.rotation.x = 0.34;
  car.add(rear);
  for (const side of [-1, 1]) {
    const sg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 2.1), glass);
    sg.position.set(side * 0.83, 0.75, -0.15);
    car.add(sg);
  }

  // Wheel arches (dark cladding)
  const archMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 });
  for (const z of [1.45, -1.45]) {
    for (const side of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 12, Math.PI), archMat);
      arch.position.set(side * 0.95, -0.05, z);
      arch.rotation.y = Math.PI / 2;
      car.add(arch);
    }
  }

  // Side mirrors
  const mirrorArmMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.4 });
  const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0x9fb4d0, metalness: 0.9, roughness: 0.1 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.12), mirrorArmMat);
    arm.position.set(side * 1.02, 0.62, 1.0);
    car.add(arm);
    const mg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.26), mirrorGlassMat);
    mg.position.set(side * 1.16, 0.64, 1.0);
    car.add(mg);
  }

  // Front badge / chrome accent
  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1, roughness: 0.2 })
  );
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 0.26, 2.36);
  car.add(badge);

  // Simple interior (seats + dashboard + steering wheel) for cockpit view
  const interior = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.8 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.28, 0.5), interior);
  dash.position.set(0, 0.42, 0.85);
  car.add(dash);
  for (const side of [-1, 1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), interior);
    seat.position.set(side * 0.4, 0.35, -0.2);
    car.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.15), interior);
    back.position.set(side * 0.4, 0.6, -0.45);
    car.add(back);
  }
  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.03, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 })
  );
  wheelRim.position.set(0.4, 0.5, 0.55);
  wheelRim.rotation.x = 0.5;
  car.add(wheelRim);

  addLights(car, 2.36, -2.22, 0.2);
  const wheels = makeWheels(car, 1.9, [1.45, -1.45], 0.44, -0.28);
  return { group: car, wheels };
}

/** Low, sleek sports car (Neon Speedster). */
export function buildSportsCar(color = 0xff2a6d) {
  const car = new THREE.Group();
  const lower = boxMesh(1.86, 0.5, 4.3, color, { metalness: 0.55, roughness: 0.2 });
  lower.position.y = 0.0;
  car.add(lower);
  // sloped nose
  const nose = boxMesh(1.7, 0.32, 1.2, color, { metalness: 0.55, roughness: 0.2 });
  nose.position.set(0, -0.08, 1.9);
  car.add(nose);
  const cabin = boxMesh(1.5, 0.5, 1.8, color, { metalness: 0.55, roughness: 0.2 });
  cabin.position.set(0, 0.42, -0.2);
  car.add(cabin);
  const glass = GLASS();
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.42, 0.08), glass);
  ws.position.set(0, 0.5, 0.7);
  ws.rotation.x = -0.55;
  car.add(ws);
  for (const side of [-1, 1]) {
    const sg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 1.5), glass);
    sg.position.set(side * 0.72, 0.46, -0.2);
    car.add(sg);
  }
  // rear spoiler
  const wing = boxMesh(1.7, 0.06, 0.4, 0x15171d, { metalness: 0.7 });
  wing.position.set(0, 0.5, -2.1);
  car.add(wing);
  for (const side of [-1, 1]) {
    const stand = boxMesh(0.1, 0.35, 0.1, 0x15171d);
    stand.position.set(side * 0.6, 0.32, -2.1);
    car.add(stand);
  }
  addLights(car, 2.44, -2.14, 0.05);
  const wheels = makeWheels(car, 1.86, [1.5, -1.5], 0.4, -0.18);
  return { group: car, wheels };
}

/** Wide American muscle car (Charger R/T) with hood scoop + stripes. */
export function buildMuscleCar(color = 0x1a1a1a) {
  const car = new THREE.Group();
  const lower = boxMesh(1.98, 0.6, 4.6, color, { metalness: 0.45, roughness: 0.3 });
  lower.position.y = 0.05;
  car.add(lower);
  const cabin = boxMesh(1.8, 0.55, 2.0, color, { metalness: 0.45, roughness: 0.3 });
  cabin.position.set(0, 0.55, -0.3);
  car.add(cabin);
  // racing stripes
  for (const off of [-0.32, 0.32]) {
    const stripe = boxMesh(0.28, 0.02, 4.6, 0xf4f4f4, { metalness: 0.3, roughness: 0.6 });
    stripe.position.set(off, 0.36, 0);
    car.add(stripe);
  }
  // hood scoop
  const scoop = boxMesh(0.7, 0.18, 0.9, 0x0d0d0d, { metalness: 0.6 });
  scoop.position.set(0, 0.42, 1.5);
  car.add(scoop);
  const glass = GLASS();
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.46, 0.08), glass);
  ws.position.set(0, 0.6, 0.75);
  ws.rotation.x = -0.42;
  car.add(ws);
  for (const side of [-1, 1]) {
    const sg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 1.7), glass);
    sg.position.set(side * 0.82, 0.56, -0.3);
    car.add(sg);
  }
  addLights(car, 2.54, -2.28, 0.12);
  const wheels = makeWheels(car, 1.98, [1.6, -1.55], 0.46, -0.2);
  return { group: car, wheels };
}

/** Exotic wide supercar (Velocity X) with big rear wing. */
export function buildSuperCar(color = 0xffd23f) {
  const car = new THREE.Group();
  const lower = boxMesh(1.94, 0.44, 4.5, color, { metalness: 0.6, roughness: 0.15 });
  lower.position.y = -0.02;
  car.add(lower);
  const nose = boxMesh(1.8, 0.26, 1.4, color, { metalness: 0.6, roughness: 0.15 });
  nose.position.set(0, -0.14, 1.9);
  car.add(nose);
  const cabin = boxMesh(1.5, 0.42, 1.5, 0x101216, { metalness: 0.6, roughness: 0.2 });
  cabin.position.set(0, 0.34, -0.1);
  car.add(cabin);
  const glass = GLASS();
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.08), glass);
  ws.position.set(0, 0.42, 0.7);
  ws.rotation.x = -0.62;
  car.add(ws);
  // large rear wing
  const wing = boxMesh(1.9, 0.08, 0.55, 0x101216, { metalness: 0.7 });
  wing.position.set(0, 0.62, -2.2);
  car.add(wing);
  for (const side of [-1, 1]) {
    const stand = boxMesh(0.12, 0.5, 0.12, 0x101216);
    stand.position.set(side * 0.7, 0.38, -2.2);
    car.add(stand);
  }
  // side intakes (emissive accent)
  for (const side of [-1, 1]) {
    const intake = boxMesh(0.12, 0.2, 0.9, color, { emissive: color, emissiveIntensity: 0.4 });
    intake.position.set(side * 0.98, 0.05, -0.8);
    car.add(intake);
  }
  addLights(car, 2.6, -2.2, -0.02);
  const wheels = makeWheels(car, 1.94, [1.55, -1.55], 0.42, -0.22);
  return { group: car, wheels };
}

/** Registry of playable cars with gameplay stats (multipliers on base). */
export const CARS = [
  { id: 'fortuner', name: 'Fortuner GX', price: 0, color: 0xffffff, topSpeed: 1.0, accel: 1.0, handling: 1.0, build: buildFortuner },
  { id: 'speedster', name: 'Neon Speedster', price: 1200, color: 0xff2a6d, topSpeed: 1.22, accel: 1.2, handling: 1.18, build: buildSportsCar },
  { id: 'charger', name: 'Charger R/T', price: 3200, color: 0x161616, topSpeed: 1.14, accel: 1.16, handling: 0.96, build: buildMuscleCar },
  { id: 'velocity', name: 'Velocity X', price: 7000, color: 0xffd23f, topSpeed: 1.4, accel: 1.34, handling: 1.26, build: buildSuperCar }
];

/* ------------------------------------------------------------------ */
/* Traffic, police, collectibles, scenery                             */
/* ------------------------------------------------------------------ */

const TRAFFIC_COLORS = [0xd23b3b, 0x2f6bd2, 0x2fa84f, 0xe0a020, 0x8a8f99, 0x9b4dd2, 0x20b7c4];

export function buildTrafficCar() {
  const car = new THREE.Group();
  const color = TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0];
  const isTruck = Math.random() < 0.28;
  const len = isTruck ? 5.4 : 3.9;
  const height = isTruck ? 1.5 : 0.7;
  const body = boxMesh(1.8, height, len, color, { roughness: 0.5 });
  body.position.y = height / 2 - 0.1;
  car.add(body);
  if (!isTruck) {
    const cabin = boxMesh(1.66, 0.55, 2.0, color, { roughness: 0.5 });
    cabin.position.set(0, height + 0.2, -0.1);
    car.add(cabin);
  } else {
    const cab = boxMesh(1.8, 1.0, 1.4, color);
    cab.position.set(0, height + 0.35, len / 2 - 0.8);
    car.add(cab);
  }
  const glass = GLASS();
  const g = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.6), glass);
  g.position.set(0, height + 0.25, -0.1);
  car.add(g);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff0000, emissiveIntensity: 1.0 });
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), tailMat);
    tl.position.set(side * 0.6, height / 2, len / 2 + 0.02);
    car.add(tl);
  }
  makeWheels(car, 1.8, isTruck ? [len / 2 - 1, -len / 2 + 1, 0] : [len / 2 - 1.1, -len / 2 + 1.1], 0.42, -0.28);
  car.userData.length = len;
  return car;
}

/** Police interceptor with a flashing light bar. Returns { group, bar }. */
export function buildCopCar() {
  const car = new THREE.Group();
  const body = boxMesh(1.9, 0.7, 4.4, 0x101418, { metalness: 0.4, roughness: 0.4 });
  body.position.y = 0.1;
  car.add(body);
  // white doors
  const door = boxMesh(1.92, 0.4, 1.6, 0xf2f4f7, { roughness: 0.5 });
  door.position.set(0, 0.05, -0.1);
  car.add(door);
  const cabin = boxMesh(1.7, 0.6, 2.0, 0x101418, { metalness: 0.4 });
  cabin.position.set(0, 0.68, -0.2);
  car.add(cabin);
  const glass = GLASS();
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), glass);
  ws.position.set(0, 0.72, 0.85);
  ws.rotation.x = -0.35;
  car.add(ws);
  addLights(car, 2.32, -2.22, 0.16);

  // light bar
  const bar = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1560ff, emissive: 0x1560ff, emissiveIntensity: 2 });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), redMat);
  red.position.set(-0.3, 1.05, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), blueMat);
  blue.position.set(0.3, 1.05, -0.2);
  bar.add(red, blue);
  bar.userData = { redMat, blueMat };
  car.add(bar);

  makeWheels(car, 1.9, [1.45, -1.45], 0.44, -0.28);
  car.userData.length = 4.4;
  return { group: car, bar };
}

export function buildCoin() {
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    metalness: 0.9,
    roughness: 0.25,
    emissive: 0xffb000,
    emissiveIntensity: 0.5
  });
  const coin = new THREE.Mesh(geo, mat);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  return coin;
}

export function buildProp(kind) {
  const group = new THREE.Group();
  if (kind === 'tree') {
    const trunk = boxMesh(0.35, 1.4, 0.35, 0x5a3a1a, { roughness: 1 });
    trunk.position.y = 0.7;
    group.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f3f, roughness: 1 });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.25, 1.2, 8), leafMat);
      cone.position.y = 1.6 + i * 0.7;
      cone.castShadow = true;
      group.add(cone);
    }
  } else {
    const pole = boxMesh(0.14, 3.4, 0.14, 0x3a3d45, { metalness: 0.6 });
    pole.position.y = 1.7;
    group.add(pole);
    const arm = boxMesh(0.9, 0.12, 0.12, 0x3a3d45, { metalness: 0.6 });
    arm.position.set(0.45, 3.4, 0);
    group.add(arm);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe08a, emissiveIntensity: 1.6 })
    );
    bulb.position.set(0.9, 3.32, 0);
    group.add(bulb);
  }
  group.userData.isLight = kind === 'light';
  return group;
}

/** A city building for the night skyline. Windows glow at night. */
export function buildBuilding() {
  const group = new THREE.Group();
  const w = 6 + Math.random() * 8;
  const d = 6 + Math.random() * 8;
  const h = 12 + Math.random() * 36;
  const shade = 0x1a2030 + ((Math.random() * 0x101010) | 0);
  const body = boxMesh(w, h, d, shade, { roughness: 0.9, metalness: 0.1 });
  body.position.y = h / 2;
  body.castShadow = false;
  group.add(body);

  // emissive window grid on the +Z face (facing the road)
  const winColor = Math.random() < 0.5 ? 0xffd98a : 0x8ad4ff;
  const winMat = new THREE.MeshStandardMaterial({
    color: winColor,
    emissive: winColor,
    emissiveIntensity: 1.4
  });
  const cols = Math.max(2, Math.floor(w / 2));
  const rows = Math.max(3, Math.floor(h / 3));
  const winGeo = new THREE.PlaneGeometry(0.7, 1.1);
  const windows = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.35) continue; // some dark windows
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(-w / 2 + 1 + c * (w - 2) / (cols - 1 || 1), 2 + r * (h - 3) / rows, d / 2 + 0.05);
      group.add(win);
      windows.push(win);
    }
  }
  group.userData = { windows, winMat };
  return group;
}

/* ------------------------------------------------------------------ */
/* Biome scenery                                                       */
/* ------------------------------------------------------------------ */

/** Tall tropical palm for the jungle biome. */
export function buildPalm() {
  const g = new THREE.Group();
  const trunk = boxMesh(0.28, 3.2, 0.28, 0x6b4a24, { roughness: 1 });
  trunk.position.y = 1.6;
  trunk.rotation.z = (Math.random() - 0.5) * 0.2;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2fae4f, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.0, 5), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.7, 3.1, Math.sin(a) * 0.7);
    leaf.rotation.z = Math.cos(a) * 0.9;
    leaf.rotation.x = Math.sin(a) * 0.9;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

/** Leafy bush cluster (jungle undergrowth). */
export function buildBush() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f7a35, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.5, 8, 8), mat);
    s.position.set((Math.random() - 0.5) * 1.2, 0.5, (Math.random() - 0.5) * 1.2);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

/** Desert rock. */
export function buildRock() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 1, flatShading: true });
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 1.2, 0), mat);
  rock.position.y = 0.4;
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  return rock;
}

/** Saguaro-style cactus. */
export function buildCactus() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f7d4a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 3, 10), mat);
  body.position.y = 1.5;
  body.castShadow = true;
  g.add(body);
  for (const side of [-1, 1]) {
    if (Math.random() < 0.5) continue;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.1, 8), mat);
    arm.position.set(side * 0.45, 1.7 + Math.random() * 0.6, 0);
    arm.rotation.z = side * 0.9;
    g.add(arm);
  }
  return g;
}

/** A long, distant mountain ridge chunk that scrolls on the horizon. */
export function buildMountainRidge(tint = 0x394b63) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 1, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const h = 16 + Math.random() * 34;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 10, h, 5), mat);
    peak.position.set((Math.random() - 0.5) * 8, h / 2, i * 22 - 44);
    g.add(peak);
  }
  g.userData.length = 120;
  return g;
}

/** Neon arch spanning the road (Fast & Furious street-race vibe). */
export function buildArch(color = 0x2de2e6) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 });
  const barW = 0.4;
  const span = 12;
  const top = new THREE.Mesh(new THREE.BoxGeometry(span, barW, barW), mat);
  top.position.y = 6.4;
  g.add(top);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(barW, 6.4, barW), mat);
    post.position.set(side * (span / 2 - 0.2), 3.2, 0);
    g.add(post);
  }
  g.userData.mat = mat;
  return g;
}

/** Roadside neon billboard. */
export function buildBillboard() {
  const g = new THREE.Group();
  const pole = boxMesh(0.2, 4, 0.2, 0x2a2d34, { metalness: 0.6 });
  pole.position.y = 2;
  g.add(pole);
  const colors = [0xff2a6d, 0x2de2e6, 0xffd23f, 0x9b4dd2];
  const c = colors[(Math.random() * colors.length) | 0];
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2, 0.15),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.4 })
  );
  panel.position.set(0, 4.6, 0);
  g.add(panel);
  return g;
}

/** A glowing boost pad laid on the road. Returns mesh with userData.mat. */
export function buildBoostPad() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2de2e6,
    emissive: 0x2de2e6,
    emissiveIntensity: 2.4,
    transparent: true,
    opacity: 0.9
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4), mat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.05;
  // chevrons — kept flat on the pad (lifted slightly along local normal)
  const chevMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
  for (let i = 0; i < 3; i++) {
    const chev = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), chevMat);
    chev.position.set(0, -1.2 + i * 1.2, 0.02);
    pad.add(chev);
  }
  pad.userData.mat = mat;
  return pad;
}

/** A dome of stars for the night sky. Opacity is driven by night factor. */
export function makeStarfield(count = 700) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 220 + Math.random() * 140;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    pos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    pos[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 30;
    pos[i * 3 + 2] = -Math.abs(Math.sin(theta) * Math.sin(phi)) * r - 60;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false
  });
  return new THREE.Points(geo, mat);
}
