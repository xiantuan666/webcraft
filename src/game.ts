import * as THREE from 'three';
import { World, type BlockDiff } from './world/world';
import { defaultWorldConfig, generateWorld, type WorldConfig } from './world/terrain';
import { generateVillage, type VillageInfo } from './world/village';
import { Block } from './world/blockIds';
import { WorldRenderer } from './render/renderer';
import { PlayerController, EMPTY_INPUT, type InputState } from './player/controls';
import { raycast, intersectsPlayer, REACH } from './player/interact';
import { RemotePlayers } from './player/remotePlayers';
import { Villagers } from './player/villagers';
import { Host, type HostEvents, type HostProvider } from './net/host';
import { Client, type ClientEvents } from './net/client';
import type { ChatMsg, NetMessage, PlayerStateMsg, RemotePlayerInfo, VillagerInfo, WireDiff } from './net/protocol';
import { Menu } from './ui/menu';
import { Hud } from './ui/hud';
import { el } from './ui/dom';
import { hasSave, loadSave, saveWorld, clearSave } from './world/save';

const RENDER_DISTANCE = 8;
const EYE_HEIGHT = 1.62;
const STATE_INTERVAL = 50;
const CLICK_COOLDOWN = 200;

export class Game {
  private mode: 'host' | 'guest' | null = null;
  private world: World | null = null;
  private renderer: WorldRenderer | null = null;
  private controls: PlayerController | null = null;
  private remote = new RemotePlayers();
  private host: Host | null = null;
  private client: Client | null = null;
  private hud: Hud;
  private menu: Menu;
  private app: HTMLElement;
  private input: InputState = { ...EMPTY_INPUT };
  private myName = '';
  private myId = 'me';
  private roomCode = '';
  private players = new Map<string, string>();
  private lastStateSent = 0;
  private lastVillagerSend = 0;
  private village: VillageInfo | null = null;
  private villagers: Villagers | null = null;
  private lastClick = 0;
  private lastSpace = -1;
  private lastTime = 0;
  private saveTimer: number | null = null;
  private starting = false;

  constructor() {
    this.app = el('app');
    this.hud = new Hud();
    this.hud.onChatSubmit = (text) => this.sendChat(text);
    this.menu = new Menu({
      onCreate: (code) => this.startHost(code),
      onJoin: (code) => this.startGuest(code),
    });
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('wheel', (e) => {
      if (this.inGame() && !this.hud.isPickerOpen() && !this.hud.isChatOpen()) this.hud.cycleSlot(Math.sign(e.deltaY));
    }, { passive: true });
    window.addEventListener('beforeunload', () => this.saveNow());
    document.addEventListener('contextmenu', (e) => { if (this.inGame()) e.preventDefault(); });
    requestAnimationFrame(this.loop);
  }

  private inGame(): boolean {
    return this.mode !== null && this.world !== null && this.controls !== null && this.renderer !== null;
  }

  // ---------- 建房 / 加入 ----------

  private startHost(code: string): void {
    if (this.starting) return;
    this.starting = true;
    this.menu.hide();
    this.hud.showLoading();
    window.setTimeout(() => {
      this.doStartHost(code);
      this.starting = false;
    }, 30);
  }

  private doStartHost(code: string): void {
    this.roomCode = code.toUpperCase();
    this.myName = this.menu.getName();
    this.mode = 'host';
    this.myId = 'host';

    let seed = (Math.random() * 0xffffffff) >>> 0;
    let diffs: BlockDiff[] = [];
    if (hasSave(this.roomCode)) {
      const load = window.confirm('检测到该房间的存档，是否载入？\n确定=载入存档，取消=新建世界');
      if (load) {
        const data = loadSave(this.roomCode);
        if (data) {
          seed = data.seed;
          diffs = data.diffs;
        }
      } else {
        clearSave(this.roomCode);
      }
    }

    this.world = new World(defaultWorldConfig(seed));
    generateWorld(this.world, this.world.config);
    this.world.applyDiffs(diffs);
    this.village = generateVillage(this.world, this.world.config);
    this.initWorldVisuals();

    const provider: HostProvider = {
      getWorldInfo: () => this.worldInfo(),
      getDiffs: () => this.worldDiffs(),
      getPlayers: () => this.playerList(),
      getVillagers: () => this.villagers?.snapshot() ?? [],
      getHostName: () => this.myName,
    };
    const events: HostEvents = {
      onGuestJoin: (id, name) => this.onPlayerJoin(id, name),
      onGuestLeave: (id) => this.onPlayerLeave(id),
      onBlockSet: (x, y, z, id) => this.applyBlock(x, y, z, id),
      onPlayerState: (s) => this.remote.updateState(s),
      onChat: (name, text) => this.addChatLine(name, text),
      onError: (msg) => this.hud.toast(msg),
    };
    this.host = new Host(events, provider);
    this.hud.setStatus('正在连接信令服务器…');
    this.host.start(this.roomCode).then(() => {
      const hostId = this.host?.getId() ?? 'host';
      this.myId = hostId;
      this.players.set(hostId, this.myName);
      this.refreshPlayers();
    }).catch((err: unknown) => {
      this.showError(err instanceof Error ? err.message : String(err));
    });
  }

