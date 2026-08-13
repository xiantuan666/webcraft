export const PROTOCOL_VERSION = 1;

export type GameMode = 'creative' | 'survival';

export interface RemotePlayerInfo {
  id: string;
  name: string;
}

export interface VillagerInfo {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** 掉落物数据 */
export interface DropData {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  item: number;
  count: number;
}

/** 联机用的方块 diff：[x,y,z,id] */
export type WireDiff = [number, number, number, number];

export interface HelloMsg {
  t: 'hello';
  name: string;
  version: number;
}

export interface WelcomeMsg {
  t: 'welcome';
  seed: number;
  size: number;
  height: number;
  seaLevel: number;
  spawn: [number, number, number];
  players: RemotePlayerInfo[];
  villagers: VillagerInfo[];
  mode: GameMode;
  diffs: WireDiff[];
}

export interface BlockSetMsg {
  t: 'blockSet';
  x: number;
  y: number;
  z: number;
  id: number;
  dropItem?: number;
  dropCount?: number;
}

export interface PlayerStateMsg {
  t: 'playerState';
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface VillagerStateMsg {
  t: 'villagerState';
  list: VillagerInfo[];
}

export interface DropSpawnMsg {
  t: 'dropSpawn';
  drop: DropData;
}

export interface DropPickupMsg {
  t: 'dropPickup';
  id: string;
  playerId: string;
}

export interface DropRemoveMsg {
  t: 'dropRemove';
  id: string;
}

export interface ChatMsg {
  t: 'chat';
  id: string;
  name: string;
  text: string;
}

export interface JoinMsg {
  t: 'join';
  id: string;
  name: string;
}

export interface LeaveMsg {
  t: 'leave';
  id: string;
}

export type NetMessage = HelloMsg | WelcomeMsg | BlockSetMsg | PlayerStateMsg | VillagerStateMsg | DropSpawnMsg | DropPickupMsg | DropRemoveMsg | ChatMsg | JoinMsg | LeaveMsg;