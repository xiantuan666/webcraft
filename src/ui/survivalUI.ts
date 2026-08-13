import { makeItemIcon } from '../render/itemTextures';
import { itemInfo } from '../survival/items';
import type { ItemStack } from '../survival/inventory';
import { el } from './dom';

export type UIScreen = 'inventory' | 'crafting' | 'furnace';

export interface FurnaceUIState {
  input: ItemStack;
  fuel: ItemStack;
  output: ItemStack;
  progress: number; // 0..1
  lit: boolean;
}

export interface UIState {
  screen: UIScreen;
  title: string;
  craftW: number;
  craftH: number;
  craftGrid: number[]; // craftW*craftH 个物品 id
  craftResult: { id: number; count: number } | null;
  inventory: ItemStack[];
  carried: ItemStack;
  furnace: FurnaceUIState | null;
}

export interface UICallbacks {
  onInvClick(i: number): void;
  onCraftCell(i: number): void;
  onCraftResult(): void;
  onFurnaceSlot(which: 'in' | 'fuel' | 'out'): void;
  onClose(): void;
}

function slotHTML(stack: ItemStack | null | undefined): string {
  if (!stack || stack.id <= 0 || stack.count <= 0) return '<div class="s"></div>';
  const icon = makeItemIcon(stack.id, 34).toDataURL();
  const name = itemInfo(stack.id).name;
  const count = stack.count > 1 ? `<span class="n">${stack.count}</span>` : '';
  const maxDur = itemInfo(stack.id).tool?.durability ?? 0;
  const dur = maxDur > 0 ? `<div class="du"><div style="width:${((stack.durability / maxDur) * 100).toFixed(0)}%"></div></div>` : '';
  return `<div class="s" title="${name}"><img src="${icon}" alt="" />${count}${dur}</div>`;
}

/** 生存界面：背包 / 合成 / 熔炉（点击式移动物品） */
export class SurvivalUI {
  private root: HTMLElement;
  private callbacks: UICallbacks;
  private state: UIState | null = null;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
    this.root = el('inv-screen');
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const slot = target.closest('[data-slot]') as HTMLElement | null;
      if (!slot) return;
      const kind = slot.dataset.slot;
      const idx = Number(slot.dataset.idx ?? '-1');
      if (kind === 'inv') this.callbacks.onInvClick(idx);
      else if (kind === 'craft') this.callbacks.onCraftCell(idx);
      else if (kind === 'result') this.callbacks.onCraftResult();
      else if (kind === 'fin') this.callbacks.onFurnaceSlot('in');
      else if (kind === 'ffuel') this.callbacks.onFurnaceSlot('fuel');
      else if (kind === 'fout') this.callbacks.onFurnaceSlot('out');
    });
  }

  open(state: UIState): void {
    this.root.classList.remove('hidden');
    this.update(state);
  }

  /** 用最新状态刷新渲染（修复旧快照不更新的问题） */
  update(state: UIState): void {
    this.state = state;
    this.render();
  }

  close(): void {
    this.state = null;
    this.root.classList.add('hidden');
  }

  isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private render(): void {
    const st = this.state;
    if (!st) return;
    const carried = st.carried && st.carried.id > 0 ? slotHTML(st.carried) : '<div class="s"></div>';
    let html = `<div class="inv-panel"><div class="inv-title">${escapeHtml(st.title)}</div>`;
    html += `<div class="inv-carried"><span>手持</span>${carried}</div>`;
    if (st.screen === 'furnace' && st.furnace) {
      const f = st.furnace;
      html += '<div class="furnace-zone">';
      html += `<div class="f-slot" data-slot="fin">输入${slotHTML(f.input)}</div>`;
      html += `<div class="f-progress"><div class="f-flame" style="opacity:${f.lit ? 1 : 0.2}">🔥</div><div class="f-bar"><div style="width:${(f.progress * 100).toFixed(0)}%"></div></div></div>`;
      html += `<div class="f-slot" data-slot="ffuel">燃料${slotHTML(f.fuel)}</div>`;
      html += `<div class="f-slot" data-slot="fout">输出${slotHTML(f.output)}</div>`;
      html += '</div>';
    } else {
      html += `<div class="craft-zone"><div class="craft-grid" style="grid-template-columns:repeat(${st.craftW},44px);grid-template-rows:repeat(${st.craftH},44px)">`;
      for (let i = 0; i < st.craftW * st.craftH; i++) {
        const id = st.craftGrid[i] ?? 0;
        html += `<div class="cg" data-slot="craft" data-idx="${i}">${id > 0 ? slotHTML({ id, count: 1, durability: 0 }) : ''}</div>`;
      }
      html += '</div>';
      const result = st.craftResult ? slotHTML({ id: st.craftResult.id, count: st.craftResult.count, durability: 0 }) : '<div class="s"></div>';
      html += `<div class="craft-result"><div data-slot="result">${result}</div></div></div>`;
    }
    html += '<div class="inv-grid" style="grid-template-columns:repeat(9,44px)">';
    for (let i = 0; i < 9; i++) html += `<div data-slot="inv" data-idx="${i}">${slotHTML(st.inventory[i])}</div>`;
    html += '</div><div class="inv-grid" style="grid-template-columns:repeat(9,44px)">';
    for (let i = 9; i < 36; i++) html += `<div data-slot="inv" data-idx="${i}">${slotHTML(st.inventory[i])}</div>`;
    html += '</div>';
    html += `<div class="inv-close" data-slot="close">关闭 (E/Esc)</div>`;
    html += '</div>';
    this.root.innerHTML = html;
    const close = this.root.querySelector('[data-slot="close"]');
    if (close) close.addEventListener('click', () => this.callbacks.onClose());
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}