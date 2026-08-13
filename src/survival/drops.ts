import * as THREE from 'three';
import type { World } from '../world/world';
import { getItemSpriteTexture } from '../render/itemTextures';

export interface DropData {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  item: number;
  count: number;
}

interface Drop {
  data: DropData;
  sprite: THREE.Sprite;
  bob: number;
  resting: boolean;
  picked: boolean;
}

/** 掉落物：房主权威创建/移除，访客经广播渲染；拾取由玩家触发 */
export class Drops {
  readonly group = new THREE.Group();
  private map = new Map<string, Drop>();
  private nextId = 0;
  onPickupRequest: ((id: string) => void) | null = null;

  /** 房主本地生成掉落（世界级），返回掉落数据（含 id） */
  spawn(item: number, count: number, x: number, y: number, z: number): DropData {
    const id = 'd' + (this.nextId++);
    const data: DropData = {
      id, x: x + 0.5, y: y + 0.5, z: z + 0.5,
      vx: (Math.random() - 0.5) * 2.5, vy: 2.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 2.5,
      item, count,
    };
    this.add(data);
    return data;
  }

  add(data: DropData): void {
    if (this.map.has(data.id)) return;
    const tex = getItemSpriteTexture(data.item);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.35, 0.35, 0.35);
    sprite.position.set(data.x, data.y, data.z);
    this.group.add(sprite);
    this.map.set(data.id, { data, sprite, bob: Math.random() * Math.PI * 2, resting: false, picked: false });
  }

  applySpawn(data: DropData): void {
    this.add(data);
  }

  applyRemove(id: string): void {
    this.remove(id);
  }

  getData(id: string): DropData | null {
    return this.map.get(id)?.data ?? null;
  }

  remove(id: string): void {
    const d = this.map.get(id);
    if (d) {
      this.group.remove(d.sprite);
      this.map.delete(id);
    }
  }

  update(dt: number, world: World, playerPos: THREE.Vector3): void {
    for (const d of this.map.values()) {
      const data = d.data;
      if (!d.resting) {
        data.vy -= 22 * dt;
        data.x += data.vx * dt;
        data.y += data.vy * dt;
        data.z += data.vz * dt;
        const gx = Math.floor(data.x);
        const gy = Math.floor(data.y);
        const gz = Math.floor(data.z);
        if (world.isSolidAt(gx, gy, gz)) {
          data.y = gy + 1.01;
          d.resting = true;
          data.vx = 0;
          data.vz = 0;
          data.vy = 0;
        }
      }
      d.bob += dt * 2;
      d.sprite.position.set(data.x, data.y + Math.sin(d.bob) * 0.05, data.z);
      if (!d.picked && this.onPickupRequest && playerPos.distanceTo(d.sprite.position) < 1.5) {
        d.picked = true;
        this.onPickupRequest(data.id);
      }
    }
  }

  dispose(): void {
    this.group.clear();
    this.map.clear();
  }
}