  private startGuest(code: string): void {
    if (this.starting) return;
    this.starting = true;
    this.menu.hide();
    this.hud.showLoading();
    this.roomCode = code.toUpperCase();
    this.myName = this.menu.getName();
    this.mode = 'guest';
    this.myId = 'guest';
    this.hud.setStatus('正在连接房间 ' + this.roomCode + ' …');

    const events: ClientEvents = {
      onWelcome: (w) => this.onWelcome(w),
      onBlockSet: (x, y, z, id) => this.applyRemoteBlock(x, y, z, id),
      onPlayerState: (s) => this.remote.updateState(s),
      onVillagerState: (list) => this.villagers?.applyRemote(list),
      onChat: (name, text) => this.addChatLine(name, text),
      onPlayerJoin: (id, name) => this.onPlayerJoin(id, name),
      onPlayerLeave: (id) => this.onPlayerLeave(id),
      onClose: (reason) => this.showError(reason),
      onError: (msg) => this.hud.toast(msg),
    };
    this.client = new Client(events);
    this.client.join(this.roomCode, this.myName).then(() => {
      this.myId = this.client?.getId() ?? 'guest';
      this.players.set(this.myId, this.myName);
      this.refreshPlayers();
    }).catch((err: unknown) => {
      this.showError(err instanceof Error ? err.message : String(err));
    });
  }

  private onWelcome(w: { seed: number; size: number; height: number; seaLevel: number; spawn: [number, number, number]; players: RemotePlayerInfo[]; villagers: VillagerInfo[]; diffs: WireDiff[] }): void {
    const config: WorldConfig = { seed: w.seed, size: w.size, height: w.height, seaLevel: w.seaLevel };
    this.world = new World(config);
    generateWorld(this.world, this.world.config);
    this.world.applyDiffs(w.diffs.map((d) => ({ x: d[0], y: d[1], z: d[2], id: d[3] })));
    this.village = generateVillage(this.world, config);
    this.players = new Map(w.players.map((p) => [p.id, p.name]));
    this.players.set(this.myId, this.myName);
    this.initWorldVisuals(w.spawn);
    this.villagers?.initRemote(w.villagers);
  }

  private initWorldVisuals(spawnOverride?: [number, number, number]): void {
    const world = this.world!;
    this.app.replaceChildren();
    this.renderer = new WorldRenderer(this.app);
    this.renderer.addToScene(this.remote.group);
    this.villagers = new Villagers(world, this.mode === 'host');
    this.renderer.addToScene(this.villagers.group);
    if (this.mode === 'host' && this.village) {
      this.villagers.initSpawns(this.village.spawns, this.village.centerX, this.village.centerZ);
    }
    this.controls = new PlayerController(world);
    this.controls.setPointerLockElement(this.renderer.renderer.domElement);

    let sx = world.config.size / 2;
    let sz = world.config.size / 2;
    let sy = world.getSurfaceHeight(sx, sz) + 2;
    if (spawnOverride) {
      sx = spawnOverride[0];
      sy = spawnOverride[1];
      sz = spawnOverride[2];
    } else if (sy < world.config.seaLevel + 1) {
      sy = world.config.seaLevel + 1;
    }
    this.controls.spawnAt(sx, sy, sz);
    this.hud.show();
    this.refreshPlayers();
    this.hud.setStatus(this.mode === 'host' ? `房主 · 房间 ${this.roomCode} · 在线 ${this.players.size}` : `已连接 · 房间 ${this.roomCode} · 在线 ${this.players.size}`);
  }

