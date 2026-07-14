import * as THREE from 'three';

/**
 * All 3D geometry in Fortuner Rush is generated procedurally in code so the
 * game ships with zero external asset files and runs on any device.
 */

function boxMesh(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.2,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? false;
  return mesh;
}

function makeWheels(group, bodyWidth, wheelZPositions, y = -0.35) {
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xbfc4cc,
    metalness: 0.8,
    roughness: 0.3
  });
  const wheels = [];
  for (const z of wheelZPositions) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * (bodyWidth / 2 + 0.02), y, z);
      wheel.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  return wheels;
}

/**
 * The hero vehicle: a chunky Toyota-Fortuner-style SUV.
 * Returns { group, wheels } — wheels are spun in the game loop.
 */
export function buildFortuner(color = 0xffffff) {
  const car = new THREE.Group();

  // Lower body
  const lower = boxMesh(1.9, 0.75, 4.4, color, { metalness: 0.35, roughness: 0.35 });
  lower.position.y = 0.1;
  car.add(lower);

  // Cabin / greenhouse (slightly narrower, sits on top and toward the rear)
  const cabin = boxMesh(1.72, 0.7, 2.5, color, { metalness: 0.35, roughness: 0.35 });
  cabin.position.set(0, 0.72, -0.15);
  car.add(cabin);

  // Roof rails
  for (const side of [-1, 1]) {
    const rail = boxMesh(0.08, 0.06, 2.2, 0x1a1c22, { metalness: 0.6, roughness: 0.4 });
    rail.position.set(side * 0.72, 1.09, -0.15);
    car.add(rail);
  }

  // Front bonnet lip / grille housing
  const grille = boxMesh(1.86, 0.4, 0.3, 0x15171d, { metalness: 0.7, roughness: 0.4 });
  grille.position.set(0, 0.12, 2.2);
  car.add(grille);

  // Chrome grille bars
  for (let i = 0; i < 3; i++) {
    const bar = boxMesh(1.5, 0.05, 0.05, 0xd8dde3, { metalness: 0.9, roughness: 0.2 });
    bar.position.set(0, 0.02 + i * 0.12, 2.34);
    car.add(bar);
  }

  // Windows (dark glass) — windshield, rear, sides
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e18,
    metalness: 0.4,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85
  });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.55, 0.08), glassMat);
  windshield.position.set(0, 0.75, 1.12);
  windshield.rotation.x = -0.32;
  car.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 0.08), glassMat);
  rearGlass.position.set(0, 0.75, -1.42);
  rearGlass.rotation.x = 0.34;
  car.add(rearGlass);
  for (const side of [-1, 1]) {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 2.1), glassMat);
    sideGlass.position.set(side * 0.83, 0.75, -0.15);
    car.add(sideGlass);
  }

  // Headlights (emissive)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff4c2,
    emissive: 0xfff0b0,
    emissiveIntensity: 1.4
  });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.08), headMat);
    hl.position.set(side * 0.62, 0.2, 2.36);
    car.add(hl);
  }
  // Tail lights (red emissive)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff0000,
    emissiveIntensity: 1.2
  });
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.08), tailMat);
    tl.position.set(side * 0.66, 0.3, -2.22);
    car.add(tl);
  }

  // Bumpers
  const frontBumper = boxMesh(1.94, 0.28, 0.2, 0x2a2d34, { metalness: 0.5 });
  frontBumper.position.set(0, -0.15, 2.28);
  car.add(frontBumper);
  const rearBumper = boxMesh(1.94, 0.28, 0.2, 0x2a2d34, { metalness: 0.5 });
  rearBumper.position.set(0, -0.15, -2.28);
  car.add(rearBumper);

  const wheels = makeWheels(car, 1.9, [1.45, -1.45], -0.28);

  car.userData.headlights = headMat;
  return { group: car, wheels };
}

const TRAFFIC_COLORS = [0xd23b3b, 0x2f6bd2, 0x2fa84f, 0xe0a020, 0x8a8f99, 0x9b4dd2, 0x20b7c4];

/** A simpler oncoming/traffic vehicle. */
export function buildTrafficCar() {
  const car = new THREE.Group();
  const color = TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0];
  const isTruck = Math.random() < 0.28;

  const len = isTruck ? 5.4 : 3.9;
  const height = isTruck ? 1.5 : 0.7;

  const body = boxMesh(1.8, height, len, color, { metalness: 0.3, roughness: 0.5 });
  body.position.y = height / 2 - 0.1;
  car.add(body);

  if (!isTruck) {
    const cabin = boxMesh(1.66, 0.55, 2.0, color, { metalness: 0.3, roughness: 0.5 });
    cabin.position.set(0, height + 0.2, -0.1);
    car.add(cabin);
  } else {
    // truck cab at the front
    const cab = boxMesh(1.8, 1.0, 1.4, color, { metalness: 0.3 });
    cab.position.set(0, height + 0.35, len / 2 - 0.8);
    car.add(cab);
  }

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e18,
    metalness: 0.4,
    roughness: 0.2,
    transparent: true,
    opacity: 0.8
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.6), glassMat);
  glass.position.set(0, height + 0.25, -0.1);
  car.add(glass);

  // Tail lights face the player (traffic moves same direction, slower)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff3030,
    emissive: 0xff0000,
    emissiveIntensity: 1.0
  });
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), tailMat);
    tl.position.set(side * 0.6, height / 2, len / 2 + 0.02);
    car.add(tl);
  }

  makeWheels(car, 1.8, isTruck ? [len / 2 - 1, -len / 2 + 1, 0] : [len / 2 - 1.1, -len / 2 + 1.1], -0.28);

  car.userData.length = len;
  return car;
}

/** A spinning collectible coin. */
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

/** A roadside prop (tree or streetlight) for scenery variety. */
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
    // streetlight
    const pole = boxMesh(0.14, 3.4, 0.14, 0x3a3d45, { metalness: 0.6 });
    pole.position.y = 1.7;
    group.add(pole);
    const arm = boxMesh(0.9, 0.12, 0.12, 0x3a3d45, { metalness: 0.6 });
    arm.position.set(0.45, 3.4, 0);
    group.add(arm);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfff2c0,
        emissive: 0xffe08a,
        emissiveIntensity: 1.6
      })
    );
    bulb.position.set(0.9, 3.32, 0);
    group.add(bulb);
  }
  return group;
}
