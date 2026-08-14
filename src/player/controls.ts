import * as THREE from 'three';
import type { World } from '../world/world';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export const EMPTY_INPUT: InputState = { forward: false, back: false, left: false, right: false, up: false, down: false };

const WALK_SPEED = 7;
const FLY_SPEED = 12;
const GRAVITY = 26;
const JUMP_SPEED = 8.5;
const PLAYER_HALF = 0.3;
const PLAYER_HEIGHT = 1.8;
const EPS = 0.001;

/** 创造模式 FPS 控制器：指针锁定 + 飞行/步行 + AABB 碰撞 */
export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  flying = true;
  flightAllowed = true;
  onGround = false;

  private world: World;
  private canvas: HTMLElement | null = null;
  private pointerLocked = false;
  onStateChange: (() => void) | null = null;

  constructor(world: World) {
    this.world = world;
  }

  spawnAt(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
  }

  setPointerLockElement(el: HTMLElement): void {
    this.canvas = el;
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === el;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
  }

  requestLock(): void {
    if (this.canvas && !this.pointerLocked) this.canvas.requestPointerLock();
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /** 是否允许飞行（生存禁飞） */
  setFlightAllowed(allowed: boolean): void {
    this.flightAllowed = allowed;
    if (!allowed) {
      this.flying = false;
      this.velocity.y = 0;
    }
  }

  toggleFlying(): void {
    if (!this.flightAllowed) return;
    this.flying = !this.flying;
    this.velocity.y = 0;
  }

  update(dt: number, input: InputState): void {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const fwd = new THREE.Vector3(-sin, 0, -cos);
    const right = new THREE.Vector3(cos, 0, -sin);
    const wish = new THREE.Vector3();
    if (input.forward) wish.add(fwd);
    if (input.back) wish.sub(fwd);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    const speed = this.flying ? FLY_SPEED : WALK_SPEED;
    this.velocity.x = wish.x * speed;
    this.velocity.z = wish.z * speed;

    if (this.flying) {
      if (input.up) this.velocity.y = FLY_SPEED * 0.9;
      else if (input.down) this.velocity.y = -FLY_SPEED * 0.9;
      else this.velocity.y = 0;
    } else {
      if (this.inWater()) {
        // 水中：浮力缓慢下沉；按住空格可跳跃（靠近岸边一跳上岸）
        this.velocity.y -= GRAVITY * 0.35 * dt;
        if (input.up && this.velocity.y < 4) this.velocity.y = JUMP_SPEED;
        if (this.velocity.y < -3) this.velocity.y = -3;      } else {
        this.velocity.y -= GRAVITY * dt;
        if (input.up && this.onGround) {
          this.velocity.y = JUMP_SPEED;
          this.onGround = false;
        }
        if (this.velocity.y < -40) this.velocity.y = -40;
      }
    }

    this.onGround = false;
    this.moveAxis('y', this.velocity.y * dt);
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);

    if (this.onStateChange) this.onStateChange();
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number): void {
    this.position[axis] += amount;
    if (!this.collides()) {
      if (axis === 'y' && amount < 0) this.onGround = false;
      return;
    }
    // 自动上台阶：水平移动受阻时尝试抬升 1 格（水中上岸/走 1 格台阶）
    if (axis !== 'y' && amount !== 0 && this.position.y + 1 < this.world.config.height) {
      this.position.y += 1;
      if (!this.collides()) return;
      this.position.y -= 1;
    }
    if (axis === 'x') {
      if (amount > 0) this.position.x = Math.floor(this.position.x + PLAYER_HALF) - PLAYER_HALF - EPS;
      else this.position.x = Math.floor(this.position.x - PLAYER_HALF) + 1 + PLAYER_HALF + EPS;
      this.velocity.x = 0;
    } else if (axis === 'z') {
      if (amount > 0) this.position.z = Math.floor(this.position.z + PLAYER_HALF) - PLAYER_HALF - EPS;
      else this.position.z = Math.floor(this.position.z - PLAYER_HALF) + 1 + PLAYER_HALF + EPS;
      this.velocity.z = 0;
    } else {
      if (amount > 0) {
        this.position.y = Math.floor(this.position.y + PLAYER_HEIGHT) - PLAYER_HEIGHT - EPS;
        this.velocity.y = 0;
      } else {
        this.position.y = Math.floor(this.position.y) + 1 + EPS;
        this.velocity.y = 0;
        this.onGround = true;
      }
    }
  }

  private inWater(): boolean {
    const fx = Math.floor(this.position.x);
    const fy = Math.floor(this.position.y + 0.4);
    const fz = Math.floor(this.position.z);
    return this.world.getBlock(fx, fy, fz) === 6; // Block.Water
  }

  private collides(): boolean {
    const { x, y, z } = this.position;
    const minX = Math.floor(x - PLAYER_HALF);
    const maxX = Math.floor(x + PLAYER_HALF);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT - EPS);
    const minZ = Math.floor(z - PLAYER_HALF);
    const maxZ = Math.floor(z + PLAYER_HALF);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (this.world.isSolidAt(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }
}