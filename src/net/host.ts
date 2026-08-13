import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { DropData, GameMode, NetMessage, PlayerStateMsg, RemotePlayerInfo, VillagerInfo, WelcomeMsg, WireDiff } from './protocol';

export interface WorldInfo {
  seed: number;
  size: number;
  height: number;
  seaLevel: number;
  spawn: [number, number, number];
}

export interface HostProvider {
  getWorldInfo(): WorldInfo;
  getDiffs(): WireDiff[];
  getPlayers(): RemotePlayerInfo[];
  getVillagers(): VillagerInfo[];
  getMode(): GameMode;
  getHostName(): string;
}

export interface HostEvents {
  onGuestJoin(id: string, name: string): void;
  onGuestLeave(id: string): void;
  onBlockSet(x: number, y: number, z: number, id: number, dropItem?: number, dropCount?: number): void;
  onPlayerState(s: PlayerStateMsg): void;
  onChat(name: string, text: string): void;
  onDropPickup(id: string, playerId: string): void;
  onError(msg: string): void;
}

/** 房主：PeerJS 星型拓扑，权威世界状态，负责转发与玩家管理 */
export class Host {
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>();
  private guestNames = new Map<string, string>();
  private opened = false;
  private events: HostEvents;
  private provider: HostProvider;

  constructor(events: HostEvents, provider: HostProvider) {
    this.events = events;
    this.provider = provider;
  }

  getId(): string | null {
    return this.peer?.id ?? null;
  }

  start(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(code, { debug: 1 });
      this.peer = peer;
      const timer = window.setTimeout(() => reject(new Error('连接信令服务器超时，请稍后重试')), 15000);
      peer.on('open', () => {
        window.clearTimeout(timer);
        this.opened = true;
        resolve();
      });
      peer.on('error', (err) => {
        const type = (err as { type?: string }).type;
        if (type === 'unavailable-id') {
          window.clearTimeout(timer);
          reject(new Error('房间码被占用，请换一个'));
        } else if (!this.opened) {
          window.clearTimeout(timer);
          reject(new Error('无法连接信令服务器，请检查网络'));
        } else {
          this.events.onError((err as { message?: string }).message ?? '连接错误');
        }
      });
      peer.on('disconnected', () => {
        if (this.opened) peer.reconnect();
      });
      peer.on('connection', (conn) => this.handleConnection(conn));
    });
  }

  private handleConnection(conn: DataConnection): void {
    conn.on('data', (raw) => {
      const msg = raw as NetMessage;
      if (msg.t === 'hello') {
        const guestId = conn.peer;
        this.conns.set(guestId, conn);
        this.guestNames.set(guestId, msg.name);
        this.send(conn, this.buildWelcome());
        this.events.onGuestJoin(guestId, msg.name);
        this.broadcast({ t: 'join', id: guestId, name: msg.name } satisfies NetMessage);
      } else if (msg.t === 'blockSet') {
        this.events.onBlockSet(msg.x, msg.y, msg.z, msg.id, msg.dropItem, msg.dropCount);
        this.broadcast(msg, conn.peer);
      } else if (msg.t === 'playerState') {
        const s: PlayerStateMsg = { ...msg, id: conn.peer };
        this.events.onPlayerState(s);
        this.broadcast(s, conn.peer);
      } else if (msg.t === 'dropPickup') {
        this.events.onDropPickup(msg.id, conn.peer);
      } else if (msg.t === 'chat') {
        this.events.onChat(msg.name, msg.text);
        this.broadcast({ t: 'chat', id: conn.peer, name: msg.name, text: msg.text } satisfies NetMessage, conn.peer);
      }
    });
    conn.on('close', () => this.removeGuest(conn.peer));
    conn.on('error', () => this.removeGuest(conn.peer));
  }

  private buildWelcome(): WelcomeMsg {
    const info = this.provider.getWorldInfo();
    return {
      t: 'welcome',
      seed: info.seed,
      size: info.size,
      height: info.height,
      seaLevel: info.seaLevel,
      spawn: info.spawn,
      players: this.provider.getPlayers(),
      villagers: this.provider.getVillagers(),
      mode: this.provider.getMode(),
      diffs: this.provider.getDiffs(),
    };
  }

  send(conn: DataConnection, msg: NetMessage): void {
    if (conn.open) conn.send(msg);
  }

  broadcast(msg: NetMessage, except?: string): void {
    for (const [id, conn] of this.conns) {
      if (id !== except && conn.open) conn.send(msg);
    }
  }

  broadcastDropSpawn(drop: DropData): void {
    this.broadcast({ t: 'dropSpawn', drop } satisfies NetMessage);
  }

  broadcastDropRemove(id: string): void {
    this.broadcast({ t: 'dropRemove', id } satisfies NetMessage);
  }

  /** 广播房主自己的状态给所有访客 */
  broadcastHostState(msg: PlayerStateMsg): void {
    msg.id = this.peer?.id ?? 'host';
    for (const [, conn] of this.conns) {
      if (conn.open) conn.send(msg);
    }
  }

  private removeGuest(id: string): void {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    this.guestNames.delete(id);
    this.events.onGuestLeave(id);
    this.broadcast({ t: 'leave', id } satisfies NetMessage);
  }

  destroy(): void {
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    this.peer = null;
    this.conns.clear();
    this.guestNames.clear();
  }
}