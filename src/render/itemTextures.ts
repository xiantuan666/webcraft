import * as THREE from 'three';
import { Item, isBlockItem } from '../survival/items';
import { getAtlasCanvas, ATLAS_TILES, TILE } from './textures';

import stickUrl from '../assets/items/item_stick.png';
import coalUrl from '../assets/items/item_coal.png';
import ironIngotUrl from '../assets/items/item_iron_ingot.png';
import goldIngotUrl from '../assets/items/item_gold_ingot.png';
import diamondUrl from '../assets/items/item_diamond.png';
import woodPickUrl from '../assets/items/item_wood_pickaxe.png';
import stonePickUrl from '../assets/items/item_stone_pickaxe.png';
import ironPickUrl from '../assets/items/item_iron_pickaxe.png';
import woodAxeUrl from '../assets/items/item_wood_axe.png';
import stoneAxeUrl from '../assets/items/item_stone_axe.png';
import ironAxeUrl from '../assets/items/item_iron_axe.png';
import woodShovelUrl from '../assets/items/item_wood_shovel.png';
import stoneShovelUrl from '../assets/items/item_stone_shovel.png';
import ironShovelUrl from '../assets/items/item_iron_shovel.png';
import woodSwordUrl from '../assets/items/item_wood_sword.png';
import stoneSwordUrl from '../assets/items/item_stone_sword.png';
import ironSwordUrl from '../assets/items/item_iron_sword.png';

const ITEM_TILES: number[] = [];
ITEM_TILES[Item.Stick] = 0;
ITEM_TILES[Item.Coal] = 1;
ITEM_TILES[Item.Charcoal] = 1; // 复用煤炭贴图
ITEM_TILES[Item.IronIngot] = 2;
ITEM_TILES[Item.GoldIngot] = 3;
ITEM_TILES[Item.Diamond] = 4;
ITEM_TILES[Item.RedstoneDust] = 5;
ITEM_TILES[Item.Lapis] = 6;
ITEM_TILES[Item.WoodPickaxe] = 8;
ITEM_TILES[Item.StonePickaxe] = 9;
ITEM_TILES[Item.IronPickaxe] = 10;
ITEM_TILES[Item.WoodAxe] = 11;
ITEM_TILES[Item.StoneAxe] = 12;
ITEM_TILES[Item.IronAxe] = 13;
ITEM_TILES[Item.WoodShovel] = 14;
ITEM_TILES[Item.StoneShovel] = 15;
ITEM_TILES[Item.IronShovel] = 16;
ITEM_TILES[Item.WoodSword] = 17;
ITEM_TILES[Item.StoneSword] = 18;
ITEM_TILES[Item.IronSword] = 19;

const ITEM_URLS: (string | null)[] = [
  stickUrl, coalUrl, ironIngotUrl, goldIngotUrl, diamondUrl, null, null, null,
  woodPickUrl, stonePickUrl, ironPickUrl, woodAxeUrl, stoneAxeUrl, ironAxeUrl,
  woodShovelUrl, stoneShovelUrl, ironShovelUrl, woodSwordUrl, stoneSwordUrl, ironSwordUrl,
];

let itemAtlas: HTMLCanvasElement | null = null;

function buildItemAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const COLS = 10;
  canvas.width = COLS * TILE;
  canvas.height = 2 * TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  // 程序化物品（红石粉/青金石）
  const drawProcedural = (tile: number) => {
    const x = (tile % COLS) * TILE;
    const y = Math.floor(tile / COLS) * TILE;
    ctx.clearRect(x, y, TILE, TILE);
    let seed = 9000 + tile * 77;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const base = tile === 5 ? [200, 40, 30] : [30, 60, 180];
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        const v = (rnd() - 0.5) * 40;
        const r = Math.max(0, Math.min(255, Math.round(base[0] + v)));
        const g = Math.max(0, Math.min(255, Math.round(base[1] + v)));
        const b = Math.max(0, Math.min(255, Math.round(base[2] + v)));
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        // (fillStyle set above)
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  };
  const draw = (tile: number, url: string | null) => {
    const x = (tile % COLS) * TILE;
    const y = Math.floor(tile / COLS) * TILE;
    ctx.clearRect(x, y, TILE, TILE);
    if (!url) {
      if (tile === 5 || tile === 6) drawProcedural(tile);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x, y, TILE, TILE);
    };
    img.src = url;
  };
  ITEM_URLS.forEach((url, i) => draw(i, url));
  return canvas;
}

function getItemAtlas(): HTMLCanvasElement {
  if (!itemAtlas) itemAtlas = buildItemAtlas();
  return itemAtlas;
}

/** 生成物品图标（方块物品用方块图集，其余用品图集） */
export function makeItemIcon(itemId: number, size = 32): HTMLCanvasElement {
  if (isBlockItem(itemId)) {
    const atlas = getAtlasCanvas();
    const col = itemId % ATLAS_TILES;
    const row = Math.floor(itemId / ATLAS_TILES);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, col * TILE, row * TILE, TILE, TILE, 0, 0, size, size);
    return c;
  }
  const tile = ITEM_TILES[itemId] ?? 0;
  const atlas = getItemAtlas();
  const COLS = 10;
  const sx = (tile % COLS) * TILE;
  const sy = Math.floor(tile / COLS) * TILE;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, sx, sy, TILE, TILE, 0, 0, size, size);
  return c;
}

const spriteTexCache = new Map<number, THREE.CanvasTexture>();

/** 掉落物/界面用的 16×16 物品纹理 */
export function getItemSpriteTexture(itemId: number): THREE.CanvasTexture {
  let tex = spriteTexCache.get(itemId);
  if (!tex) {
    tex = new THREE.CanvasTexture(makeItemIcon(itemId, TILE));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    spriteTexCache.set(itemId, tex);
  }
  return tex;
}
