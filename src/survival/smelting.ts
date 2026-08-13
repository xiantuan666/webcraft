import { Block } from '../world/blockIds';
import { Item } from './items';

export interface SmeltRecipe {
  input: number;
  output: number;
  outputCount: number;
}

export const SMELT_RECIPES: SmeltRecipe[] = [
  { input: Block.IronOre, output: Item.IronIngot, outputCount: 1 },
  { input: Block.GoldOre, output: Item.GoldIngot, outputCount: 1 },
  { input: Block.Sand, output: Block.Glass, outputCount: 1 },
  { input: Block.Cobblestone, output: Block.Stone, outputCount: 1 },
  { input: Block.Log, output: Item.Charcoal, outputCount: 1 },
];

/** 燃料可烧制单位数 */
export const FUEL_BURN: Record<number, number> = {
  [Item.Coal]: 8,
  [Item.Charcoal]: 8,
  [Block.Planks]: 1.5,
  [Block.Log]: 1.5,
  [Item.Stick]: 0.5,
};

export const SMELT_TIME = 10; // 秒

export function smeltRecipeFor(input: number): SmeltRecipe | null {
  return SMELT_RECIPES.find((r) => r.input === input) ?? null;
}

export function isFuel(id: number): boolean {
  return id in FUEL_BURN;
}

export class Furnace {
  inputId = 0;
  inputCount = 0;
  fuelId = 0;
  fuelCount = 0;
  outputId = 0;
  outputCount = 0;
  fuelRemaining = 0;
  progress = 0;

  tick(dt: number): void {
    const recipe = smeltRecipeFor(this.inputId);
    const canOutput = recipe != null && (this.outputId === 0 || (this.outputId === recipe.output && this.outputCount + recipe.outputCount <= 64));
    if (this.fuelRemaining > 0) {
      this.fuelRemaining -= dt;
      if (recipe && canOutput && this.inputCount > 0) {
        this.progress += dt / SMELT_TIME;
        if (this.progress >= 1) {
          this.progress = 0;
          this.inputCount--;
          if (this.outputId === 0) this.outputId = recipe.output;
          this.outputCount += recipe.outputCount;
          if (this.inputCount <= 0) { this.inputId = 0; this.progress = 0; }
        }
      }
    } else {
      this.progress = 0;
      if (recipe && canOutput && this.inputCount > 0 && isFuel(this.fuelId) && this.fuelCount > 0) {
        this.fuelRemaining = FUEL_BURN[this.fuelId];
        this.fuelCount--;
        if (this.fuelCount <= 0) this.fuelId = 0;
      }
    }
    if (this.fuelRemaining < 0) this.fuelRemaining = 0;
  }

  isLit(): boolean {
    return this.fuelRemaining > 0 && this.inputId !== 0;
  }

  setInput(id: number, count: number): void {
    if (this.inputId === 0 || this.inputId === id) {
      this.inputId = id;
      this.inputCount = Math.min(64, this.inputCount + count);
    }
  }

  takeInput(count: number): boolean {
    if (this.inputCount < count) return false;
    this.inputCount -= count;
    if (this.inputCount <= 0) { this.inputId = 0; this.progress = 0; }
    return true;
  }

  setFuel(id: number, count: number): void {
    if (this.fuelId === 0 || this.fuelId === id) {
      this.fuelId = id;
      this.fuelCount = Math.min(64, this.fuelCount + count);
    }
  }

  takeFuel(count: number): boolean {
    if (this.fuelCount < count) return false;
    this.fuelCount -= count;
    if (this.fuelCount <= 0) this.fuelId = 0;
    return true;
  }

  takeOutput(count: number): boolean {
    if (this.outputCount < count) return false;
    this.outputCount -= count;
    if (this.outputCount <= 0) this.outputId = 0;
    return true;
  }

  serialize(): unknown {
    return { i: this.inputId, ic: this.inputCount, f: this.fuelId, fc: this.fuelCount, o: this.outputId, oc: this.outputCount, fr: this.fuelRemaining, p: this.progress };
  }

  static deserialize(data: any): Furnace {
    const f = new Furnace();
    if (!data) return f;
    f.inputId = data.i ?? 0;
    f.inputCount = data.ic ?? 0;
    f.fuelId = data.f ?? 0;
    f.fuelCount = data.fc ?? 0;
    f.outputId = data.o ?? 0;
    f.outputCount = data.oc ?? 0;
    f.fuelRemaining = data.fr ?? 0;
    f.progress = data.p ?? 0;
    return f;
  }
}