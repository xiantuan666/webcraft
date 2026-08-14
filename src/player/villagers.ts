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
const CLIMB_SPEED = 2.2; // 每帧最大爬升速度（贴地）
const FALL_SPEED = 8; // 每帧最大下落速度

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
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  target: THREE.Vector3;
}

/** 村民实体：房主端贴地行走模拟 + 广播快照；访客端插值 */
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
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3a5a7a });
    const armMat = new THREE.MeshLambertMaterial({ color: 0x5a7a4a });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd7b0 });
    const faceTex = getVillagerFaceTexture();
    const headMat = faceTex ? new THREE.MeshLambertMaterial({ map: faceTex }) : skinMat;

    // 身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.32), robeMat);
    body.position.y = 0.78;
    // 头
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.y = 1.35;
    // 腿（枢轴在髋部）
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, 0.45, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), pantsMat);
    leftLegMesh.position.y = -0.225;
    leftLeg.add(leftLegMesh);
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, 0.45, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), pantsMat);
    rightLegMesh.position.y = -0.225;
    rightLeg.add(rightLegMesh);
    // 臂（枢轴在肩部）
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.36, 1.05, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), armMat);
    leftArmMesh.position.y = -0.21;
    leftArm.add(leftArmMesh);
    const rightArm = new THREE.Group();
    rightArm.position.set(0.36, 1.05, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), armMat);
    rightArmMesh.position.y = -0.21;
    rightArm.add(rightArmMesh);

    group.add(body, head, leftLeg, rightLeg, leftArm, rightArm);
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    this.group.add(group);
    this.map.set(id, {
      id, x, y, z, yaw, tx: x, tz: z, wait: 0, moving: false, bob: Math.random() * Math.PI * 2,
      group, leftLeg, rightLeg, leftArm, rightArm,
      target: new THREE.Vector3(x, y, z),
    });
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
    // 行走动画：双腿/双臂摆动
    for (const v of this.map.values()) {
      if (v.moving) {
        v.bob += dt * 8;
        const s = Math.sin(v.bob);
        v.leftLeg.rotation.x = s * 0.55;
        v.rightLeg.rotation.x = -s * 0.55;
        v.leftArm.rotation.x = -s * 0.45;
        v.rightArm.rotation.x = s * 0.45;
      } else {
        v.leftLeg.rotation.x = 0;
        v.rightLeg.rotation.x = 0;
        v.leftArm.rotation.x = 0;
        v.rightArm.rotation.x = 0;
      }
      v.group.position.y = v.y;
      v.group.rotation.y = v.yaw;
    }
  }

  private isInWater(x: number, y: number, z: number): boolean {
    return this.world.getBlock(Math.floor(x), Math.floor(y + 0.2), Math.floor(z)) === Block.Water;
  }

  /** 贴地行走：水平移动 + 受限 y 趋向地面 + 避障 + 落水回岸 */
  private simulate(dt: number): void {
    for (const v of this.map.values()) {
      if (v.wait > 0) {
        v.wait -= dt;
        v.moving = false;
        continue;
      }
      // 落水 → 立即传送回村中心岸上
      if (this.isInWater(v.x, v.y, v.z)) {
        v.x = this.centerX + 0.5;
        v.z = this.centerZ + 0.5;
        v.tx = v.x;
        v.tz = v.z;
        v.wait = 1;
        const g = this.groundBelow(Math.floor(v.x), Math.floor(v.z), Math.floor(v.y) + 3);
        v.y = g >= 0 ? g + 1 : v.y;
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
      const nx = v.x + (dx / dist) * step;
      const nz = v.z + (dz / dist) * step;

      // 避障：前方脚部/头部格
      const fx = Math.floor(nx + Math.sign(dx) * 0.3);
      const fz = Math.floor(nz + Math.sign(dz) * 0.3);
      const footY = Math.floor(v.y + 0.1);
      const frontSolid = this.world.isSolidAt(fx, footY, fz);
      const frontHead = this.world.isSolidAt(fx, footY + 1, fz);
      if (frontSolid) {
        if (!frontHead && !this.world.isSolidAt(fx, footY + 2, fz)) {
          // 上一格台阶：允许半步入台阶
          v.x += (dx / dist) * step * 0.5;
          v.z += (dz / dist) * step * 0.5;
        } else {
          // 撞墙：重选目标
          this.pickTarget(v);
          continue;
        }
      } else {
        v.x = nx;
        v.z = nz;
      }
      v.yaw = Math.atan2(dx, dz);

      // 贴地：y 以受限速率趋向地面（不直接赋值，避免瞬移）
      const ground = this.groundBelow(Math.floor(v.x), Math.floor(v.z), Math.floor(v.y) + 2);
      if (ground >= 0) {
        const targetY = ground + 1;
        const diff = targetY - v.y;
        if (diff > 0) {
          if (diff < 1.6) v.y += Math.min(CLIMB_SPEED * dt, diff);
          // 目标过高则保持，等待重选
        } else {
          v.y += Math.max(-FALL_SPEED * dt, diff);
        }
      }
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