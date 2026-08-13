import type { BlockDiff } from './world';

const MAGIC = 'MCWV1';

function key(d: BlockDiff): number {
  return (d.y << 16) | (d.z << 8) | d.x;
}

/** 方块 diff → 紧凑二进制 → base64（按坐标排序，每 diff 4 字节） */
export function encodeDiffs(diffs: readonly BlockDiff[]): string {
  const sorted = [...diffs].sort((a, b) => key(a) - key(b));
  const bytes = new Uint8Array(4 + sorted.length * 4);
  const dv = new DataView(bytes.buffer);
  dv.setUint32(0, sorted.length, true);
  sorted.forEach((d, i) => {
    const o = 4 + i * 4;
    bytes[o] = d.x & 0xff;
    bytes[o + 1] = d.y & 0xff;
    bytes[o + 2] = d.z & 0xff;
    bytes[o + 3] = d.id & 0xff;
  });
  return MAGIC + ':' + bytesToBase64(bytes);
}

export function decodeDiffs(s: string): BlockDiff[] {
  const idx = s.indexOf(':');
  if (idx < 0) throw new Error('存档格式错误');
  const magic = s.slice(0, idx);
  if (magic !== MAGIC) throw new Error('存档版本不匹配');
  const bytes = base64ToBytes(s.slice(idx + 1));
  const dv = new DataView(bytes.buffer);
  const count = dv.getUint32(0, true);
  if (bytes.length !== 4 + count * 4) throw new Error('存档长度错误');
  const out: BlockDiff[] = [];
  for (let i = 0; i < count; i++) {
    const o = 4 + i * 4;
    out.push({ x: bytes[o], y: bytes[o + 1], z: bytes[o + 2], id: bytes[o + 3] });
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}