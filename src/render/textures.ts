import * as THREE from 'three';
import { Tex, blockInfo } from '../world/blockIds';
import { mulberry32 } from '../world/noise';

// 开源贴图（Minetest Game，CC BY-SA 3.0），按 Tex 槽位顺序加载
import grassTopUrl from '../assets/textures/00_grass_top.png';
import grassSideUrl from '../assets/textures/01_grass_side.png';
import dirtUrl from '../assets/textures/02_dirt.png';
import stoneUrl from '../assets/textures/03_stone.png';
import cobbleUrl from '../assets/textures/04_cobblestone.png';
import sandUrl from '../assets/textures/05_sand.png';
import waterUrl from '../assets/textures/06_water.png';
import logSideUrl from '../assets/textures/07_log_side.png';
import logTopUrl from '../assets/textures/08_log_top.png';
import leavesUrl from '../assets/textures/09_leaves.png';
import planksUrl from '../assets/textures/10_planks.png';
import glassUrl from '../assets/textures/11_glass.png';
import bedrockUrl from '../assets/textures/12_bedrock.png';
import brickUrl from '../assets/textures/13_brick.png';
import glowstoneUrl from '../assets/textures/14_glowstone.png';
import gravelUrl from '../assets/textures/15_gravel.png';
import snowUrl from '../assets/textures/16_snow.png';
import woolWhiteUrl from '../assets/textures/17_wool_white.png';
import woolRedUrl from '../assets/textures/18_wool_red.png';
import woolBlueUrl from '../assets/textures/19_wool_blue.png';
import woolGreenUrl from '../assets/textures/20_wool_green.png';
import woolYellowUrl from '../assets/textures/21_wool_yellow.png';
import villagerFaceUrl from '../assets/villager_face.jpg';


/** 村民头部贴图（用户上传图片，懒加载；缺失/失败时调用方回退默认肤色） */
let villagerFaceTexture: THREE.Texture | null = null;
export function getVillagerFaceTexture(): THREE.Texture | null {
  if (!villagerFaceTexture) {
    villagerFaceTexture = new THREE.TextureLoader().load(villagerFaceUrl);
    villagerFaceTexture.magFilter = THREE.NearestFilter;
    villagerFaceTexture.minFilter = THREE.NearestFilter;
    villagerFaceTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return villagerFaceTexture;
}
export const TILE = 16;
export const ATLAS_TILES = 16;
export const ATLAS_SIZE = TILE * ATLAS_TILES;
const TEX_COUNT = 22;

const TEXTURE_URLS: (string | null)[] = [
  grassTopUrl, grassSideUrl, dirtUrl, stoneUrl, cobbleUrl, sandUrl, waterUrl,
  logSideUrl, logTopUrl, leavesUrl, planksUrl, glassUrl, bedrockUrl, brickUrl,
  glowstoneUrl, gravelUrl, snowUrl, woolWhiteUrl, woolRedUrl, woolBlueUrl,
  woolGreenUrl, woolYellowUrl,
];

let atlasCanvas: HTMLCanvasElement | null = null;
let atlasTexture: THREE.CanvasTexture | null = null;

function px(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number, a = 255): void {
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  ctx.fillRect(x, y, 1, 1);
}

function noise(ctx: CanvasRenderingContext2D, ox: number, oy: number, rng: () => number, base: [number, number, number], variance: number): void {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = (rng() - 0.5) * 2 * variance;
      px(ctx, ox + x, oy + y,
        Math.max(0, Math.min(255, Math.round(base[0] + v))),
        Math.max(0, Math.min(255, Math.round(base[1] + v))),
        Math.max(0, Math.min(255, Math.round(base[2] + v))));
    }
  }
}

