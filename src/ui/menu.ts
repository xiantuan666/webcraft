import { el } from './dom';
import { makeRoomCode } from '../net/peer';
import { loadUserName, saveUserName } from '../world/save';

export interface MenuCallbacks {
  onCreate(code: string): void;
  onJoin(code: string): void;
}

/** 主菜单：昵称、建房（房间码）、加入 */
export class Menu {
  private nameInput: HTMLInputElement;
  private codeInput: HTMLInputElement;
  private joinInput: HTMLInputElement;
  private root: HTMLElement;
  private currentCode = '';
  private callbacks: MenuCallbacks;

  constructor(callbacks: MenuCallbacks) {
    this.callbacks = callbacks;
    this.root = el('menu');
    this.nameInput = el<HTMLInputElement>('name-input');
    this.codeInput = el<HTMLInputElement>('room-code');
    this.joinInput = el<HTMLInputElement>('join-code');
    this.nameInput.value = loadUserName() || '玩家' + Math.floor(Math.random() * 900 + 100);
    this.regenerateCode();

    el('btn-regen').addEventListener('click', () => this.regenerateCode());
    el('btn-create').addEventListener('click', () => {
      const name = this.nameInput.value.trim();
      if (!name) this.nameInput.value = '玩家' + Math.floor(Math.random() * 900 + 100);
      saveUserName(this.nameInput.value.trim());
      this.callbacks.onCreate(this.currentCode);
    });
    el('btn-join').addEventListener('click', () => {
      const code = this.joinInput.value.trim().toUpperCase();
      if (!code) return;
      const name = this.nameInput.value.trim();
      if (!name) this.nameInput.value = '玩家' + Math.floor(Math.random() * 900 + 100);
      saveUserName(this.nameInput.value.trim());
      this.callbacks.onJoin(code);
    });
    this.joinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (el('btn-join') as HTMLButtonElement).click();
    });
  }

  regenerateCode(): void {
    this.currentCode = makeRoomCode();
    this.codeInput.value = this.currentCode;
  }

  getName(): string {
    return this.nameInput.value.trim() || '玩家';
  }

  getCode(): string {
    return this.currentCode;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}