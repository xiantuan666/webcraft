import * as THREE from 'three';
import type { World } from '../world/world';
import { Block } from '../world/blockIds';

export interface RayHit {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
}

export const REACH = 6;

/** 体素 DDA 射线检测（跳过起点所在格） */
export function raycast(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = dir.x !== 0 ? (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX : Infinity;
  let tMaxY = dir.y !== 0 ? (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = dir.z !== 0 ? (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ : Infinity;

  let prevX = x;
  let prevY = y;
  let prevZ = z;
  for (let i = 0; i < 128; i++) {
    prevX = x;
    prevY = y;
    prevZ = z;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      x += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxY <= tMaxZ) {
      y += stepY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      tMaxZ += tDeltaZ;
    }
    const t = Math.min(tMaxX, tMaxY, tMaxZ);
    if (t > maxDist) return null;
    if (world.getBlock(x, y, z) !== Block.Air) {
      return { x, y, z, prevX, prevY, prevZ };
    }
  }
  return null;
}

/** 放置的方块是否与玩家 AABB 相交 */
export function intersectsPlayer(px: number, py: number, pz: number, bx: number, by: number, bz: number): boolean {
  const hw = 0.3;
  const hh = 1.8;
  return bx + 1 > px - hw && bx < px + hw && by + 1 > py && by < py + hh && bz + 1 > pz - hw && bz < pz + hw;
}