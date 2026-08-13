import { encodeDiffs, decodeDiffs } from './diffCodec';
import type { BlockDiff } from './world';
import type { GameMode } from '../net/protocol';
import type { ItemStack } from '../survival/inventory';

export const SAVE_PREFIX = 'mcw_save_';
export const NAME_KEY = 'mcw_name';

export interface SaveExtra {
  mode?: GameMode;
  inventory?: ItemStack[];
  furnaces?: { key: string; data: unknown }[];
}

export interface SaveData {
  v: 1;
  seed: number;
  blocks: string;
  mode?: GameMode;
  inventory?: ItemStack[];
  furnaces?: { key: string; data: unknown }[];
}

export interface LoadResult {
  seed: number;
  diffs: BlockDiff[];
  extra: SaveExtra;
}

export function saveKey(code: string): string {
  return SAVE_PREFIX + code.toUpperCase();
}

export function hasSave(code: string): boolean {
  return localStorage.getItem(saveKey(code)) !== null;
}

export function loadSave(code: string): LoadResult | null {
  const raw = localStorage.getItem(saveKey(code));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1 || typeof data.seed !== 'number' || typeof data.blocks !== 'string') return null;
    return {
      seed: data.seed,
      diffs: decodeDiffs(data.blocks),
      extra: { mode: data.mode, inventory: data.inventory, furnaces: data.furnaces },
    };
  } catch {
    return null;
  }
}

export function saveWorld(code: string, seed: number, diffs: readonly BlockDiff[], extra: SaveExtra = {}): boolean {
  const data: SaveData = {
    v: 1,
    seed,
    blocks: encodeDiffs(diffs),
    mode: extra.mode,
    inventory: extra.inventory,
    furnaces: extra.furnaces,
  };
  try {
    localStorage.setItem(saveKey(code), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(code: string): void {
  localStorage.removeItem(saveKey(code));
}

export function loadUserName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveUserName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}