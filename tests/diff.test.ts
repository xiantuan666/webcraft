import { describe, it, expect } from 'vitest';
import { encodeDiffs, decodeDiffs } from '../src/world/diffCodec';
import type { BlockDiff } from '../src/world/world';

function key(d: BlockDiff): number {
  return (d.y << 16) | (d.z << 8) | d.x;
}

describe('diffCodec', () => {
  it('roundtrips empty list', () => {
    expect(decodeDiffs(encodeDiffs([]))).toEqual([]);
  });

  it('roundtrips diffs including world edges', () => {
    const diffs: BlockDiff[] = [
      { x: 0, y: 0, z: 0, id: 1 },
      { x: 255, y: 127, z: 255, id: 20 },
      { x: 128, y: 60, z: 7, id: 6 },
      { x: 3, y: 44, z: 99, id: 13 },
    ];
    const decoded = decodeDiffs(encodeDiffs(diffs));
    expect(decoded).toEqual([...diffs].sort((a, b) => key(a) - key(b)));
  });

  it('rejects bad magic', () => {
    expect(() => decodeDiffs('XXX:abc')).toThrow();
  });

  it('rejects truncated payload', () => {
    expect(() => decodeDiffs('MCWV1:AAAA')).toThrow();
  });
});