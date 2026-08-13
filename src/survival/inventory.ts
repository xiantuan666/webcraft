import { itemInfo } from './items';

export interface ItemStack {
  id: number;
  count: number;
  durability: number;
}

export const INV_SIZE = 36; // 0-8 热栏，9-35 背包
export const HOTBAR_SIZE = 9;

export function emptyStack(): ItemStack {
  return { id: 0, count: 0, durability: 0 };
}

export class Inventory {
  slots: ItemStack[];

  constructor() {
    this.slots = Array.from({ length: INV_SIZE }, () => emptyStack());
  }

  get(slot: number): ItemStack {
    return this.slots[slot] ?? emptyStack();
  }

  set(slot: number, stack: ItemStack): void {
    this.slots[slot] = stack;
  }

  stackMax(id: number): number {
    return itemInfo(id).stackMax;
  }

  /** 添加物品，返回放不下的数量 */
  addItem(id: number, count: number, durability = 0): number {
    if (id <= 0 || count <= 0) return count;
    const max = this.stackMax(id);
    let left = count;
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (s.id === id && s.count < max) {
        const take = Math.min(max - s.count, left);
        s.count += take;
        left -= take;
      }
    }
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      if (this.slots[i].id === 0) {
        const take = Math.min(max, left);
        this.slots[i] = { id, count: take, durability };
        left -= take;
      }
    }
    return left;
  }

  removeSlot(slot: number, count: number): boolean {
    const s = this.slots[slot];
    if (!s || s.id === 0 || s.count < count) return false;
    s.count -= count;
    if (s.count <= 0) this.slots[slot] = emptyStack();
    return true;
  }

  damageHeld(slot: number, amount: number): void {
    const s = this.slots[slot];
    if (!s || s.id === 0) return;
    s.durability -= amount;
    if (s.durability <= 0) this.slots[slot] = emptyStack();
  }

  swap(a: number, b: number): void {
    const tmp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = tmp;
  }

  merge(a: number, b: number): boolean {
    const sa = this.slots[a];
    const sb = this.slots[b];
    if (sa.id === 0) return true;
    if (sb.id === 0) {
      this.slots[b] = sa;
      this.slots[a] = emptyStack();
      return true;
    }
    if (sa.id === sb.id && sa.durability === sb.durability) {
      const space = this.stackMax(sa.id) - sb.count;
      if (space >= sa.count) {
        sb.count += sa.count;
        this.slots[a] = emptyStack();
        return true;
      }
    }
    return false;
  }

  countItem(id: number): number {
    let n = 0;
    for (const s of this.slots) if (s.id === id) n += s.count;
    return n;
  }

  serialize(): ItemStack[] {
    return this.slots.map((s) => ({ ...s }));
  }

  deserialize(data: ItemStack[]): void {
    this.slots = Array.from({ length: INV_SIZE }, () => emptyStack());
    for (let i = 0; i < Math.min(INV_SIZE, data.length); i++) {
      this.slots[i] = { ...data[i] };
    }
  }
}