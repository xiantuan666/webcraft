import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { defaultWorldConfig, generateWorld } from '../src/world/terrain';
import { generateVillage } from '../src/world/village';
import { Block } from '../src/world/blockIds';


describe('village ground (fix: no floating / on land)', () => {
  it('house floors are supported by solid ground (no floating)', () => {
    const w = new World(defaultWorldConfig(7));
    generateWorld(w, w.config);
    const v = generateVillage(w, w.config);
    for (const s of v.spawns) {
      const fx = Math.floor(s.x);
      const fz = Math.floor(s.z);
      const below = w.getBlock(fx, Math.floor(s.y) - 2, fz);
      expect(below).not.toBe(Block.Air);
      expect(below).not.toBe(Block.Water);
    }
  });

  it('village center is on land above sea level', () => {
    const w = new World(defaultWorldConfig(7));
    generateWorld(w, w.config);
    const v = generateVillage(w, w.config);
    expect(v.groundY).toBeGreaterThanOrEqual(w.config.seaLevel + 1);
    expect(w.getSurfaceHeight(v.centerX, v.centerZ)).toBeGreaterThanOrEqual(w.config.seaLevel);
  });
});
describe('village', () => {
  it('same seed produces identical village', () => {
    const a = new World(defaultWorldConfig(42));
    generateWorld(a, a.config);
    const va = generateVillage(a, a.config);
    const b = new World(defaultWorldConfig(42));
    generateWorld(b, b.config);
    const vb = generateVillage(b, b.config);
    expect(va.centerX).toBe(vb.centerX);
    expect(va.centerZ).toBe(vb.centerZ);
    expect(va.groundY).toBe(vb.groundY);
    expect(va.spawns).toEqual(vb.spawns);
    for (const [dx, dz] of [[0, 0], [3, 2], [-3, 5], [8, 8], [-9, -7]]) {
      expect(a.getBlock(va.centerX + dx, va.groundY, va.centerZ + dz)).toBe(
        b.getBlock(vb.centerX + dx, vb.groundY, vb.centerZ + dz),
      );
    }
  });

  it('village spawns are on the floor (planks) inside bounds', () => {
    const w = new World(defaultWorldConfig(7));
    generateWorld(w, w.config);
    const v = generateVillage(w, w.config);
    expect(v.spawns.length).toBeGreaterThanOrEqual(2);
    for (const s of v.spawns) {
      expect(Math.floor(s.x)).toBeGreaterThan(0);
      expect(Math.floor(s.x)).toBeLessThan(w.config.size);
      expect(Math.floor(s.z)).toBeGreaterThan(0);
      expect(Math.floor(s.z)).toBeLessThan(w.config.size);
      expect(s.y).toBeGreaterThan(0);
      expect(w.getBlock(Math.floor(s.x), Math.floor(s.y) - 1, Math.floor(s.z))).toBe(Block.Planks);
    }
  });

  it('different seeds produce different villages', () => {
    const a = new World(defaultWorldConfig(1));
    generateWorld(a, a.config);
    const va = generateVillage(a, a.config);
    const b = new World(defaultWorldConfig(2));
    generateWorld(b, b.config);
    const vb = generateVillage(b, b.config);
    expect([va.centerX, va.centerZ]).not.toEqual([vb.centerX, vb.centerZ]);
  });

  it('village builds houses with log corners', () => {
    const w = new World(defaultWorldConfig(9));
    generateWorld(w, w.config);
    const v = generateVillage(w, w.config);
    // 广场中心是木板
    expect(w.getBlock(v.centerX, v.groundY, v.centerZ)).toBe(Block.Planks);
    // 至少有一根圆木角柱（房屋附近找到原木）
    let foundLog = false;
    for (let dz = -20; dz <= 20 && !foundLog; dz++) {
      for (let dx = -20; dx <= 20 && !foundLog; dx++) {
        if (w.getBlock(v.centerX + dx, v.groundY + 1, v.centerZ + dz) === Block.Log) foundLog = true;
      }
    }
    expect(foundLog).toBe(true);
  });
});