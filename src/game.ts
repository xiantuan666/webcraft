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
import type { ChatMsg, GameMode, NetMessage, PlayerStateMsg, RemotePlayerInfo, VillagerInfo, WireDiff } from './net/protocol';
import { Menu } from './ui/menu';
import { Hud } from './ui/hud';
import { SurvivalUI, type UIState, type UIScreen } from './ui/survivalUI';
import { el } from './ui/dom';
import { hasSave, loadSave, saveWorld, clearSave } from './world/save';
import { Inventory, emptyStack, type ItemStack } from './survival/inventory';
import { isBlockItem, isTool } from './survival/items';
import { blockProps, effectiveSpeed, miningTime } from './survival/blockProps';
import { matchRecipe } from './survival/crafting';
import { Furnace, isFuel, smeltRecipeFor } from './survival/smelting';
import { PlayerState } from './survival/playerState';
import { Drops } from './survival/drops';
import { blockColor } from './render/textures';
import { getCrackTexture } from './render/crack';
import { Particles } from './render/particles';

const RENDER_DISTANCE = 8;
const EYE_HEIGHT = 1.62;
const STATE_INTERVAL = 50;
const CLICK_COOLDOWN = 200;

export class Game {
  private mode: 'host' | 'guest' | null = null;
  private gameMode: GameMode = 'survival';
  private world: World | null = null;
  private renderer: WorldRenderer | null = null;
  private controls: PlayerController | null = null;
  private remote = new RemotePlayers();
  private host: Host | null = null;
  private client: Client | null = null;
  private hud: Hud;
  private menu: Menu;
  private survivalUI: SurvivalUI;
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

  // 生存模式
  private inventory = new Inventory();
  private playerState = new PlayerState();
  private drops = new Drops();
  private particles = new Particles();
  private furnaces = new Map<string, Furnace>();
  private carried: ItemStack = emptyStack();
  private openScreen: UIScreen | null = null;
  private openFurnaceKey: string | null = null;
  private craftGrid: number[] = Array(9).fill(0);
  private craftW = 2;
  private craftH = 2;
  private mining: { x: number; y: number; z: number; progress: number } | null = null;
  private miningHeld = false;
  private crackMesh: THREE.Mesh | null = null;
  private crackMat: THREE.MeshBasicMaterial | null = null;
  private lastBarsUpdate = 0;