  // ---------- 世界信息提供 ----------

  private worldInfo() {
    const w = this.world!;
    const c = w.config;
    const sx = c.size / 2;
    let sy = w.getSurfaceHeight(sx, sx) + 2;
    if (sy < c.seaLevel + 1) sy = c.seaLevel + 1;
    return { seed: c.seed, size: c.size, height: c.height, seaLevel: c.seaLevel, spawn: [sx, sy, sx] as [number, number, number] };
  }

  private worldDiffs(): WireDiff[] {
    return this.world!.getDiffList().map((d) => [d.x, d.y, d.z, d.id]);
  }

  private playerList(): RemotePlayerInfo[] {
    return [...this.players.entries()].map(([id, name]) => ({ id, name }));
  }

  // ---------- 方块修改 ----------

  private applyBlock(x: number, y: number, z: number, id: number): void {
    // 房主收到访客的修改：写入世界（记录 diff）+ 重建网格
    if (!this.world || !this.renderer) return;
    if (this.world.setBlock(x, y, z, id)) {
      this.renderer.rebuildAround(this.world, x, z);
      this.scheduleSave();
    }
  }

  private applyRemoteBlock(x: number, y: number, z: number, id: number): void {
    // 访客收到房主转发的修改：只写世界，不记录 diff
    if (!this.world || !this.renderer) return;
    if (this.world.getBlock(x, y, z) !== id) {
      this.world.setBlockDirect(x, y, z, id);
      this.renderer.rebuildAround(this.world, x, z);
    }
  }

  private localBlockAction(x: number, y: number, z: number, id: number): void {
    if (!this.world || !this.renderer) return;
    if (!this.world.setBlock(x, y, z, id)) return;
    this.renderer.rebuildAround(this.world, x, z);
    if (this.mode === 'host') {
      this.host?.broadcast({ t: 'blockSet', x, y, z, id } satisfies NetMessage);
      this.scheduleSave();
    } else {
      this.client?.send({ t: 'blockSet', x, y, z, id } satisfies NetMessage);
    }
  }

  // ---------- 聊天 / 玩家 ----------

  private sendChat(text: string): void {
    const t = text.trim();
    if (!t) return;
    this.addChatLine(this.myName, t);
    const msg: ChatMsg = { t: 'chat', id: this.myId, name: this.myName, text: t };
    if (this.mode === 'host') this.host?.broadcast(msg);
    else this.client?.send(msg);
  }

  private addChatLine(name: string, text: string): void {
    this.hud.addChatLine(name, text);
  }

  private onPlayerJoin(id: string, name: string): void {
    this.players.set(id, name);
    this.refreshPlayers();
    this.hud.toast(`${name} 加入了房间`);
  }

  private onPlayerLeave(id: string): void {
    const name = this.players.get(id);
    this.players.delete(id);
    this.remote.remove(id);
    this.refreshPlayers();
    if (name) this.hud.toast(`${name} 离开了房间`);
  }

  private refreshPlayers(): void {
    this.hud.setPlayers([...this.players.values()]);
    if (this.mode) {
      const role = this.mode === 'host' ? '房主' : '已连接';
      this.hud.setStatus(`${role} · 房间 ${this.roomCode} · 在线 ${this.players.size}`);
    }
  }

  // ---------- 输入 ----------

