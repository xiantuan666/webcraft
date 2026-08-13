import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveWorld, loadSave, hasSave, clearSave } from '../src/world/save';
import type { BlockDiff } from '../src/world/world';

function mockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

describe('save', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
  });

  it('save/load roundtrip', () => {
    const diffs: BlockDiff[] = [
      { x: 1, y: 2, z: 3, id: 4 },
      { x: 200, y: 100, z: 150, id: 19 },
    ];
    expect(saveWorld('ABCDE', 12345, diffs)).toBe(true);
    expect(hasSave('abcde')).toBe(true); // 大小写不敏感
    const loaded = loadSave('ABCDE');
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(12345);
    expect(loaded!.diffs).toEqual(diffs);
    clearSave('ABCDE');
    expect(hasSave('ABCDE')).toBe(false);
  });

  it('returns null for missing save', () => {
    expect(loadSave('ZZZZZ')).toBeNull();
  });

  it('handles quota error', () => {
    const bad: Storage = {
      ...mockStorage(),
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
    } as Storage;
    vi.stubGlobal('localStorage', bad);
    expect(saveWorld('ABCDE', 1, [{ x: 1, y: 1, z: 1, id: 2 }])).toBe(false);
  });
});