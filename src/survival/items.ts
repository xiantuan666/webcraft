/** 物品注册表：方块物品(1..29 对应 Block) + 材料 + 工具 */
export const enum Item {
  Air = 0,
  Stick = 100,
  Coal = 101,
  IronIngot = 102,
  GoldIngot = 103,
  Diamond = 104,
  RedstoneDust = 105,
  Lapis = 106,
  Charcoal = 107,
  WoodPickaxe = 200,
  StonePickaxe = 201,
  IronPickaxe = 202,
  WoodAxe = 203,
  StoneAxe = 204,
  IronAxe = 205,
  WoodShovel = 206,
  StoneShovel = 207,
  IronShovel = 208,
  WoodSword = 209,
  StoneSword = 210,
  IronSword = 211,
}

export const enum ToolType {
  Pickaxe = 'pickaxe',
  Axe = 'axe',
  Shovel = 'shovel',
  Sword = 'sword',
}

export interface ToolInfo {
  type: ToolType;
  tier: number; // 1 木 2 石 3 铁
  speed: number;
  durability: number;
}

export interface ItemInfo {
  id: number;
  name: string;
  stackMax: number;
  blockId?: number;
  tool?: ToolInfo;
}

const ITEMS: Record<number, ItemInfo> = {
  [Item.Stick]: { id: Item.Stick, name: '木棍', stackMax: 64 },
  [Item.Coal]: { id: Item.Coal, name: '煤炭', stackMax: 64 },
  [Item.Charcoal]: { id: Item.Charcoal, name: '木炭', stackMax: 64 },
  [Item.IronIngot]: { id: Item.IronIngot, name: '铁锭', stackMax: 64 },
  [Item.GoldIngot]: { id: Item.GoldIngot, name: '金锭', stackMax: 64 },
  [Item.Diamond]: { id: Item.Diamond, name: '钻石', stackMax: 64 },
  [Item.RedstoneDust]: { id: Item.RedstoneDust, name: '红石粉', stackMax: 64 },
  [Item.Lapis]: { id: Item.Lapis, name: '青金石', stackMax: 64 },
  [Item.WoodPickaxe]: { id: Item.WoodPickaxe, name: '木镐', stackMax: 1, tool: { type: ToolType.Pickaxe, tier: 1, speed: 2, durability: 60 } },
  [Item.StonePickaxe]: { id: Item.StonePickaxe, name: '石镐', stackMax: 1, tool: { type: ToolType.Pickaxe, tier: 2, speed: 4, durability: 132 } },
  [Item.IronPickaxe]: { id: Item.IronPickaxe, name: '铁镐', stackMax: 1, tool: { type: ToolType.Pickaxe, tier: 3, speed: 6, durability: 251 } },
  [Item.WoodAxe]: { id: Item.WoodAxe, name: '木斧', stackMax: 1, tool: { type: ToolType.Axe, tier: 1, speed: 2, durability: 60 } },
  [Item.StoneAxe]: { id: Item.StoneAxe, name: '石斧', stackMax: 1, tool: { type: ToolType.Axe, tier: 2, speed: 4, durability: 132 } },
  [Item.IronAxe]: { id: Item.IronAxe, name: '铁斧', stackMax: 1, tool: { type: ToolType.Axe, tier: 3, speed: 6, durability: 251 } },
  [Item.WoodShovel]: { id: Item.WoodShovel, name: '木铲', stackMax: 1, tool: { type: ToolType.Shovel, tier: 1, speed: 2, durability: 60 } },
  [Item.StoneShovel]: { id: Item.StoneShovel, name: '石铲', stackMax: 1, tool: { type: ToolType.Shovel, tier: 2, speed: 4, durability: 132 } },
  [Item.IronShovel]: { id: Item.IronShovel, name: '铁铲', stackMax: 1, tool: { type: ToolType.Shovel, tier: 3, speed: 6, durability: 251 } },
  [Item.WoodSword]: { id: Item.WoodSword, name: '木剑', stackMax: 1, tool: { type: ToolType.Sword, tier: 1, speed: 2, durability: 60 } },
  [Item.StoneSword]: { id: Item.StoneSword, name: '石剑', stackMax: 1, tool: { type: ToolType.Sword, tier: 2, speed: 4, durability: 132 } },
  [Item.IronSword]: { id: Item.IronSword, name: '铁剑', stackMax: 1, tool: { type: ToolType.Sword, tier: 3, speed: 6, durability: 251 } },
};

export function itemInfo(id: number): ItemInfo {
  const isBlock = id >= 1 && id <= 29;
  return ITEMS[id] ?? { id, name: isBlock ? '方块' : '未知', stackMax: 64, blockId: isBlock ? id : undefined };
}

export function isTool(id: number): boolean {
  return ITEMS[id]?.tool != null;
}

export function isBlockItem(id: number): boolean {
  return id >= 1 && id <= 29;
}

export function toolSpeed(id: number): number {
  return ITEMS[id]?.tool?.speed ?? 1;
}

export function toolType(id: number): ToolType | null {
  return ITEMS[id]?.tool?.type ?? null;
}

export function toolTier(id: number): number {
  return ITEMS[id]?.tool?.tier ?? 0;
}

export function toolDurability(id: number): number {
  return ITEMS[id]?.tool?.durability ?? 0;
}