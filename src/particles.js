import * as THREE from 'three';

/**
 * Lightweight particle bursts (coin sparkle, nitro sparks, crash debris).
 * Each particle is a small mesh recycled from a pool for performance.
 */
export class Particles {
  constructor(scene, poolSize = 160) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 1
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  _get() {
    const m = this.pool.pop();
    if (!m) return null;
    m.visible = true;
    this.active.push(m);
    return m;
  }

  _release(m) {
    m.visible = false;
    this.pool.push(m);
  }

  burst(pos, color, count = 12, opts = {}) {
    const speed = opts.speed ?? 6;
    const life = opts.life ?? 0.6;
    const gravity = opts.gravity ?? -14;
    const scale = opts.scale ?? 1;
    for (let i = 0; i < count; i++) {
      const m = this._get();
      if (!m) break;
      m.position.copy(pos);
      m.scale.setScalar(scale * (0.6 + Math.random() * 0.8));
      m.material.color.setHex(color);
      m.material.emissive.setHex(color);
      m.material.opacity = 1;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * speed;
      m.userData.vel = new THREE.Vector3(
        Math.cos(a) * speed * (0.4 + Math.random()),
        up,
        Math.sin(a) * speed * (0.4 + Math.random())
      );
      m.userData.life = life * (0.6 + Math.random() * 0.6);
      m.userData.maxLife = m.userData.life;
      m.userData.gravity = gravity;
    }
  }

  /** Continuous nitro flame sparks trailing from a position. */
  trail(pos, color = 0x2de2e6) {
    const m = this._get();
    if (!m) return;
    m.position.copy(pos);
    m.position.x += (Math.random() - 0.5) * 0.4;
    m.position.y += (Math.random() - 0.5) * 0.2;
    m.scale.setScalar(0.5 + Math.random() * 0.7);
    m.material.color.setHex(color);
    m.material.emissive.setHex(color);
    m.material.opacity = 1;
    m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, 6 + Math.random() * 5);
    m.userData.life = 0.3;
    m.userData.maxLife = 0.3;
    m.userData.gravity = 0;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i];
      m.userData.life -= dt;
      if (m.userData.life <= 0) {
        this.active.splice(i, 1);
        this._release(m);
        continue;
      }
      m.userData.vel.y += m.userData.gravity * dt;
      m.position.addScaledVector(m.userData.vel, dt);
      const t = m.userData.life / m.userData.maxLife;
      m.material.opacity = t;
      m.scale.multiplyScalar(0.985);
      m.rotation.x += dt * 8;
      m.rotation.y += dt * 6;
    }
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this._release(this.active[i]);
    }
    this.active.length = 0;
  }
}
