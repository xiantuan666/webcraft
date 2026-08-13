import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { PROTOCOL_VERSION, type NetMessage, type PlayerStateMsg, type VillagerInfo, type WelcomeMsg } from './protocol';

export interface ClientEvents {
  onWelcome(w: WelcomeMsg): void;
  onBlockSet(x: number, y: number, z: number, id: number): void;
  onPlayerState(s: PlayerStateMsg): void;
  onVillagerState(list: VillagerInfo[]): void;
  onChat(name: string, text: string): void;
  onPlayerJoin(id: string, name: string): void;
  onPlayerLeave(id: string): void;
  onClose(reason: string): void;
  onError(msg: string): void;
}

/** 访客：连接房主房间码 */
export class Client {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private events: ClientEvents;
  private opened = false;

  constructor(events: ClientEvents) {
    this.events = events;
  }

  getId(): string | null {
    return this.peer?.id ?? null;
  }

  join(code: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 1 });
      this.peer = peer;
      const timer = window.setTimeout(() => reject(new Error('连接超时，请检查房间码')), 20000);
      peer.on('open', () => {
        const conn = peer.connect(code.toUpperCase(), { reliable: true });
        this.conn = conn;
        conn.on('open', () => {
          window.clearTimeout(timer);
          this.opened = true;
          conn.send({ t: 'hello', name, version: PROTOCOL_VERSION } satisfies NetMessage);
          resolve();
        });
        conn.on('data', (raw) => this.handle(raw as NetMessage));
        conn.on('close', () => this.events.onClose('与房主断开连接'));
        conn.on('error', (err) => {
          const type = (err as { type?: string }).type;
          if (type === 'peer-unavailable') {
            window.clearTimeout(timer);
            reject(new Error('未找到该房间，请检查房间码'));
          } else if (!this.opened) {
            window.clearTimeout(timer);
            reject(new Error('连接失败，请稍后重试'));
          } else {
            this.events.onError((err as { message?: string }).message ?? '连接错误');
          }
        });
      });
      peer.on('error', (err) => {
        if (!this.opened) {
          window.clearTimeout(timer);
          reject(new Error('无法连接信令服务器，请检查网络'));
        } else {
          this.events.onError((err as { message?: string }).message ?? '连接错误');
        }
      });
      peer.on('disconnected', () => {
        if (this.opened) peer.reconnect();
      });
    });
  }

  send(msg: NetMessage): void {
    if (this.conn?.open) this.conn.send(msg);
  }

  private handle(msg: NetMessage): void {
    switch (msg.t) {
      case 'welcome': this.events.onWelcome(msg); break;
      case 'blockSet': this.events.onBlockSet(msg.x, msg.y, msg.z, msg.id); break;
      case 'playerState': this.events.onPlayerState(msg); break;
      case 'villagerState': this.events.onVillagerState(msg.list); break;
      case 'chat': this.events.onChat(msg.name, msg.text); break;
      case 'join': this.events.onPlayerJoin(msg.id, msg.name); break;
      case 'leave': this.events.onPlayerLeave(msg.id); break;
      default: break;
    }
  }

  destroy(): void {
    try {
      this.conn?.close();
      this.peer?.destroy();
    } catch {
      // ignore
    }
    this.conn = null;
    this.peer = null;
  }
}