/** 程序化回退贴图（仅当开源贴图加载失败时使用） */
function paintTile(ctx: CanvasRenderingContext2D, slot: number): void {
  const col = slot % ATLAS_TILES;
  const row = Math.floor(slot / ATLAS_TILES);
  const ox = col * TILE;
  const oy = row * TILE;
  const rng = mulberry32(0x51ab + slot * 0x9e37);

  switch (slot) {
    case Tex.GrassTop: {
      noise(ctx, ox, oy, rng, [106, 170, 64], 18);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        if (rng() < 0.5) px(ctx, ox + x, oy + y, 140, 205, 95);
        else px(ctx, ox + x, oy + y, 70, 120, 45);
      }
      break;
    }
    case Tex.GrassSide: {
      noise(ctx, ox, oy, rng, [134, 96, 67], 14);
      for (let x = 0; x < TILE; x++) {
        const depth = rng() < 0.3 ? 2 : 3 + Math.floor(rng() * 2);
        for (let y = 0; y <= depth; y++) {
          const v = (rng() - 0.5) * 20;
          px(ctx, ox + x, oy + y, 106 + v, 170 + v, 64 + v);
        }
      }
      break;
    }
    case Tex.Dirt: {
      noise(ctx, ox, oy, rng, [134, 96, 67], 14);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 110, 76, 52);
      }
      break;
    }
    case Tex.Stone: {
      noise(ctx, ox, oy, rng, [125, 125, 125], 10);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 96, 96, 96);
      }
      break;
    }
    case Tex.Cobblestone: {
      noise(ctx, ox, oy, rng, [125, 125, 125], 10);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        for (let k = 0; k < 6; k++) px(ctx, ox + x + (k % 3) - 1, oy + y + Math.floor(k / 3) - 1, 90, 90, 90);
      }
      break;
    }
    case Tex.Sand: {
      noise(ctx, ox, oy, rng, [219, 207, 163], 10);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 200, 185, 140);
      }
      break;
    }
    case Tex.Water: {
      noise(ctx, ox, oy, rng, [52, 108, 200], 8);
      for (let y = 0; y < TILE; y++) {
        if (rng() < 0.2) {
          for (let x = 0; x < TILE; x++) px(ctx, ox + x, oy + y, 90, 150, 230);
        }
      }
      break;
    }
    case Tex.LogSide: {
      noise(ctx, ox, oy, rng, [102, 81, 50], 8);
      for (let x = 0; x < TILE; x += 3) {
        for (let y = 0; y < TILE; y++) {
          if (rng() < 0.35) px(ctx, ox + x, oy + y, 60, 48, 30);
        }
      }
      break;
    }
    case Tex.LogTop: {
      noise(ctx, ox, oy, rng, [163, 132, 89], 8);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (Math.floor(d) % 3 === 0) px(ctx, ox + x, oy + y, 102, 81, 50);
        }
      }
      break;
    }
    case Tex.Leaves: {
      noise(ctx, ox, oy, rng, [58, 120, 38], 18);
      for (let i = 0; i < 16; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 30, 70, 20);
      }
      break;
    }
    case Tex.Planks: {
      noise(ctx, ox, oy, rng, [163, 132, 89], 10);
      for (let y = 0; y < TILE; y += 4) {
        for (let x = 0; x < TILE; x++) px(ctx, ox + x, oy + y, 120, 95, 62);
      }
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 180, 150, 105);
      }
      break;
    }
    case Tex.Glass: {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          if (x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1) {
            px(ctx, ox + x, oy + y, 210, 235, 240);
          } else {
            const v = (rng() - 0.5) * 14;
            px(ctx, ox + x, oy + y, 190 + v, 225 + v, 235 + v, 90);
          }
        }
      }
      break;
    }
    case Tex.Bedrock: {
      noise(ctx, ox, oy, rng, [70, 70, 70], 22);
      for (let i = 0; i < 16; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 40, 40, 40);
      }
      break;
    }
    case Tex.Brick: {
      noise(ctx, ox, oy, rng, [150, 75, 60], 8);
      for (let y = 0; y < TILE; y += 4) {
        for (let x = 0; x < TILE; x++) px(ctx, ox + x, oy + y, 205, 190, 180);
      }
      for (let y = 0; y < TILE; y += 8) {
        const offset = (Math.floor(y / 4) % 2 === 0) ? 4 : 0;
        for (let yy = 0; yy < 4; yy++) {
          for (let x = offset; x < TILE; x += 8) {
            px(ctx, ox + x, oy + y + yy, 205, 190, 180);
          }
        }
      }
      break;
    }
    case Tex.Glowstone: {
      noise(ctx, ox, oy, rng, [255, 220, 120], 12);
      for (let i = 0; i < 16; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 255, 245, 180);
      }
      break;
    }
    case Tex.Gravel: {
      noise(ctx, ox, oy, rng, [130, 120, 110], 14);
      for (let i = 0; i < 16; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 90, 90, 90);
      }
      break;
    }
    case Tex.Snow: {
      noise(ctx, ox, oy, rng, [240, 246, 252], 6);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
        px(ctx, ox + x, oy + y, 210, 220, 235);
      }
      break;
    }
    case Tex.WoolWhite: noise(ctx, ox, oy, rng, [235, 235, 235], 10); break;
    case Tex.WoolRed: noise(ctx, ox, oy, rng, [160, 40, 40], 10); break;
    case Tex.WoolBlue: noise(ctx, ox, oy, rng, [50, 80, 180], 10); break;
    case Tex.WoolGreen: noise(ctx, ox, oy, rng, [80, 160, 60], 10); break;
    case Tex.WoolYellow: noise(ctx, ox, oy, rng, [220, 190, 40], 10); break;
    default: {
      noise(ctx, ox, oy, rng, [180, 80, 220], 30);
      break;
    }
  }
}

function buildAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  for (let slot = 0; slot < TEX_COUNT; slot++) paintTile(ctx, slot);
  return canvas;
}

function ensureAtlasCanvas(): HTMLCanvasElement {
  if (!atlasCanvas) atlasCanvas = buildAtlasCanvas();
  return atlasCanvas;
}

function drawImageToTile(ctx: CanvasRenderingContext2D, slot: number, img: HTMLImageElement): void {
  const col = slot % ATLAS_TILES;
  const row = Math.floor(slot / ATLAS_TILES);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, col * TILE, row * TILE, TILE, TILE);
}

/** 加载开源贴图并写入图集；单个失败时保留程序化回退。必须先于 Game 初始化调用。 */
export function initTextures(): Promise<void> {
  const canvas = ensureAtlasCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve();
  const loadOne = (slot: number): Promise<void> => {
    const url = TEXTURE_URLS[slot];
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(), 5000); // 超时按失败处理
      img.onload = () => {
        window.clearTimeout(timer);
        try {
          drawImageToTile(ctx, slot, img);
        } catch {
          // 忽略，保留回退
        }
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve();
      };
      img.src = url;
    });
  };
  const tasks: Promise<void>[] = [];
  for (let slot = 0; slot < TEX_COUNT; slot++) tasks.push(loadOne(slot));
  return Promise.all(tasks).then(() => {
    if (atlasTexture) atlasTexture.needsUpdate = true;
  });
}

export function getAtlasCanvas(): HTMLCanvasElement {
  return ensureAtlasCanvas();
}

export function getAtlasTexture(): THREE.CanvasTexture {
  if (!atlasTexture) {
    atlasTexture = new THREE.CanvasTexture(ensureAtlasCanvas());
    atlasTexture.flipY = false; // 关键：与 UV 的 v 方向保持一致，否则采到空白区变黑
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;
    atlasTexture.generateMipmaps = false;
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return atlasTexture;
}

/** 某纹理槽位在图集中的 [u0,v0,u1,v1] */
export function tileUV(slot: number): [number, number, number, number] {
  const col = slot % ATLAS_TILES;
  const row = Math.floor(slot / ATLAS_TILES);
  return [col / ATLAS_TILES, row / ATLAS_TILES, (col + 1) / ATLAS_TILES, (row + 1) / ATLAS_TILES];
}

/** 生成热栏/选择器图标 */
export function makeBlockIcon(id: number, size = 32): HTMLCanvasElement {
  const atlas = ensureAtlasCanvas();
  const slot = blockInfo(id).texSide;
  const col = slot % ATLAS_TILES;
  const row = Math.floor(slot / ATLAS_TILES);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, col * TILE, row * TILE, TILE, TILE, 0, 0, size, size);
  return c;
}