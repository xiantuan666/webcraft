/** 方块 ID 注册表（v2，含生存模式矿石/熔炉/工作台） */
export const enum Block {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  Sand = 5,
  Water = 6,
  Log = 7,
  Leaves = 8,
  Planks = 9,
  Glass = 10,
  Bedrock = 11,
  Brick = 12,
  Glowstone = 13,
  Gravel = 14,
  Snow = 15,
  WoolWhite = 16,
  WoolRed = 17,
  WoolBlue = 18,
  WoolGreen = 19,
  WoolYellow = 20,
  CoalOre = 21,
  IronOre = 22,
  GoldOre = 23,
  DiamondOre = 24,
  RedstoneOre = 25,
  LapisOre = 26,
  Furnace = 27,
  FurnaceLit = 28,
  CraftingTable = 29,
}

/** 纹理图集槽位（16×16 图集） */
export const enum Tex {
  GrassTop = 0,
  GrassSide = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  Sand = 5,
  Water = 6,
  LogSide = 7,
  LogTop = 8,
  Leaves = 9,
  Planks = 10,
  Glass = 11,
  Bedrock = 12,
  Brick = 13,
  Glowstone = 14,
  Gravel = 15,
  Snow = 16,
  WoolWhite = 17,
  WoolRed = 18,
  WoolBlue = 19,
  WoolGreen = 20,
  WoolYellow = 21,
  CoalOre = 22,
  IronOre = 23,
  GoldOre = 24,
  DiamondOre = 25,
  RedstoneOre = 26,
  LapisOre = 27,
  FurnaceFront = 28,
  FurnaceFrontActive = 29,
  FurnaceSide = 30,
  FurnaceTop = 31,
  CraftingTable = 32,
}

export interface BlockInfo {
  readonly id: number;
  readonly name: string;
  readonly solid: boolean;
  readonly opaque: boolean;
  readonly liquid: boolean;
  readonly texTop: number;
  readonly texSide: number;
  readonly texBottom: number;
  readonly texFront: number;
}

type BlockOpts = Partial<Pick<BlockInfo, 'solid' | 'opaque' | 'liquid' | 'texTop' | 'texSide' | 'texBottom' | 'texFront'>>;

function B(id: number, name: string, tex: number, opts: BlockOpts = {}): BlockInfo {
  return {
    id,
    name,
    solid: opts.solid ?? true,
    opaque: opts.opaque ?? true,
    liquid: opts.liquid ?? false,
    texTop: opts.texTop ?? tex,
    texSide: opts.texSide ?? tex,
    texBottom: opts.texBottom ?? tex,
    texFront: opts.texFront ?? tex,
  };
}

export const BLOCKS: readonly BlockInfo[] = [
  B(Block.Air, '空气', Tex.Water, { solid: false, opaque: false }),
  B(Block.Grass, '草方块', Tex.GrassSide, { texTop: Tex.GrassTop, texBottom: Tex.Dirt }),
  B(Block.Dirt, '泥土', Tex.Dirt),
  B(Block.Stone, '石头', Tex.Stone),
  B(Block.Cobblestone, '圆石', Tex.Cobblestone),
  B(Block.Sand, '沙子', Tex.Sand),
  B(Block.Water, '水', Tex.Water, { solid: false, opaque: false, liquid: true }),
  B(Block.Log, '橡木原木', Tex.LogSide, { texTop: Tex.LogTop, texBottom: Tex.LogTop }),
  B(Block.Leaves, '橡树树叶', Tex.Leaves),
  B(Block.Planks, '橡木木板', Tex.Planks),
  B(Block.Glass, '玻璃', Tex.Glass, { opaque: false }),
  B(Block.Bedrock, '基岩', Tex.Bedrock),
  B(Block.Brick, '砖块', Tex.Brick),
  B(Block.Glowstone, '萤石', Tex.Glowstone),
  B(Block.Gravel, '砂砾', Tex.Gravel),
  B(Block.Snow, '雪块', Tex.Snow),
  B(Block.WoolWhite, '白色羊毛', Tex.WoolWhite),
  B(Block.WoolRed, '红色羊毛', Tex.WoolRed),
  B(Block.WoolBlue, '蓝色羊毛', Tex.WoolBlue),
  B(Block.WoolGreen, '绿色羊毛', Tex.WoolGreen),
  B(Block.WoolYellow, '黄色羊毛', Tex.WoolYellow),
  B(Block.CoalOre, '煤矿石', Tex.CoalOre),
  B(Block.IronOre, '铁矿石', Tex.IronOre),
  B(Block.GoldOre, '金矿石', Tex.GoldOre),
  B(Block.DiamondOre, '钻石矿石', Tex.DiamondOre),
  B(Block.RedstoneOre, '红石矿石', Tex.RedstoneOre),
  B(Block.LapisOre, '青金石矿石', Tex.LapisOre),
  B(Block.Furnace, '熔炉', Tex.FurnaceSide, { texTop: Tex.FurnaceTop, texBottom: Tex.Stone, texFront: Tex.FurnaceFront }),
  B(Block.FurnaceLit, '熔炉(燃烧)', Tex.FurnaceSide, { texTop: Tex.FurnaceTop, texBottom: Tex.Stone, texFront: Tex.FurnaceFrontActive }),
  B(Block.CraftingTable, '工作台', Tex.CraftingTable),
];

export function blockInfo(id: number): BlockInfo {
  return BLOCKS[id] ?? BLOCKS[Block.Air];
}
export function isSolid(id: number): boolean {
  return blockInfo(id).solid;
}
export function isOpaque(id: number): boolean {
  return blockInfo(id).opaque;
}

/** HUD 可建造方块调色板（创造模式作弊用；按序号排列） */
export const PALETTE: readonly number[] = [
  Block.Grass, Block.Stone, Block.Cobblestone, Block.Sand, Block.Log,
  Block.Planks, Block.Glass, Block.Brick, Block.Glowstone,
  Block.Dirt, Block.Gravel, Block.Snow, Block.Leaves,
  Block.WoolWhite, Block.WoolRed, Block.WoolBlue, Block.WoolGreen, Block.WoolYellow,
  Block.Water,
  Block.CoalOre, Block.IronOre, Block.GoldOre, Block.DiamondOre, Block.RedstoneOre, Block.LapisOre,
  Block.Furnace, Block.CraftingTable,
];