  private onKeyDown(e: KeyboardEvent): void {
    if (this.hud.isChatOpen()) return; // 聊天输入框内由 input 处理
    if (this.hud.isPickerOpen()) {
      if (e.key === 'Escape') this.hud.closePicker();
      return;
    }
    if (!this.inGame()) return;
    switch (e.code) {
      case 'KeyW': this.input.forward = true; break;
      case 'KeyS': this.input.back = true; break;
      case 'KeyA': this.input.left = true; break;
      case 'KeyD': this.input.right = true; break;
      case 'Space':
        this.input.up = true;
        if (!e.repeat) {
          const now = performance.now();
          if (now - this.lastSpace < 300) {
            this.controls?.toggleFlying();
            this.lastSpace = -1;
          } else {
            this.lastSpace = now;
          }
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight': this.input.down = true; break;
      case 'Enter': this.hud.openChat(); break;
      case 'KeyE':
        if (!this.hud.isPickerOpen()) document.exitPointerLock();
        this.hud.togglePicker();
        break;
      case 'Tab':
        e.preventDefault();
        this.hud.setPlayersVisible(true);
        break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
      case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
        this.hud.selectSlot(Number(e.code.slice(5)) - 1);
        break;
      default: break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (this.hud.isChatOpen()) return;
    switch (e.code) {
      case 'KeyW': this.input.forward = false; break;
      case 'KeyS': this.input.back = false; break;
      case 'KeyA': this.input.left = false; break;
      case 'KeyD': this.input.right = false; break;
      case 'Space': this.input.up = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': this.input.down = false; break;
      case 'Tab': this.hud.setPlayersVisible(false); break;
      default: break;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.inGame() || this.hud.isChatOpen() || this.hud.isPickerOpen()) return;
    const controls = this.controls!;
    if (!controls.isPointerLocked()) {
      controls.requestLock();
      return;
    }
    const now = performance.now();
    if (now - this.lastClick < CLICK_COOLDOWN) return;
    this.lastClick = now;

    const camera = this.renderer!.camera;
    const origin = camera.position;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hit = raycast(this.world!, origin, dir, REACH);
    if (!hit) return;
    if (e.button === 0) {
      this.localBlockAction(hit.x, hit.y, hit.z, Block.Air);
    } else if (e.button === 2) {
      const p = controls.position;
      if (intersectsPlayer(p.x, p.y, p.z, hit.prevX, hit.prevY, hit.prevZ)) return;
      this.localBlockAction(hit.prevX, hit.prevY, hit.prevZ, this.hud.currentBlock());
    }
  }

  // ---------- 主循环 ----------

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    if (!this.inGame()) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    const world = this.world!;
    const renderer = this.renderer!;
    const controls = this.controls!;

    if (!this.hud.isChatOpen() && !this.hud.isPickerOpen()) {
      controls.update(dt, this.input);
    }
    const cam = renderer.camera;
    cam.position.set(controls.position.x, controls.position.y + EYE_HEIGHT, controls.position.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = controls.yaw;
    cam.rotation.x = controls.pitch;

    renderer.updateChunks(world, controls.position, RENDER_DISTANCE);

    if (now - this.lastStateSent >= STATE_INTERVAL) {
      this.lastStateSent = now;
      this.sendState();
    }
    this.remote.update(dt);
    this.villagers?.update(dt);
    if (this.mode === 'host' && now - this.lastVillagerSend >= 200) {
      this.lastVillagerSend = now;
      const list = this.villagers?.snapshot();
      if (list && list.length) this.host?.broadcast({ t: 'villagerState', list } satisfies NetMessage);
    }
    renderer.render();
  };

  private sendState(): void {
    if (!this.controls) return;
    const p = this.controls.position;
    const msg: PlayerStateMsg = {
      t: 'playerState', id: this.myId, name: this.myName,
      x: p.x, y: p.y, z: p.z, yaw: this.controls.yaw, pitch: this.controls.pitch,
    };
    if (this.mode === 'host') this.host?.broadcastHostState(msg);
    else this.client?.send(msg);
  }

  // ---------- 存档 ----------

  private scheduleSave(): void {
    if (this.mode !== 'host' || !this.world) return;
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 5000);
  }

  private saveNow(): void {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.mode !== 'host' || !this.world) return;
    const ok = saveWorld(this.roomCode, this.world.config.seed, this.world.getDiffList());
    if (!ok) this.hud.toast('存档空间不足，已停止自动保存');
  }

  // ---------- 离开 / 错误 ----------

  private showError(msg: string): void {
    this.hud.toast(msg);
    this.leave();
  }

  private leave(): void {
    this.saveNow();
    this.host?.destroy();
    this.client?.destroy();
    this.host = null;
    this.client = null;
    this.remote.clear();
    this.villagers?.dispose();
    this.villagers = null;
    this.village = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.controls = null;
    this.world = null;
    this.players.clear();
    this.mode = null;
    this.app.replaceChildren();
    this.hud.hide();
    this.menu.show();
  }
}