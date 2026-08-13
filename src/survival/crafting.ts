import { Block } from '../world/blockIds';
import { Item } from './items';

export interface Recipe {
  id: string;
  width: number;
  height: number;
  pattern: number[][];
  result: number;
  resultCount: number;
}

let recipeSeq = 0;
function R(width: number, height: number, rows: string[], map: Record<string, number>, result: number, resultCount: number): Recipe {
  const pattern: number[][] = [];
  for (const row of rows) {
    const arr: number[] = [];
    for (const ch of row) arr.push(ch === ' ' || ch === '_' ? 0 : (map[ch] ?? 0));
    pattern.push(arr);
  }
  recipeSeq++;
  return { id: 'r' + recipeSeq, width, height, pattern, result, resultCount };
}

const PLANK = Block.Planks;
const STICK = Item.Stick;
const COBBLE = Block.Cobblestone;
const IRON = Item.IronIngot;

export const RECIPES: Recipe[] = [
  R(1, 1, ['L'], { L: Block.Log }, PLANK, 4),
  R(1, 2, ['P', 'P'], { P: PLANK }, STICK, 4),
  R(2, 2, ['PP', 'PP'], { P: PLANK }, Block.CraftingTable, 1),
  R(3, 3, ['CCC', 'C C', 'CCC'], { C: COBBLE }, Block.Furnace, 1),
  R(3, 3, ['XXX', ' S ', ' S '], { X: PLANK, S: STICK }, Item.WoodPickaxe, 1),
  R(3, 3, ['XXX', ' S ', ' S '], { X: COBBLE, S: STICK }, Item.StonePickaxe, 1),
  R(3, 3, ['XXX', ' S ', ' S '], { X: IRON, S: STICK }, Item.IronPickaxe, 1),
  R(3, 3, ['XX ', 'XS ', ' S '], { X: PLANK, S: STICK }, Item.WoodAxe, 1),
  R(3, 3, ['XX ', 'XS ', ' S '], { X: COBBLE, S: STICK }, Item.StoneAxe, 1),
  R(3, 3, ['XX ', 'XS ', ' S '], { X: IRON, S: STICK }, Item.IronAxe, 1),
  R(3, 3, [' X ', ' S ', ' S '], { X: PLANK, S: STICK }, Item.WoodShovel, 1),
  R(3, 3, [' X ', ' S ', ' S '], { X: COBBLE, S: STICK }, Item.StoneShovel, 1),
  R(3, 3, [' X ', ' S ', ' S '], { X: IRON, S: STICK }, Item.IronShovel, 1),
  R(3, 3, [' X ', ' X ', ' S '], { X: PLANK, S: STICK }, Item.WoodSword, 1),
  R(3, 3, [' X ', ' X ', ' S '], { X: COBBLE, S: STICK }, Item.StoneSword, 1),
  R(3, 3, [' X ', ' X ', ' S '], { X: IRON, S: STICK }, Item.IronSword, 1),
];

/** 在 gw×gh 网格中匹配配方（忽略空白偏移） */
export function matchRecipe(grid: number[][], gw: number, gh: number): Recipe | null {
  let minX = gw, minY = gh, maxX = -1, maxY = -1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (grid[y][x] !== 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  for (const r of RECIPES) {
    if (r.width !== bw || r.height !== bh) continue;
    let ok = true;
    for (let y = 0; y < bh && ok; y++) {
      for (let x = 0; x < bw; x++) {
        if (grid[minY + y][minX + x] !== r.pattern[y][x]) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return r;
  }
  return null;
}