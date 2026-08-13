import * as THREE from 'three';

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

/** 简单粒子系统：方块挖掘/破坏碎片 */
export class Particles {
  readonly group = new THREE.Group();
  private pool: Particle[] = [];

  spawn(x: number, y: number, z: number, color: number, count: number, spread = 2.5): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      p.sprite.position.set(x, y, z);
      p.sprite.material.color.setHex(color);
      p.vel.set(
        (Math.random() - 0.5) * spread,
        Math.random() * spread * 0.8 + 1,
        (Math.random() - 0.5) * spread,
      );
      p.life = 0.5 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.sprite.material.opacity = 1;
      p.sprite.visible = true;
    }
  }

  private acquire(): Particle {
    const dead = this.pool.find((p) => !p.sprite.visible);
    if (dead) return dead;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.14, 0.14, 0.14);
    sprite.visible = false;
    this.group.add(sprite);
    const p: Particle = { sprite, vel: new THREE.Vector3(), life: 0, maxLife: 1 };
    this.pool.push(p);
    return p;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.vel.y -= 22 * dt;
      p.sprite.position.x += p.vel.x * dt;
      p.sprite.position.y += p.vel.y * dt;
      p.sprite.position.z += p.vel.z * dt;
      p.sprite.material.opacity = Math.max(0, p.life / p.maxLife);
    }
  }

  dispose(): void {
    this.group.clear();
    this.pool = [];
  }
}