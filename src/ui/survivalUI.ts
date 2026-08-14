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
  craftGrid: ItemStack[]; // craftW*craftH 个格子（支持整叠）
  craftResult: { id: number; count: number } | null;
  inventory: ItemStack[];
  carried: ItemStack;
  furnace: FurnaceUIState | null;
}

export interface UICallbacks {
  onInvClick(i: number, button: number): void;
  onCraftCell(i: number, button: number): void;
  onCraftResult(): void;
  onFurnaceSlot(which: 'in' | 'fuel' | 'out', button: number): void;
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

/** 生存界面：背包 / 合成 / 熔炉（原版交互：左键整组、右键半组或放 1 个、可拖拽、悬浮提示） */
export class SurvivalUI {
  private root: HTMLElement;
  private callbacks: UICallbacks;
  private state: UIState | null = null;
  private ghost: HTMLElement | null = null;
  private tooltip: HTMLElement;
  private dragging = false;
  private moved = false;
  private from: { kind: string; idx: number; button: number; x: number; y: number } | null = null;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
    this.root = el('inv-screen');
    this.tooltip = el('item-tooltip');
    this.root.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', () => this.endDrag());
    window.addEventListener('blur', () => this.endDrag());
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 2) return;
    const slot = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    if (!slot) return;
    e.preventDefault();
    const kind = slot.dataset.slot ?? '';
    const idx = Number(slot.dataset.idx ?? '-1');
    if (kind === 'close') return;
    this.dragging = true;
    this.moved = false;
    this.from = { kind, idx, button: e.button, x: e.clientX, y: e.clientY };
    this.hideTooltip();
    // 按下即处理源格（拿起/放下/半组/放1/交换）
    this.activate(kind, idx, e.button);
    this.showGhost(e.clientX, e.clientY);
  }

  private onPointerMove(e: PointerEvent): void {
    this.updateTooltip(e);
    if (!this.dragging || !this.ghost) return;
    if (this.from && !this.moved && Math.hypot(e.clientX - this.from.x, e.clientY - this.from.y) > 5) {
      this.moved = true;
    }
    this.ghost.style.left = (e.clientX + 10) + 'px';
    this.ghost.style.top = (e.clientY + 10) + 'px';
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    const slot = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    if (slot && this.from) {
      const kind = slot.dataset.slot ?? '';
      const idx = Number(slot.dataset.idx ?? '-1');
      const same = this.from.kind === kind && this.from.idx === idx;
      if (!same) {
        // 拖拽到另一格：目标再处理一次（放下/合并/放1）；同格单击已在 down 处理
        this.activate(kind, idx, this.from.button);
      }
    }
    this.endDrag();
  }

  private activate(kind: string, idx: number, button: number): void {
    if (kind === 'inv') this.callbacks.onInvClick(idx, button);
    else if (kind === 'craft') this.callbacks.onCraftCell(idx, button);
    else if (kind === 'result') this.callbacks.onCraftResult();
    else if (kind === 'fin') this.callbacks.onFurnaceSlot('in', button);
    else if (kind === 'ffuel') this.callbacks.onFurnaceSlot('fuel', button);
    else if (kind === 'fout') this.callbacks.onFurnaceSlot('out', button);
  }

  /** 鼠标悬浮到物品槽位时显示物品名称（原版 tooltip） */
  private updateTooltip(e: PointerEvent): void {
    if (!this.state) { this.hideTooltip(); return; }
    const slot = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    if (!slot) { this.hideTooltip(); return; }
    const kind = slot.dataset.slot ?? '';
    const idx = Number(slot.dataset.idx ?? '-1');
    const st = this.state;
    let stack: ItemStack | null | undefined = null;
    if (kind === 'inv') stack = st.inventory[idx];
    else if (kind === 'craft') stack = st.craftGrid[idx];
    else if (kind === 'result') stack = st.craftResult ? { id: st.craftResult.id, count: st.craftResult.count, durability: 0 } : null;
    else if (kind === 'fin') stack = st.furnace?.input;
    else if (kind === 'ffuel') stack = st.furnace?.fuel;
    else if (kind === 'fout') stack = st.furnace?.output;
    else { this.hideTooltip(); return; }
    if (!stack || stack.id <= 0 || stack.count <= 0) { this.hideTooltip(); return; }
    const info = itemInfo(stack.id);
    const icon = makeItemIcon(stack.id, 20).toDataURL();
    this.tooltip.innerHTML = `<img src="${icon}" alt="" /><span>${escapeHtml(info.name)}</span>`;
    this.tooltip.classList.remove('hidden');
    const x = Math.min(e.clientX + 14, window.innerWidth - 170);
    const y = Math.max(8, e.clientY + 16);
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }

  private hideTooltip(): void {
    this.tooltip.classList.add('hidden');
  }

  private showGhost(x: number, y: number): void {
    const item = this.state?.carried;
    if (!item || item.id <= 0) return;
    if (!this.ghost) {
      this.ghost = document.createElement('div');
      this.ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;width:40px;height:40px;';
      document.body.appendChild(this.ghost);
    }
    const icon = makeItemIcon(item.id, 36).toDataURL();
    const img = document.createElement('img');
    img.src = icon;
    img.style.width = '36px';
    img.style.height = '36px';
    img.style.imageRendering = 'pixelated';
    this.ghost.replaceChildren(img);
    this.ghost.style.display = '';
    this.ghost.style.left = (x + 10) + 'px';
    this.ghost.style.top = (y + 10) + 'px';
  }

  private endDrag(): void {
    this.dragging = false;
    this.moved = false;
    this.from = null;
    if (this.ghost) this.ghost.style.display = 'none';
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
    this.endDrag();
    this.hideTooltip();
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
        const stack = st.craftGrid[i];
        html += `<div class="cg" data-slot="craft" data-idx="${i}">${stack && stack.id > 0 ? slotHTML(stack) : ''}</div>`;
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