import { WORLD_HEIGHT } from './terrain';

export const CHUNK_SIZE = 16;

/** 16×16×128 区块，Uint8Array 存方块 ID */
export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(cx: number, cz: number, height: number = WORLD_HEIGHT) {
    this.cx = cx;
    this.cz = cz;
    this.height = height;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * height);
  }

  index(x: number, y: number, z: number): number {
    return (y << 8) | (z << 4) | x; // 16×16×128
  }

  get(x: number, y: number, z: number): number {
    return this.data[this.index(x, y, z)] ?? 0;
  }

  set(x: number, y: number, z: number, id: number): void {
    this.data[this.index(x, y, z)] = id;
  }
}