  constructor() {
    this.app = el('app');
    this.hud = new Hud();
    this.hud.onChatSubmit = (text) => this.sendChat(text);
    this.survivalUI = new SurvivalUI({
      onInvClick: (i) => this.onInvClick(i),
      onCraftCell: (i) => this.onCraftCell(i),
      onCraftResult: () => this.onCraftTake(),
      onFurnaceSlot: (which) => this.onFurnaceSlot(which),
      onClose: () => this.closeScreen(),
    });
    this.menu = new Menu({
      onCreate: (code) => this.startHost(code),
      onJoin: (code) => this.startGuest(code),
    });
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.miningHeld = false;
    });
    document.addEventListener('wheel', (e) => {
      if (this.inGame() && !this.hud.isPickerOpen() && !this.hud.isChatOpen() && !this.survivalUI.isOpen()) this.hud.cycleSlot(Math.sign(e.deltaY));
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
    let extra: { mode?: GameMode; inventory?: ItemStack[]; furnaces?: { key: string; data: unknown }[] } | null = null;
    if (hasSave(this.roomCode)) {
      const load = window.confirm('检测到该房间的存档，是否载入？\n确定=载入存档，取消=新建世界');
      if (load) {
        const data = loadSave(this.roomCode);
        if (data) {
          seed = data.seed;
          diffs = data.diffs;
          extra = data.extra;
        }
      } else {
        clearSave(this.roomCode);
      }
    }

    this.world = new World(defaultWorldConfig(seed));
    generateWorld(this.world, this.world.config);
    this.world.applyDiffs(diffs);
    this.village = generateVillage(this.world, this.world.config);
    if (extra?.mode) this.gameMode = extra.mode;
    this.initWorldVisuals();
    if (extra?.inventory) this.inventory.deserialize(extra.inventory);
    if (extra?.furnaces) {
      for (const f of extra.furnaces) this.furnaces.set(f.key, Furnace.deserialize(f.data));
    }
    this.refreshHotbar();
    const provider: HostProvider = {
      getWorldInfo: () => this.worldInfo(),
      getDiffs: () => this.worldDiffs(),
      getPlayers: () => this.playerList(),
      getVillagers: () => this.villagers?.snapshot() ?? [],
      getMode: () => this.gameMode,
      getHostName: () => this.myName,
    };
    const events: HostEvents = {
      onGuestJoin: (id, name) => this.onPlayerJoin(id, name),
      onGuestLeave: (id) => this.onPlayerLeave(id),
      onBlockSet: (x, y, z, id, dropItem, dropCount) => this.applyBlock(x, y, z, id, dropItem, dropCount),
      onPlayerState: (s) => this.remote.updateState(s),
      onChat: (name, text) => this.addChatLine(name, text),
      onDropPickup: (id) => this.onRemoteDropPickup(id),
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
      onMode: (m) => { this.gameMode = m; this.refreshHotbar(); },
      onBlockSet: (x, y, z, id) => this.applyRemoteBlock(x, y, z, id),
      onPlayerState: (s) => this.remote.updateState(s),
      onVillagerState: (list) => this.villagers?.applyRemote(list),
      onDropSpawn: (drop) => this.drops.applySpawn(drop),
      onDropRemove: (id) => this.drops.applyRemove(id),
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
    this.renderer.addToScene(this.drops.group);
    this.renderer.addToScene(this.particles.group);
    this.drops.onPickupRequest = (id) => this.onDropPickup(id);
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
    this.villagers = new Villagers(world, this.mode === 'host');
    this.renderer.addToScene(this.villagers.group);
    if (this.mode === 'host' && this.village) {
      this.villagers.initSpawns(this.village.spawns, this.village.centerX, this.village.centerZ);
    }
    this.hud.show();
    this.refreshPlayers();
    this.refreshHotbar();
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

  private applyBlock(x: number, y: number, z: number, id: number, dropItem = 0, dropCount = 0): void {
    if (!this.world || !this.renderer) return;
    if (this.world.setBlock(x, y, z, id)) {
      this.renderer.rebuildAround(this.world, x, z);
      if (this.gameMode === 'survival' && id === Block.Air && dropItem > 0) {
        this.spawnDropWorld(x, y, z, dropItem, dropCount);
      }
      this.scheduleSave();
    }
  }

  private applyRemoteBlock(x: number, y: number, z: number, id: number): void {
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

  private spawnDropWorld(x: number, y: number, z: number, item: number, count: number): void {
    if (!this.host) return;
    const drop = this.drops.spawn(item, count, x, y, z);
    this.host.broadcastDropSpawn(drop);
  }

  private onDropPickup(id: string): void {
    const data = this.drops.getData(id);
    if (!data) return;
    this.inventory.addItem(data.item, data.count);
    this.refreshHotbar();
    if (this.mode === 'host') {
      this.drops.remove(id);
      this.host?.broadcastDropRemove(id);
    } else {
      this.client?.send({ t: 'dropPickup', id, playerId: this.myId } satisfies NetMessage);
    }
  }

  private onRemoteDropPickup(id: string): void {
    this.drops.remove(id);
    this.host?.broadcastDropRemove(id);
  }
  // ---------- 生存：挖掘 / 放置 ----------

  private selectedSlot(): number {
    return this.hud.getSelected();
  }

  private refreshHotbar(): void {
    if (this.gameMode === 'creative') this.hud.setHotbarBlocks();
    else this.hud.setHotbarStacks(this.inventory.slots.slice(0, 9));
  }

  private showCrack(bx: number, by: number, bz: number, stage: number): void {
    if (!this.crackMat) {
      this.crackMat = new THREE.MeshBasicMaterial({ map: getCrackTexture(stage), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
      this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), this.crackMat);
      this.renderer?.addToScene(this.crackMesh);
    }
    this.crackMat.map = getCrackTexture(stage);
    this.crackMat.needsUpdate = true;
    this.crackMesh!.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    this.crackMesh!.visible = true;
  }

  private hideCrack(): void {
    if (this.crackMesh) this.crackMesh.visible = false;
  }

  /** 连续挖掘：按住左键期间每帧射线检测，挖完自动挖下一个 */
  private updateMining(dt: number): void {
    if (!this.inGame() || this.gameMode !== 'survival') {
      this.mining = null;
      this.hideCrack();
      return;
    }
    if (this.survivalUI.isOpen() || !this.miningHeld) {
      this.mining = null;
      this.hideCrack();
      return;
    }
    const camera = this.renderer!.camera;
    const origin = camera.position;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hit = raycast(this.world!, origin, dir, REACH);
    if (!hit) {
      this.mining = null;
      this.hideCrack();
      return;
    }
    const bx = hit.x;
    const by = hit.y;
    const bz = hit.z;
    if (!this.mining || this.mining.x !== bx || this.mining.y !== by || this.mining.z !== bz) {
      this.mining = { x: bx, y: by, z: bz, progress: 0 };
    }
    const blockId = this.world!.getBlock(bx, by, bz);
    const held = this.inventory.get(this.selectedSlot()).id;
    const time = miningTime(held, blockId);
    if (!isFinite(time)) {
      this.mining = null;
      this.hideCrack();
      return;
    }
    this.mining.progress += dt / time;
    if (Math.random() < dt * 25) {
      this.particles.spawn(bx + 0.5, by + 0.5, bz + 0.5, blockColor(blockId), 1, 1.5);
    }
    this.showCrack(bx, by, bz, Math.floor(this.mining.progress * 10));
    if (this.mining.progress >= 1) {
      this.mining = null;
      this.hideCrack();
      this.breakBlock(bx, by, bz, blockId, held);
    }
  }

  private breakBlock(bx: number, by: number, bz: number, blockId: number, heldItem: number): void {
    const world = this.world!;
    const props = blockProps(blockId);
    const { canDrop } = effectiveSpeed(heldItem, blockId);
    let dropItem = 0;
    let dropCount = 0;
    if (canDrop && props.drops) {
      const [a, b] = props.drops.count;
      dropItem = props.drops.item;
      dropCount = a + Math.floor(Math.random() * (b - a + 1));
    }
    if (isTool(heldItem) && isFinite(props.hardness)) {
      this.inventory.damageHeld(this.selectedSlot(), 1);
      this.refreshHotbar();
    }
    if (!world.setBlock(bx, by, bz, Block.Air)) return;
    this.renderer!.rebuildAround(world, bx, bz);
    this.particles.spawn(bx + 0.5, by + 0.5, bz + 0.5, blockColor(blockId), 10, 3);
    if (this.mode === 'host') {
      if (dropItem > 0) this.spawnDropWorld(bx, by, bz, dropItem, dropCount);
      this.host?.broadcast({ t: 'blockSet', x: bx, y: by, z: bz, id: Block.Air } satisfies NetMessage);
      this.scheduleSave();
    } else {
      this.client?.send({ t: 'blockSet', x: bx, y: by, z: bz, id: Block.Air, dropItem, dropCount } satisfies NetMessage);
    }
  }

  private tryPlace(px: number, py: number, pz: number, cellX: number, cellY: number, cellZ: number): void {
    if (intersectsPlayer(px, py, pz, cellX, cellY, cellZ)) return;
    if (this.gameMode === 'creative') {
      this.localBlockAction(cellX, cellY, cellZ, this.hud.currentBlock());
      return;
    }
    const slot = this.selectedSlot();
    const stack = this.inventory.get(slot);
    if (!isBlockItem(stack.id) || stack.count <= 0) return;
    const cur = this.world!.getBlock(cellX, cellY, cellZ);
    if (cur !== Block.Air && cur !== Block.Water) return;
    if (!this.inventory.removeSlot(slot, 1)) return;
    this.refreshHotbar();
    this.localBlockAction(cellX, cellY, cellZ, stack.id);
  }

  // ---------- 生存：界面（背包/合成/熔炉） ----------

  private showScreen(screen: UIScreen): void {
    this.craftW = screen === 'crafting' ? 3 : 2;
    this.craftH = screen === 'crafting' ? 3 : 2;
    this.craftGrid.fill(0);
    this.openScreen = screen;
    if (document.pointerLockElement) document.exitPointerLock();
    this.survivalUI.open(this.uiState());
  }

  private openCrafting(): void {
    this.openFurnaceKey = null;
    this.showScreen('crafting');
  }

  private openFurnaceAt(bx: number, by: number, bz: number): void {
    const key = bx + ',' + by + ',' + bz;
    if (!this.furnaces.has(key)) this.furnaces.set(key, new Furnace());
    this.openFurnaceKey = key;
    this.showScreen('furnace');
  }

  private closeScreen(): void {
    if (this.carried.id !== 0) {
      const left = this.inventory.addItem(this.carried.id, this.carried.count, this.carried.durability);
      this.carried = left > 0 ? { ...this.carried, count: left } : emptyStack();
      this.refreshHotbar();
    }
    this.openScreen = null;
    this.openFurnaceKey = null;
    this.survivalUI.close();
  }

  private currentCraftResult(): { id: number; count: number } | null {
    const grid: number[][] = [];
    for (let y = 0; y < this.craftH; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.craftW; x++) row.push(this.craftGrid[y * this.craftW + x] ?? 0);
      grid.push(row);
    }
    const r = matchRecipe(grid, this.craftW, this.craftH);
    return r ? { id: r.result, count: r.resultCount } : null;
  }

  private uiState(): UIState {
    const st: UIState = {
      screen: this.openScreen ?? 'inventory',
      title: this.openScreen === 'crafting' ? '工作台' : this.openScreen === 'furnace' ? '熔炉' : '背包',
      craftW: this.craftW,
      craftH: this.craftH,
      craftGrid: [...this.craftGrid],
      craftResult: this.currentCraftResult(),
      inventory: this.inventory.slots,
      carried: this.carried,
      furnace: null,
    };
    if (this.openScreen === 'furnace' && this.openFurnaceKey) {
      const f = this.furnaces.get(this.openFurnaceKey);
      if (f) {
        st.furnace = {
          input: { id: f.inputId, count: f.inputCount, durability: 0 },
          fuel: { id: f.fuelId, count: f.fuelCount, durability: 0 },
          output: { id: f.outputId, count: f.outputCount, durability: 0 },
          progress: f.progress,
          lit: f.isLit(),
        };
      }
    }
    return st;
  }

  private refreshUI(): void {
    this.survivalUI.refresh();
  }

  private onInvClick(i: number): void {
    const s = this.inventory.get(i);
    if (this.carried.id === 0) {
      if (s.id === 0) return;
      this.carried = { ...s };
      this.inventory.set(i, emptyStack());
    } else if (s.id === 0) {
      this.inventory.set(i, { ...this.carried });
      this.carried = emptyStack();
    } else if (s.id === this.carried.id && s.durability === this.carried.durability) {
      const max = this.inventory.stackMax(s.id);
      const space = max - s.count;
      if (space > 0) {
        const move = Math.min(space, this.carried.count);
        s.count += move;
        this.carried.count -= move;
        if (this.carried.count <= 0) this.carried = emptyStack();
      } else {
        this.inventory.set(i, { ...this.carried });
        this.carried = { ...s };
      }
    } else {
      const tmp = { ...this.carried };
      this.carried = { ...s };
      this.inventory.set(i, tmp);
    }
    this.refreshHotbar();
    this.refreshUI();
  }

  private onCraftCell(i: number): void {
    const cur = this.craftGrid[i] ?? 0;
    if (this.carried.id === 0) {
      if (cur === 0) return;
      this.craftGrid[i] = 0;
      this.carried = { id: cur, count: 1, durability: 0 };
    } else if (cur === 0) {
      this.craftGrid[i] = this.carried.id;
      this.carried = emptyStack();
    } else if (cur === this.carried.id) {
      this.craftGrid[i] = 0;
      this.carried.count += 1;
    } else {
      this.craftGrid[i] = this.carried.id;
      this.carried = { id: cur, count: 1, durability: 0 };
    }
    this.refreshUI();
  }

  private onCraftTake(): void {
    const result = this.currentCraftResult();
    if (!result) return;
    const fits = this.carried.id === 0 || (this.carried.id === result.id && this.carried.count + result.count <= this.inventory.stackMax(result.id));
    if (!fits) {
      this.hud.toast('手持物品已满');
      return;
    }
    if (this.carried.id === 0) this.carried = { id: result.id, count: result.count, durability: 0 };
    else this.carried.count += result.count;
    for (let i = 0; i < this.craftW * this.craftH; i++) this.craftGrid[i] = 0;
    this.refreshHotbar();
    this.refreshUI();
  }

  private onFurnaceSlot(which: 'in' | 'fuel' | 'out'): void {
    const key = this.openFurnaceKey;
    if (!key) return;
    let f = this.furnaces.get(key);
    if (!f) {
      f = new Furnace();
      this.furnaces.set(key, f);
    }
    if (which === 'in') {
      if (this.carried.id === 0) {
        this.carried = { id: f.inputId, count: f.inputCount, durability: 0 };
        f.inputId = 0;
        f.inputCount = 0;
        f.progress = 0;
      } else if (smeltRecipeFor(this.carried.id)) {
        const take = Math.min(this.carried.count, 64 - f.inputCount);
        if (f.inputId === 0 || f.inputId === this.carried.id) {
          f.inputId = this.carried.id;
          f.inputCount += take;
          this.carried.count -= take;
          if (this.carried.count <= 0) this.carried = emptyStack();
        }
      }
    } else if (which === 'fuel') {
      if (this.carried.id === 0) {
        this.carried = { id: f.fuelId, count: f.fuelCount, durability: 0 };
        f.fuelId = 0;
        f.fuelCount = 0;
      } else if (isFuel(this.carried.id)) {
        const take = Math.min(this.carried.count, 64 - f.fuelCount);
        if (f.fuelId === 0 || f.fuelId === this.carried.id) {
          f.fuelId = this.carried.id;
          f.fuelCount += take;
          this.carried.count -= take;
          if (this.carried.count <= 0) this.carried = emptyStack();
        }
      }
    } else {
      if (this.carried.id === 0 && f.outputId !== 0) {
        this.carried = { id: f.outputId, count: f.outputCount, durability: 0 };
        f.outputId = 0;
        f.outputCount = 0;
      } else if (this.carried.id === f.outputId && f.outputId !== 0) {
        const space = this.inventory.stackMax(this.carried.id) - this.carried.count;
        const take = Math.min(space, f.outputCount);
        this.carried.count += take;
        f.outputCount -= take;
        if (f.outputCount <= 0) f.outputId = 0;
      }
    }
    this.refreshUI();
  }
  private tickFurnaces(dt: number): void {
    if (this.gameMode !== 'survival' || !this.world || !this.renderer) return;
    for (const [key, f] of this.furnaces) {
      const wasLit = f.isLit();
      f.tick(dt);
      const lit = f.isLit();
      if (lit !== wasLit) {
        const parts = key.split(',').map(Number);
        const bx = parts[0];
        const by = parts[1];
        const bz = parts[2];
        const cur = this.world.getBlock(bx, by, bz);
        if (cur === Block.Furnace || cur === Block.FurnaceLit) {
          this.world.setBlockDirect(bx, by, bz, lit ? Block.FurnaceLit : Block.Furnace);
          this.renderer.rebuildAround(this.world, bx, bz);
        }
      }
    }
    if (this.openScreen === 'furnace') this.refreshUI();
  }

  private respawn(): void {
    this.playerState.health = 20;
    this.playerState.hunger = 20;
    const c = this.world!.config;
    const sx = c.size / 2;
    const sz = c.size / 2;
    let sy = this.world!.getSurfaceHeight(sx, sz) + 2;
    if (sy < c.seaLevel + 1) sy = c.seaLevel + 1;
    this.controls!.spawnAt(sx, sy, sz);
    this.hud.toast('你死了，已回到出生点（物品保留）');
    this.hud.setBars(20, 20);
  }

  private toggleGameMode(): void {
    this.gameMode = this.gameMode === 'survival' ? 'creative' : 'survival';
    this.hud.toast(this.gameMode === 'survival' ? '已切换为生存模式' : '已切换为创造模式（作弊）');
    this.closeScreen();
    this.mining = null;
    this.hideCrack();
    this.refreshHotbar();
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
    if (this.hud.isChatOpen()) return;
    if (this.survivalUI.isOpen()) {
      if (e.code === 'Escape' || e.code === 'KeyE') this.closeScreen();
      return;
    }
    if (this.hud.isPickerOpen()) {
      if (e.code === 'Escape') this.hud.closePicker();
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
        if (this.gameMode === 'survival') this.showScreen('inventory');
        else this.hud.togglePicker();
        break;
      case 'KeyF': this.toggleGameMode(); break;
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
    if (this.hud.isChatOpen() || this.survivalUI.isOpen()) return;
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
    if (!this.inGame() || this.hud.isChatOpen() || this.hud.isPickerOpen() || this.survivalUI.isOpen()) return;
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
      if (this.gameMode === 'creative') {
        this.localBlockAction(hit.x, hit.y, hit.z, Block.Air);
      } else {
        this.miningHeld = true;
      }
    } else if (e.button === 2) {
      const hitId = this.world!.getBlock(hit.x, hit.y, hit.z);
      if (this.gameMode === 'survival' && hitId === Block.CraftingTable) {
        this.openCrafting();
        return;
      }
      if (this.gameMode === 'survival' && (hitId === Block.Furnace || hitId === Block.FurnaceLit)) {
        this.openFurnaceAt(hit.x, hit.y, hit.z);
        return;
      }
      this.tryPlace(controls.position.x, controls.position.y, controls.position.z, hit.prevX, hit.prevY, hit.prevZ);
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

    const vyBefore = controls.velocity.y;
    if (!this.hud.isChatOpen() && !this.hud.isPickerOpen() && !this.survivalUI.isOpen()) {
      controls.update(dt, this.input);
    }
    const cam = renderer.camera;
    cam.position.set(controls.position.x, controls.position.y + EYE_HEIGHT, controls.position.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = controls.yaw;
    cam.rotation.x = controls.pitch;

    renderer.updateChunks(world, controls.position, RENDER_DISTANCE);

    if (this.gameMode === 'survival') {
      const active = this.input.forward || this.input.back || this.input.left || this.input.right || this.miningHeld;
      this.playerState.tick(dt, active);
      if (controls.onGround && vyBefore < -10) {
        this.playerState.damage(Math.max(0, Math.floor(Math.abs(vyBefore) - 3)));
      }
      const eyeBlock = world.getBlock(Math.floor(cam.position.x), Math.floor(cam.position.y), Math.floor(cam.position.z));
      if (eyeBlock === Block.Water) this.playerState.damage(dt * 4);
      if (this.playerState.isDead()) this.respawn();
      if (now - this.lastBarsUpdate >= 200) {
        this.lastBarsUpdate = now;
        this.hud.setBars(this.playerState.health, this.playerState.hunger);
      }
      this.tickFurnaces(dt);
    }
    this.updateMining(dt);
    this.drops.update(dt, world, controls.position);
    this.particles.update(dt);

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
    const furnaces = [...this.furnaces.entries()].map(([key, f]) => ({ key, data: f.serialize() }));
    const ok = saveWorld(this.roomCode, this.world.config.seed, this.world.getDiffList(), {
      mode: this.gameMode,
      inventory: this.inventory.serialize(),
      furnaces,
    });
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
    this.drops.dispose();
    this.particles.dispose();
    if (this.crackMesh) {
      this.renderer?.scene.remove(this.crackMesh);
      this.crackMesh = null;
    }
    this.crackMat = null;
    this.survivalUI.close();
    this.inventory = new Inventory();
    this.playerState = new PlayerState();
    this.carried = emptyStack();
    this.furnaces.clear();
    this.mining = null;
    this.miningHeld = false;
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