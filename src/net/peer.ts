const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 生成房间码（5 位，避免易混淆字符） */
export function makeRoomCode(len = 5): string {
  const arr = new Uint32Array(len);
  globalThis.crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < len; i++) s += ROOM_ALPHABET[arr[i] % ROOM_ALPHABET.length];
  return s;
}