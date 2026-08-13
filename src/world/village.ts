import { mulberry32 } from './noise';
import { Block } from './blockIds';
import type { World } from './world';
import type { WorldConfig } from './terrain';

export interface VillagerSpawn {
  x: number;
  y: number;
  z: number;
}

export interface VillageInfo {
  centerX: number;
  centerZ: number;
  groundY: number;
  spawns: VillagerSpawn[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 确定性生成小村庄：广场 + 4 间小屋 + 村民出生点（全部用现有方块） */
export function generateVillage(world: World, config: WorldConfig): VillageInfo {
  const { size, seaLevel, seed } = config;
  const rng = mulberry32((seed ^ 0x51ab51ab) >>> 0);

  // 出生点(世界中心)附近 100~200 格选村址
  const angle = rng() * Math.PI * 2;
  const dist = 100 + rng() * 100;
  const margin = 26; // 给房屋偏移与屋顶外挑留出边界
  const cx = clamp(Math.round(size / 2 + Math.cos(angle) * dist), margin, size - margin);
  const cz = clamp(Math.round(size / 2 + Math.sin(angle) * dist), margin, size - margin);

  // 地面高度取周围采样最高值，避免建到水里
  let groundY = 0;
  for (let dz = -7; dz <= 7; dz += 7) {
    for (let dx = -7; dx <= 7; dx += 7) {
      const s = world.getSurfaceHeight(cx + dx, cz + dz);
      if (s > groundY) groundY = s;
    }
  }
  if (groundY < seaLevel) groundY = seaLevel;

  // 清除区域内树木（原木/树叶）
  for (let dz = -22; dz <= 22; dz++) {
    for (let dx = -22; dx <= 22; dx++) {
      for (let y = groundY + 1; y < Math.min(config.height, groundY + 8); y++) {
        const id = world.getBlock(cx + dx, y, cz + dz);
        if (id === Block.Log || id === Block.Leaves) world.setBlockDirect(cx + dx, y, cz + dz, Block.Air);
      }
    }
  }

  // 中心广场 5x5 木板
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      world.setBlockDirect(cx + dx, groundY, cz + dz, Block.Planks);
    }
  }

  // 4 间小屋围绕广场
  const spawns: VillagerSpawn[] = [];
  const offsets: Array<[number, number]> = [[0, -16], [0, 16], [16, 0], [-16, 0]];
  for (const [ox, oz] of offsets) {
    const hx = cx + ox + Math.floor(rng() * 3) - 1;
    const hz = cz + oz + Math.floor(rng() * 3) - 1;
    spawns.push(buildHouse(world, hx, groundY, hz));
  }

  return { centerX: cx, centerZ: cz, groundY, spawns };
}

const HOUSE_W = 7;
const HOUSE_D = 6;

/** 建一间小屋，返回屋内村民出生点（站在地板上） */
function buildHouse(world: World, x0: number, y0: number, z0: number): VillagerSpawn {
  const W = HOUSE_W;
  const D = HOUSE_D;

  // 清空内部与屋顶空间
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      for (let y = y0 + 1; y <= y0 + 4; y++) world.setBlockDirect(x0 + x, y, z0 + z, Block.Air);
    }
  }

  // 地板
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) world.setBlockDirect(x0 + x, y0, z0 + z, Block.Planks);
  }

  // 墙（含圆木角柱、门洞、玻璃窗）
  const midX = Math.floor(W / 2);
  const midZ = Math.floor(D / 2);
  for (let y = y0 + 1; y <= y0 + 3; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const isCorner = (x === 0 || x === W - 1) && (z === 0 || z === D - 1);
        const isFront = z === 0;
        const isBack = z === D - 1;
        const isSide = x === 0 || x === W - 1;
        if (!isCorner && !isFront && !isBack && !isSide) continue; // 内部

        let id: number = Block.Planks;
        if (isCorner) {
          id = Block.Log;
        } else if (y === y0 + 1 && isFront && (x === midX - 1 || x === midX)) {
          id = Block.Air; // 门洞
        } else if (y === y0 + 2) {
          const isWindow =
            (isFront && x === midX) ||
            (isBack && x === midX) ||
            (isSide && z === midZ);
          if (isWindow) id = Block.Glass;
        }
        world.setBlockDirect(x0 + x, y, z0 + z, id);
      }
    }
  }

  // 屋顶（带一圈外挑）
  for (let z = -1; z <= D; z++) {
    for (let x = -1; x <= W; x++) {
      world.setBlockDirect(x0 + x, y0 + 4, z0 + z, Block.Planks);
    }
  }

  return { x: x0 + midX + 0.5, y: y0 + 1, z: z0 + midZ + 0.5 };
}