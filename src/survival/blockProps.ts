import { Block } from '../world/blockIds';
import { Item, toolType, toolTier, toolSpeed } from './items';

export interface BlockProps {
  hardness: number;
  minTier: number; // 0 任意 / 1 石镐 / 2 铁镐
  toolType: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';
  drops: { item: number; count: [number, number] } | null;
}

type Opts = Partial<Pick<BlockProps, 'hardness' | 'minTier' | 'toolType' | 'drops'>>;

function P(hardness: number, opts: Opts = {}): BlockProps {
  return {
    hardness,
    minTier: opts.minTier ?? 0,
    toolType: opts.toolType ?? 'none',
    drops: opts.drops ?? null,
  };
}

const PROPS: Record<number, BlockProps> = {
  [Block.Grass]: P(0.6, { toolType: 'shovel', drops: { item: Block.Dirt, count: [1, 1] } }),
  [Block.Dirt]: P(0.6, { toolType: 'shovel', drops: { item: Block.Dirt, count: [1, 1] } }),
  [Block.Sand]: P(0.5, { toolType: 'shovel', drops: { item: Block.Sand, count: [1, 1] } }),
  [Block.Gravel]: P(0.6, { toolType: 'shovel', drops: { item: Block.Gravel, count: [1, 1] } }),
  [Block.Snow]: P(0.2, { toolType: 'shovel', drops: { item: Block.Snow, count: [1, 1] } }),
  [Block.Stone]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Block.Cobblestone, count: [1, 1] } }),
  [Block.Cobblestone]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Block.Cobblestone, count: [1, 1] } }),
  [Block.Log]: P(2.5, { toolType: 'axe', drops: { item: Block.Log, count: [1, 1] } }),
  [Block.Planks]: P(2.0, { toolType: 'axe', drops: { item: Block.Planks, count: [1, 1] } }),
  [Block.CraftingTable]: P(2.5, { toolType: 'axe', drops: { item: Block.CraftingTable, count: [1, 1] } }),
  [Block.Leaves]: P(0.2, { toolType: 'sword', drops: null }),
  [Block.Glass]: P(0.3, { drops: null }),
  [Block.Bedrock]: P(Infinity, { drops: null }),
  [Block.Brick]: P(2.0, { drops: { item: Block.Brick, count: [1, 1] } }),
  [Block.Glowstone]: P(0.3, { drops: { item: Block.Glowstone, count: [1, 1] } }),
  [Block.WoolWhite]: P(0.8, { drops: { item: Block.WoolWhite, count: [1, 1] } }),
  [Block.WoolRed]: P(0.8, { drops: { item: Block.WoolRed, count: [1, 1] } }),
  [Block.WoolBlue]: P(0.8, { drops: { item: Block.WoolBlue, count: [1, 1] } }),
  [Block.WoolGreen]: P(0.8, { drops: { item: Block.WoolGreen, count: [1, 1] } }),
  [Block.WoolYellow]: P(0.8, { drops: { item: Block.WoolYellow, count: [1, 1] } }),
  [Block.CoalOre]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Item.Coal, count: [1, 1] } }),
  [Block.IronOre]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Block.IronOre, count: [1, 1] } }),
  [Block.GoldOre]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Block.GoldOre, count: [1, 1] } }),
  [Block.RedstoneOre]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Item.RedstoneDust, count: [4, 6] } }),
  [Block.LapisOre]: P(3.0, { minTier: 2, toolType: 'pickaxe', drops: { item: Item.Lapis, count: [4, 6] } }),
  [Block.DiamondOre]: P(3.0, { minTier: 3, toolType: 'pickaxe', drops: { item: Item.Diamond, count: [1, 1] } }),
  [Block.Furnace]: P(3.5, { minTier: 2, toolType: 'pickaxe', drops: { item: Block.Furnace, count: [1, 1] } }),
  [Block.FurnaceLit]: P(3.5, { minTier: 2, toolType: 'pickaxe', drops: { item: Block.Furnace, count: [1, 1] } }),
};

export function blockProps(id: number): BlockProps {
  return PROPS[id] ?? P(1.0);
}

/** 计算手持物品挖掘某方块的速度与是否可掉落 */
export function effectiveSpeed(heldItem: number, blockId: number): { speed: number; canDrop: boolean } {
  const props = blockProps(blockId);
  if (blockId === Block.Bedrock || props.hardness === Infinity) return { speed: 0, canDrop: false };
  const type = toolType(heldItem);
  const tier = toolTier(heldItem);
  let speed = 1;
  let canDrop = tier >= props.minTier;
  if (props.toolType === 'none') {
    speed = 1;
  } else if (type === props.toolType) {
    speed = toolSpeed(heldItem);
  } else {
    speed = 1;
    if (props.minTier > 0) canDrop = false;
  }
  return { speed, canDrop };
}

export function miningTime(heldItem: number, blockId: number): number {
  const { speed } = effectiveSpeed(heldItem, blockId);
  const props = blockProps(blockId);
  if (speed <= 0) return Infinity;
  return props.hardness / speed;
}