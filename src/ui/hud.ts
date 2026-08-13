import { PALETTE, blockInfo } from '../world/blockIds';
import { makeBlockIcon } from '../render/textures';
import { el } from './dom';

const HOTBAR_SIZE = 9;

/** HUD：准星、热栏、聊天、玩家列表、状态、方块选择器 */
export class Hud {
  private hotbar: number[];
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
    this.hotbar = PALETTE.slice(0, HOTBAR_SIZE);
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
      slot.appendChild(img);
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

  private renderSlots(): void {
    this.slotEls.forEach((slotEl, i) => {
      slotEl.classList.toggle('sel', i === this.selected);
      const icon = slotEl.querySelector('img');
      if (icon) icon.src = makeBlockIcon(this.hotbar[i]).toDataURL();
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
        this.renderSlots();
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