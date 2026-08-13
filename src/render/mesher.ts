import { CHUNK_SIZE } from '../world/chunk';
import type { World } from '../world/world';
import { Block, blockInfo } from '../world/blockIds';
import { tileUV } from './textures';

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

interface FaceDef {
  dir: [number, number, number];
  corners: { pos: [number, number, number]; uv: [number, number] }[];
}

/** 6 个面模板（单位立方体，0..1 局部坐标） */
const FACES: FaceDef[] = [
  { // +X
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
    ],
  },
  { // -X
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 1] },
    ],
  },
  { // +Y 顶
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [0, 0] },
      { pos: [1, 1, 1], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 1] },
    ],
  },
  { // -Y 底
    dir: [0, -1, 0],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  { // +Z
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [1, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 1], uv: [0, 1] },
    ],
  },
  { // -Z
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [0, 1, 0], uv: [1, 1] },
      { pos: [1, 1, 0], uv: [0, 1] },
    ],
  },
];

function shouldDrawFace(id: number, neighbor: number): boolean {
  if (neighbor === Block.Air) return true;
  const self = blockInfo(id);
  const nb = blockInfo(neighbor);
  if (self.opaque) return !nb.opaque;
  // 透明方块
  if (self.liquid) return neighbor === Block.Air; // 水只与空气相邻画
  if (id === Block.Glass) return !nb.opaque && neighbor !== Block.Glass;
  return !nb.opaque;
}

function faceSlot(id: number, faceIndex: number): number {
  const info = blockInfo(id);
  switch (faceIndex) {
    case 2: return info.texTop;
    case 3: return info.texBottom;
    default: return info.texSide;
  }
}

/** 按面朝向给出亮度（0..1），模拟简单光照 */
function faceShade(dir: [number, number, number]): number {
  if (dir[1] === 1) return 1.0;
  if (dir[1] === -1) return 0.55;
  if (dir[0] === 1 || dir[2] === 1) return 0.82;
  return 0.68;
}

function emptyData(): MeshData {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

/** 生成区块网格，返回不透明/透明两套数据 */
export function meshChunk(world: World, cx: number, cz: number): { opaque: MeshData; transparent: MeshData } {
  const opaque = emptyData();
  const transparent = emptyData();
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;
  for (let y = 0; y < world.config.height; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const gx = baseX + x;
        const gz = baseZ + z;
        const id = world.getBlock(gx, y, gz);
        if (id === Block.Air) continue;
        const info = blockInfo(id);
        const isTransparent = !info.opaque;
        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f];
          const nid = world.getBlock(gx + face.dir[0], y + face.dir[1], gz + face.dir[2]);
          if (!shouldDrawFace(id, nid)) continue;
          const slot = faceSlot(id, f);
          const [u0, v0, u1, v1] = tileUV(slot);
          const target = isTransparent ? transparent : opaque;
          const base = target.positions.length / 3;
          for (const c of face.corners) {
            target.positions.push(gx + c.pos[0], y + c.pos[1], gz + c.pos[2]);
            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const shade = faceShade(face.dir);
            target.uvs.push(u0 + c.uv[0] * (u1 - u0), v1 - c.uv[1] * (v1 - v0));
            target.colors.push(shade, shade, shade);
          }
          target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  return { opaque, transparent };
}