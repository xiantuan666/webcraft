import { createNoise2D } from 'simplex-noise';
import { Block } from './blockIds';
import { mulberry32, hash2 } from './noise';
import type { World } from './world';

export const WORLD_SIZE = 256;
export const WORLD_HEIGHT = 128;
export const SEA_LEVEL = 60;

export interface WorldConfig {
  seed: number;
  size: number;
  height: number;
  seaLevel: number;
}

export function defaultWorldConfig(seed: number): WorldConfig {
  return { seed, size: WORLD_SIZE, height: WORLD_HEIGHT, seaLevel: SEA_LEVEL };
}

/** 确定性地形生成：填充整个世界（不记录 diff） */
export function generateWorld(world: World, config: WorldConfig): void {
  const { size, height, seaLevel, seed } = config;
  const rng = mulberry32(seed);
  const nContinent = createNoise2D(rng);
  const nHill = createNoise2D(rng);
  const nDetail = createNoise2D(rng);
  const treeRng = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  // pass 1: 每列地表高度
  const heights = new Uint8Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nx = x / 64;
      const nz = z / 64;
      const continent =
        nContinent(nx * 0.9, nz * 0.9) * 0.6 + nHill(nx * 2.3 + 7.3, nz * 2.3 - 3.1) * 0.4;
      const detail = nDetail(nx * 6.0 + 131.7, nz * 6.0 - 91.3) * 0.35;
      let h = Math.round(seaLevel + continent * 22 + detail * 10);
      h = Math.max(3, Math.min(height - 10, h));
      heights[z * size + x] = h;
    }
  }

  // pass 2: 填充方块
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = heights[z * size + x];
      for (let y = 0; y <= h; y++) {
        let id: number = Block.Stone;
        if (y === 0) id = Block.Bedrock;
        else if (y >= h - 3) id = Block.Dirt;
        else if (y === h - 4 && hash2(x, z, seed ^ y) % 16 === 0) id = Block.Gravel;
        if (y === h) {
          if (h >= seaLevel + 2) id = Block.Grass;
          else if (h >= seaLevel - 1) id = Block.Sand;
          else id = Block.Dirt;
        }
        world.setBlockDirect(x, y, z, id);
      }
      if (h < seaLevel) {
        for (let y = h + 1; y <= seaLevel; y++) world.setBlockDirect(x, y, z, Block.Water);
      }
    }
  }


/** pass 4: 矿石生成（确定性，按区块矿脉，只替换石头） */
function placeOres(world: World, config: WorldConfig): void {
  const { size, seed } = config;
  const chunkCount = size / 16;
  for (let cz = 0; cz < chunkCount; cz++) {
    for (let cx = 0; cx < chunkCount; cx++) {
      const rng = mulberry32((seed ^ Math.imul(cx + 1, 0x9e3779b9) ^ Math.imul(cz + 1, 0x85ebca6b)) >>> 0);
      placeVein(world, cx, cz, rng, Block.CoalOre, 0, 96, 12, 4, 8);
      placeVein(world, cx, cz, rng, Block.IronOre, 0, 64, 6, 4, 6);
      placeVein(world, cx, cz, rng, Block.GoldOre, 0, 32, 2, 3, 5);
      placeVein(world, cx, cz, rng, Block.LapisOre, 0, 32, 2, 4, 6);
      placeVein(world, cx, cz, rng, Block.RedstoneOre, 0, 16, 4, 4, 6);
      placeVein(world, cx, cz, rng, Block.DiamondOre, 0, 16, 1, 3, 6);
    }
  }
}

function placeVein(world: World, cx: number, cz: number, rng: () => number, ore: number, minY: number, maxY: number, veins: number, minSize: number, maxSize: number): void {
  for (let v = 0; v < veins; v++) {
    let x = cx * 16 + Math.floor(rng() * 16);
    let y = minY + Math.floor(rng() * (maxY - minY + 1));
    let z = cz * 16 + Math.floor(rng() * 16);
    const size = minSize + Math.floor(rng() * (maxSize - minSize + 1));
    for (let i = 0; i < size; i++) {
      if (world.getBlock(x, y, z) === Block.Stone) world.setBlockDirect(x, y, z, ore);
      x += Math.floor(rng() * 3) - 1;
      y += Math.floor(rng() * 3) - 1;
      z += Math.floor(rng() * 3) - 1;
      x = Math.max(0, Math.min(world.config.size - 1, x));
      y = Math.max(1, Math.min(world.config.height - 1, y));
      z = Math.max(0, Math.min(world.config.size - 1, z));
    }
  }
}

  placeOres(world, config);

  // pass 3: 树（确定性稀疏放置）
  const margin = 2;
  for (let z = margin; z < size - margin; z++) {
    for (let x = margin; x < size - margin; x++) {
      const h = heights[z * size + x];
      if (h < seaLevel + 2) continue;
      if (treeRng() > 0.012) continue;
      placeTree(world, x, h + 1, z);
    }
  }
}

function placeTree(world: World, x: number, y: number, z: number): void {
  const trunkH = 4 + (hash2(x, z, 12345) % 2); // 4-5 格高
  for (let i = 0; i < trunkH; i++) world.setBlockDirect(x, y + i, z, Block.Log);
  const top = y + trunkH;

  // 树冠下层（去掉四角）
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const ax = Math.abs(dx);
      const az = Math.abs(dz);
      if (ax === 2 && az === 2) continue;
      if (dx === 0 && dz === 0) continue; // 保留树干
      world.setBlockDirect(x + dx, top - 1, z + dz, Block.Leaves);
    }
  }
  // 树冠顶层
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      world.setBlockDirect(x + dx, top, z + dz, Block.Leaves);
    }
  }
  world.setBlockDirect(x, top + 1, z, Block.Leaves);
  // 树干周围随机补叶
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) + Math.abs(dz) === 1 && hash2(x + dx, z + dz, 77) % 3 === 0) {
        world.setBlockDirect(x + dx, top - 2, z + dz, Block.Leaves);
      }
    }
  }
}