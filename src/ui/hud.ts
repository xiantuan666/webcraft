import { PALETTE, blockInfo } from '../world/blockIds';
import { makeBlockIcon } from '../render/textures';
import { makeItemIcon } from '../render/itemTextures';
import type { ItemStack } from '../survival/inventory';
import { itemInfo } from '../survival/items';
import { el } from './dom';

const HOTBAR_SIZE = 9;

/** HUD：准星、热栏（物品/方块）、生命/饥饿、聊天、玩家列表、状态、创造方块选择器 */
export class Hud {
  private hotbar: number[] = PALETTE.slice(0, HOTBAR_SIZE);
  private slotEls: HTMLElement[] = [];
  private selected = 0;
  private chatLog: HTMLElement;
  private chatInput: HTMLInputElement;
  private chatWrap: HTMLElement;
  private playersBox: HTMLElement;
  private picker: HTMLElement;
  private pickerOpen = false;
  onChatSubmit: ((text: string) => void) | null = null;

  constructor() {
    this.chatLog = el('chat-log');
    this.chatInput = el<HTMLInputElement>('chat-input');
    this.chatWrap = el('chat-input-wrap');
    this.playersBox = el('players-list');
    this.picker = el('picker');

    const bar = el('hotbar');
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const img = document.createElement('img');
      img.alt = '';
      const count = document.createElement('span');
      count.className = 'count';
      const dur = document.createElement('div');
      dur.className = 'dur';
      slot.appendChild(img);
      slot.appendChild(count);
      slot.appendChild(dur);
      slot.addEventListener('click', () => this.selectSlot(i));
      bar.appendChild(slot);
      this.slotEls.push(slot);
    }
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = this.chatInput.value;
        this.chatInput.value = '';
        this.closeChat();
        if (text.trim() && this.onChatSubmit) this.onChatSubmit(text);
      } else if (e.key === 'Escape') {
        this.closeChat();
      }
    });
    this.renderSlots();
  }

  currentBlock(): number {
    return this.hotbar[this.selected];
  }

  selectSlot(i: number): void {
    this.selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.renderSlots();
  }

  cycleSlot(dir: number): void {
    this.selectSlot(this.selected + (dir > 0 ? 1 : -1));
  }

  getSelected(): number {
    return this.selected;
  }

  /** 生存模式：用物品栈渲染热栏 */
  setHotbarStacks(stacks: ItemStack[]): void {
    this.slotEls.forEach((slotEl, i) => {
      slotEl.classList.toggle('sel', i === this.selected);
      const img = slotEl.querySelector('img') as HTMLImageElement;
      const count = slotEl.querySelector('.count') as HTMLElement;
      const dur = slotEl.querySelector('.dur') as HTMLElement;
      const s = stacks[i];
      if (s && s.id > 0 && s.count > 0) {
        img.src = makeItemIcon(s.id).toDataURL();
        img.style.display = '';
        count.textContent = s.count > 1 ? String(s.count) : '';
        const maxDur = itemInfo(s.id).tool?.durability ?? 0;
        if (maxDur > 0) {
          dur.style.display = '';
          dur.style.width = ((s.durability / maxDur) * 100).toFixed(0) + '%';
        } else {
          dur.style.display = 'none';
        }
      } else {
        img.style.display = 'none';
        count.textContent = '';
        dur.style.display = 'none';
      }
    });
  }

  /** 创造模式：方块图标热栏 */
  setHotbarBlocks(): void {
    this.slotEls.forEach((slotEl, i) => {
      slotEl.classList.toggle('sel', i === this.selected);
      const img = slotEl.querySelector('img') as HTMLImageElement;
      const count = slotEl.querySelector('.count') as HTMLElement;
      const dur = slotEl.querySelector('.dur') as HTMLElement;
      img.src = makeBlockIcon(this.hotbar[i]).toDataURL();
      img.style.display = '';
      count.textContent = '';
      dur.style.display = 'none';
    });
  }

  /** 生命/饥饿/氧气条 */
  setBars(health: number, hunger: number, breath = 10): void {
    const h = Math.max(0, Math.min(20, Math.round(health)));
    const g = Math.max(0, Math.min(20, Math.round(hunger)));
    el('hearts').textContent = '❤'.repeat(Math.ceil(h / 2));
    el('hearts-empty').textContent = '🖤'.repeat(10 - Math.ceil(h / 2));
    el('hunger').textContent = '🍗'.repeat(Math.ceil(g / 2));
    el('hunger-empty').textContent = '🖤'.repeat(10 - Math.ceil(g / 2));
    const b = Math.max(0, Math.min(10, breath));
    const breathEl = el('breath');
    if (b < 10) {
      breathEl.textContent = '🫧'.repeat(Math.max(0, Math.ceil(b)));
      breathEl.style.display = '';
    } else {
      breathEl.style.display = 'none';
    }
  }

  private renderSlots(): void {
    this.slotEls.forEach((slotEl, i) => {
      slotEl.classList.toggle('sel', i === this.selected);
    });
  }

  show(): void {
    el('hud').classList.remove('hidden');
    el('loading').classList.add('hidden');
  }

  hide(): void {
    el('hud').classList.add('hidden');
    this.closeChat();
    this.closePicker();
    this.setPlayersVisible(false);
  }

  setStatus(text: string): void {
    el('status').textContent = text;
  }

  showLoading(): void {
    el('loading').classList.remove('hidden');
  }

  addChatLine(name: string, text: string): void {
    const line = document.createElement('div');
    line.className = 'line';
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = name + '：';
    line.appendChild(who);
    line.appendChild(document.createTextNode(text));
    this.chatLog.appendChild(line);
    while (this.chatLog.children.length > 50) this.chatLog.removeChild(this.chatLog.firstChild!);
  }

  openChat(): void {
    this.chatWrap.classList.remove('hidden');
    this.chatInput.focus();
  }

  closeChat(): void {
    this.chatWrap.classList.add('hidden');
  }

  isChatOpen(): boolean {
    return !this.chatWrap.classList.contains('hidden');
  }

  setPlayers(names: string[]): void {
    this.playersBox.innerHTML = '<h4>在线玩家 (' + names.length + ')</h4>' +
      names.map((n) => `<div class="p">${escapeHtml(n)}</div>`).join('');
  }

  setPlayersVisible(visible: boolean): void {
    this.playersBox.classList.toggle('hidden', !visible);
  }

  togglePicker(): void {
    if (this.pickerOpen) this.closePicker();
    else this.openPicker();
  }

  private openPicker(): void {
    this.pickerOpen = true;
    this.picker.classList.remove('hidden');
    this.picker.innerHTML = '<h4>选择方块（点击替换当前热栏位）</h4><div class="grid"></div>';
    const grid = this.picker.querySelector('.grid') as HTMLElement;
    for (const id of PALETTE) {
      const item = document.createElement('div');
      item.className = 'item';
      item.title = blockInfo(id).name;
      const img = document.createElement('img');
      img.src = makeBlockIcon(id).toDataURL();
      img.alt = blockInfo(id).name;
      item.appendChild(img);
      item.addEventListener('click', () => {
        this.hotbar[this.selected] = id;
        this.setHotbarBlocks();
        this.closePicker();
      });
      grid.appendChild(item);
    }
  }

  closePicker(): void {
    this.pickerOpen = false;
    this.picker.classList.add('hidden');
  }

  isPickerOpen(): boolean {
    return this.pickerOpen;
  }

  toast(msg: string): void {
    const t = el('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    window.setTimeout(() => t.classList.add('hidden'), 3000);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}