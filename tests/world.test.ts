import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { defaultWorldConfig, generateWorld } from '../src/world/terrain';
import { Block } from '../src/world/blockIds';

describe('world', () => {
  it('same seed generates identical terrain', () => {
    const a = new World(defaultWorldConfig(42));
    const b = new World(defaultWorldConfig(42));
    generateWorld(a, a.config);
    generateWorld(b, b.config);
    const spots: Array<[number, number]> = [[0, 0], [128, 128], [255, 255], [63, 7], [200, 31]];
    for (const [x, z] of spots) {
      for (let y = 0; y < 128; y += 8) {
        expect(a.getBlock(x, y, z)).toBe(b.getBlock(x, y, z));
      }
    }
    const h = a.getSurfaceHeight(128, 128);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(a.getBlock(128, h, 128)).not.toBe(Block.Air);
  });

  it('different seeds produce different terrain somewhere', () => {
    const a = new World(defaultWorldConfig(1));
    const b = new World(defaultWorldConfig(2));
    generateWorld(a, a.config);
    generateWorld(b, b.config);
    let differs = false;
    outer: for (let x = 0; x < 256; x += 4) {
      for (let z = 0; z < 256; z += 4) {
        if (a.getBlock(x, a.getSurfaceHeight(x, z), z) !== b.getBlock(x, b.getSurfaceHeight(x, z), z)) {
          differs = true;
          break outer;
        }
      }
    }
    expect(differs).toBe(true);
  });

  it('setBlock records diff and applyDiffs restores it', () => {
    const w = new World(defaultWorldConfig(7));
    generateWorld(w, w.config);
    w.clearDiffs();
    expect(w.setBlock(10, 20, 30, Block.Brick)).toBe(true);
    expect(w.getBlock(10, 20, 30)).toBe(Block.Brick);
    expect(w.diffCount()).toBe(1);
    const list = w.getDiffList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ x: 10, y: 20, z: 30, id: Block.Brick });

    const w2 = new World(defaultWorldConfig(7));
    generateWorld(w2, w2.config);
    w2.applyDiffs(list);
    expect(w2.getBlock(10, 20, 30)).toBe(Block.Brick);
  });

  it('rejects out-of-bounds writes', () => {
    const w = new World(defaultWorldConfig(1));
    expect(w.setBlock(-1, 5, 5, Block.Stone)).toBe(false);
    expect(w.setBlock(5, 5, 256, Block.Stone)).toBe(false);
    expect(w.setBlock(5, 128, 5, Block.Stone)).toBe(false);
  });

  it('writing the same id does not record a diff', () => {
    const w = new World(defaultWorldConfig(1));
    generateWorld(w, w.config);
    w.clearDiffs();
    const h = w.getSurfaceHeight(5, 5);
    const id = w.getBlock(5, h, 5);
    expect(w.setBlock(5, h, 5, id)).toBe(false);
    expect(w.diffCount()).toBe(0);
  });
});