import * as THREE from 'three';
import type { World } from '../world/world';
import { Block } from '../world/blockIds';
import type { VillagerSpawn } from '../world/village';
import type { VillagerInfo } from '../net/protocol';
import { getVillagerFaceTexture } from '../render/textures';

const SPEED = 0.8;
const RADIUS = 12;
const WANDER_MIN = 2;
const WANDER_MAX = 4;

interface Villager {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tx: number;
  tz: number;
  wait: number;
  moving: boolean;
  bob: number;
  group: THREE.Group;
  target: THREE.Vector3;
}

/** 村民实体：房主端本地模拟 + 广播快照；访客端插值 */
export class Villagers {
  readonly group = new THREE.Group();
  private map = new Map<string, Villager>();
  private world: World;
  private hostSim: boolean;
  private centerX = 0;
  private centerZ = 0;

  constructor(world: World, hostSim: boolean) {
    this.world = world;
    this.hostSim = hostSim;
  }

  initSpawns(spawns: VillagerSpawn[], centerX: number, centerZ: number): void {
    this.centerX = centerX;
    this.centerZ = centerZ;
    spawns.forEach((s, i) => this.create('v' + i, s.x, s.y, s.z, 0));
  }

  initRemote(list: VillagerInfo[]): void {
    for (const v of list) this.create(v.id, v.x, v.y, v.z, v.yaw);
  }

  private create(id: string, x: number, y: number, z: number, yaw: number): void {
    const group = new THREE.Group();
    const robeMat = new THREE.MeshLambertMaterial({ color: 0x6b8e4e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), robeMat);
    body.position.y = 0.4;
    const faceTex = getVillagerFaceTexture();
    const headMat = faceTex
      ? new THREE.MeshLambertMaterial({ map: faceTex })
      : new THREE.MeshLambertMaterial({ color: 0xffd7b0 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.y = 1.05;
    group.add(body, head);
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    this.group.add(group);
    this.map.set(id, { id, x, y, z, yaw, tx: x, tz: z, wait: 0, moving: false, bob: Math.random() * Math.PI * 2, group, target: new THREE.Vector3(x, y, z) });
  }

  snapshot(): VillagerInfo[] {
    const out: VillagerInfo[] = [];
    for (const v of this.map.values()) out.push({ id: v.id, x: v.x, y: v.y, z: v.z, yaw: v.yaw });
    return out;
  }

  applyRemote(list: VillagerInfo[]): void {
    const seen = new Set<string>();
    for (const info of list) {
      seen.add(info.id);
      let v = this.map.get(info.id);
      if (!v) {
        this.create(info.id, info.x, info.y, info.z, info.yaw);
        v = this.map.get(info.id)!;
      }
      v.target.set(info.x, info.y, info.z);
      v.yaw = info.yaw;
    }
    for (const id of [...this.map.keys()]) {
      if (!seen.has(id)) this.remove(id);
    }
  }

  private remove(id: string): void {
    const v = this.map.get(id);
    if (v) {
      this.group.remove(v.group);
      this.map.delete(id);
    }
  }

  update(dt: number): void {
    if (this.hostSim) this.simulate(dt);
    else this.interpolate(dt);
    for (const v of this.map.values()) {
      if (v.moving) v.bob += dt * 6;
      const bobY = v.moving ? Math.sin(v.bob) * 0.04 : 0;
      v.group.position.y = v.y + bobY;
      v.group.rotation.y = v.yaw;
    }
  }

  private simulate(dt: number): void {
    for (const v of this.map.values()) {
      if (v.wait > 0) {
        v.wait -= dt;
        v.moving = false;
        continue;
      }
      const dx = v.tx - v.x;
      const dz = v.tz - v.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        this.pickTarget(v);
        continue;
      }
      const step = SPEED * dt;
      v.x += (dx / dist) * step;
      v.z += (dz / dist) * step;
      v.yaw = Math.atan2(dx, dz);
      const ground = this.groundBelow(Math.floor(v.x), Math.floor(v.z), v.y);
      if (ground >= 0) v.y = ground + 1;
      v.moving = true;
    }
  }

  /** 从当前位置向下找第一个固体方块的地面高度 */
  private groundBelow(gx: number, gz: number, fromY: number): number {
    for (let yy = Math.floor(fromY) - 1; yy >= 0; yy--) {
      const id = this.world.getBlock(gx, yy, gz);
      if (id !== Block.Air && id !== Block.Water) return yy;
    }
    return -1;
  }

  private pickTarget(v: Villager): void {
    v.wait = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
    v.moving = false;
    for (let tries = 0; tries < 8; tries++) {
      const tx = this.centerX + (Math.random() * 2 - 1) * RADIUS;
      const tz = this.centerZ + (Math.random() * 2 - 1) * RADIUS;
      const ground = this.groundBelow(Math.floor(tx), Math.floor(tz), v.y + 3);
      if (ground < 0) continue;
      if (this.world.getBlock(Math.floor(tx), ground + 1, Math.floor(tz)) === Block.Water) continue;
      if (Math.abs(ground + 1 - v.y) > 2) continue;
      v.tx = tx;
      v.tz = tz;
      return;
    }
    v.tx = v.x;
    v.tz = v.z;
  }

  private interpolate(dt: number): void {
    const alpha = Math.min(1, dt * 8);
    for (const v of this.map.values()) {
      v.group.position.x += (v.target.x - v.group.position.x) * alpha;
      v.group.position.y += (v.target.y - v.group.position.y) * alpha;
      v.group.position.z += (v.target.z - v.group.position.z) * alpha;
      v.x = v.target.x;
      v.y = v.target.y;
      v.z = v.target.z;
      v.moving = v.group.position.distanceTo(v.target) > 0.15;
    }
  }

  dispose(): void {
    this.map.clear();
    this.group.clear();
  }
}