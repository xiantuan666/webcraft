export const PROTOCOL_VERSION = 1;

export interface RemotePlayerInfo {
  id: string;
  name: string;
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
  diffs: WireDiff[];
}

export interface BlockSetMsg {
  t: 'blockSet';
  x: number;
  y: number;
  z: number;
  id: number;
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

export type NetMessage = HelloMsg | WelcomeMsg | BlockSetMsg | PlayerStateMsg | ChatMsg | JoinMsg | LeaveMsg;