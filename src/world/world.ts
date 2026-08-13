import { Chunk } from './chunk';
import type { WorldConfig } from './terrain';
import { Block } from './blockIds';

export interface BlockDiff {
  x: number;
  y: number;
  z: number;
  id: number;
}

/** 世界容器：区块管理 + 方块读写 + diff 记录 */
export class World {
  readonly config: WorldConfig;
  private readonly chunks = new Map<number, Chunk>();
  private readonly diffs = new Map<number, number>();
  private version = 0;

  constructor(config: WorldConfig) {
    this.config = config;
  }

  private chunkKey(cx: number, cz: number): number {
    return cx * 512 + cz;
  }

  private ensureChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = new Chunk(cx, cz, this.config.height);
      this.chunks.set(key, c);
    }
    return c;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 && z >= 0 && y >= 0 &&
      x < this.config.size && z < this.config.size && y < this.config.height
    );
  }

  getBlock(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return Block.Air;
    const cx = x >> 4;
    const cz = z >> 4;
    const c = this.chunks.get(this.chunkKey(cx, cz));
    return c ? c.get(x & 15, y, z & 15) : Block.Air;
  }

  /** 直接写方块（不记录 diff），用于地形生成与远端同步 */
  setBlockDirect(x: number, y: number, z: number, id: number): boolean {
    if (!this.inBounds(x, y, z)) return false;
    this.ensureChunk(x >> 4, z >> 4).set(x & 15, y, z & 15, id);
    return true;
  }

  /** 玩家修改方块：写入并记录 diff（供存档与联机同步） */
  setBlock(x: number, y: number, z: number, id: number): boolean {
    if (!this.inBounds(x, y, z)) return false;
    if (this.getBlock(x, y, z) === id) return false;
    this.setBlockDirect(x, y, z, id);
    const key = (y << 16) | (z << 8) | x;
    this.diffs.set(key, id);
    this.version++;
    return true;
  }

  getDiffList(): BlockDiff[] {
    const list: BlockDiff[] = [];
    for (const [key, id] of this.diffs) {
      list.push({ x: key & 0xff, z: (key >> 8) & 0xff, y: (key >> 16) & 0xff, id });
    }
    return list;
  }

  diffCount(): number {
    return this.diffs.size;
  }

  clearDiffs(): void {
    this.diffs.clear();
  }

  getVersion(): number {
    return this.version;
  }

  /** 应用外部 diff 快照（不重复记录） */
  applyDiffs(diffs: readonly BlockDiff[]): void {
    for (const d of diffs) this.setBlockDirect(d.x, d.y, d.z, d.id);
  }

  /** 某位置是否固体（碰撞用）；世界水平边界视为墙 */
  isSolidAt(x: number, y: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= this.config.size || z >= this.config.size) return true;
    if (y < 0) return true;
    if (y >= this.config.height) return false;
    const id = this.getBlock(x, y, z);
    return id !== Block.Air && id !== Block.Water;
  }

  /** 地表最高固体 y，无则 -1 */
  getSurfaceHeight(x: number, z: number): number {
    for (let y = this.config.height - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== Block.Air && id !== Block.Water) return y;
    }
    return -1;
  }
}