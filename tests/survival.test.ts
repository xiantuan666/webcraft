import { describe, it, expect } from 'vitest';
import { Inventory } from '../src/survival/inventory';
import { matchRecipe } from '../src/survival/crafting';
import { Furnace, smeltRecipeFor, isFuel, SMELT_RECIPES } from '../src/survival/smelting';
import { effectiveSpeed } from '../src/survival/blockProps';
import { Block } from '../src/world/blockIds';
import { Item } from '../src/survival/items';
import { World } from '../src/world/world';
import { defaultWorldConfig, generateWorld } from '../src/world/terrain';

describe('inventory', () => {
  it('adds and stacks items', () => {
    const inv = new Inventory();
    expect(inv.addItem(Block.Dirt, 10)).toBe(0);
    expect(inv.countItem(Block.Dirt)).toBe(10);
    expect(inv.addItem(Block.Dirt, 100)).toBe(0); // 溢出部分放入其它空格
    expect(inv.countItem(Block.Dirt)).toBe(110);
  });

  it('tools do not stack', () => {
    const inv = new Inventory();
    expect(inv.addItem(Item.WoodPickaxe, 1)).toBe(0);
    expect(inv.addItem(Item.WoodPickaxe, 1)).toBe(0); // 不叠加但可占另一格
    expect(inv.countItem(Item.WoodPickaxe)).toBe(2);
  });

  it('damage destroys tool at zero durability', () => {
    const inv = new Inventory();
    inv.addItem(Item.WoodPickaxe, 1, 60);
    inv.damageHeld(0, 59);
    expect(inv.get(0).id).toBe(Item.WoodPickaxe);
    inv.damageHeld(0, 1);
    expect(inv.get(0).id).toBe(0);
  });

  it('merge combines stacks', () => {
    const inv = new Inventory();
    inv.addItem(Block.Dirt, 10);
    inv.addItem(Block.Dirt, 10);
    expect(inv.merge(0, 1)).toBe(true);
    expect(inv.get(0).id).toBe(0);
    expect(inv.get(1).count).toBe(20);
  });
});

describe('crafting', () => {
  const grid = (w: number, h: number, ids: number[]) => {
    const g: number[][] = [];
    for (let y = 0; y < h; y++) {
      const row: number[] = [];
      for (let x = 0; x < w; x++) row.push(ids[y * w + x] ?? 0);
      g.push(row);
    }
    return g;
  };

  it('log -> 4 planks', () => {
    const r = matchRecipe(grid(2, 2, [Block.Log, 0, 0, 0]), 2, 2);
    expect(r?.result).toBe(Block.Planks);
    expect(r?.resultCount).toBe(4);
  });

  it('2 planks -> 4 sticks (with offset)', () => {
    const r = matchRecipe(grid(2, 2, [Block.Planks, 0, Block.Planks, 0]), 2, 2);
    expect(r?.result).toBe(Item.Stick);
    expect(r?.resultCount).toBe(4);
  });

  it('crafting table from 4 planks', () => {
    const r = matchRecipe(grid(2, 2, [Block.Planks, Block.Planks, Block.Planks, Block.Planks]), 2, 2);
    expect(r?.result).toBe(Block.CraftingTable);
  });

  it('wooden pickaxe needs 3x3 (only on crafting table)', () => {
    const r = matchRecipe(grid(3, 3, [Block.Planks, Block.Planks, Block.Planks, 0, Item.Stick, 0, 0, Item.Stick, 0]), 3, 3);
    expect(r?.result).toBe(Item.WoodPickaxe);
    // 2x2 网格里放不下 3x3 配方
    expect(matchRecipe(grid(2, 2, [Block.Planks, Block.Planks, Block.Planks, 0]), 2, 2)).toBeNull();
  });

  it('furnace from 8 cobblestone', () => {
    const r = matchRecipe(grid(3, 3, [Block.Cobblestone, Block.Cobblestone, Block.Cobblestone, Block.Cobblestone, 0, Block.Cobblestone, Block.Cobblestone, Block.Cobblestone, Block.Cobblestone]), 3, 3);
    expect(r?.result).toBe(Block.Furnace);
  });
});

describe('smelting', () => {
  it('iron ore -> iron ingot with coal fuel', () => {
    const f = new Furnace();
    f.setInput(Block.IronOre, 1);
    f.setFuel(Item.Coal, 1);
    f.tick(10); // 点燃燃料
    expect(f.fuelRemaining).toBeGreaterThan(0);
    f.tick(10); // 烧制完成
    expect(f.outputId).toBe(Item.IronIngot);
    expect(f.outputCount).toBe(1);
    expect(f.inputCount).toBe(0);
  });

  it('smelt recipes defined', () => {
    expect(smeltRecipeFor(Block.IronOre)?.output).toBe(Item.IronIngot);
    expect(smeltRecipeFor(Block.Sand)?.output).toBe(Block.Glass);
    expect(smeltRecipeFor(Block.Cobblestone)?.output).toBe(Block.Stone);
    expect(smeltRecipeFor(Block.Log)?.output).toBe(Item.Charcoal);
    expect(SMELT_RECIPES.length).toBeGreaterThanOrEqual(4);
  });

  it('fuel check', () => {
    expect(isFuel(Item.Coal)).toBe(true);
    expect(isFuel(Block.Planks)).toBe(true);
    expect(isFuel(Block.Stone)).toBe(false);
  });
});

describe('blockProps / tools', () => {
  it('stone needs pickaxe tier >= 1 to drop', () => {
    expect(effectiveSpeed(Item.WoodPickaxe, Block.Stone).canDrop).toBe(false); // 木镐挖不掉石头
    expect(effectiveSpeed(Item.StonePickaxe, Block.Stone).canDrop).toBe(true);
    expect(effectiveSpeed(Item.IronPickaxe, Block.Stone).canDrop).toBe(true);
    expect(effectiveSpeed(Item.WoodAxe, Block.Stone).canDrop).toBe(false);
  });

  it('diamond needs iron pickaxe (tier 3)', () => {
    expect(effectiveSpeed(Item.StonePickaxe, Block.DiamondOre).canDrop).toBe(false);
    expect(effectiveSpeed(Item.IronPickaxe, Block.DiamondOre).canDrop).toBe(true);
  });

  it('hand mines dirt fine', () => {
    expect(effectiveSpeed(0, Block.Dirt).canDrop).toBe(true);
  });

  it('bedrock unbreakable', () => {
    expect(effectiveSpeed(Item.IronPickaxe, Block.Bedrock).speed).toBe(0);
  });
});

describe('ores', () => {
  it('world generation places ores deterministically and some exist', () => {
    const a = new World(defaultWorldConfig(55));
    generateWorld(a, a.config);
    const b = new World(defaultWorldConfig(55));
    generateWorld(b, b.config);
    let coal = 0;
    let iron = 0;
    for (let x = 0; x < 256; x += 8) {
      for (let z = 0; z < 256; z += 8) {
        for (let y = 1; y < 40; y++) {
          const id = a.getBlock(x, y, z);
          if (id === Block.CoalOre) coal++;
          if (id === Block.IronOre) iron++;
          if (a.getBlock(x, y, z) !== b.getBlock(x, y, z)) throw new Error('not deterministic');
        }
      }
    }
    expect(coal).toBeGreaterThan(0);
    expect(iron).toBeGreaterThan(0);
  });
});