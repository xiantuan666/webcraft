import * as THREE from 'three';
import type { PlayerStateMsg } from '../net/protocol';

interface RemotePlayer {
  group: THREE.Group;
  target: THREE.Vector3;
  yaw: number;
}

/** 远端玩家实体：身体 + 头 + 名牌，位置插值 */
export class RemotePlayers {
  readonly group = new THREE.Group();
  private players = new Map<string, RemotePlayer>();

  updateState(s: PlayerStateMsg): void {
    let p = this.players.get(s.id);
    if (!p) p = this.create(s.id, s.name);
    p.target.set(s.x, s.y, s.z);
    p.yaw = s.yaw;
  }

  private create(id: string, name: string): RemotePlayer {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorFromId(id) });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), bodyMat);
    body.position.y = 0.6;
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffd7b0 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.y = 1.45;
    const sprite = makeNameSprite(name);
    sprite.position.y = 2.15;
    group.add(body, head, sprite);
    this.group.add(group);
    const p: RemotePlayer = { group, target: new THREE.Vector3(), yaw: 0 };
    this.players.set(id, p);
    return p;
  }

  remove(id: string): void {
    const p = this.players.get(id);
    if (p) {
      this.group.remove(p.group);
      this.players.delete(id);
    }
  }

  update(dt: number): void {
    const alpha = Math.min(1, dt * 12);
    for (const p of this.players.values()) {
      p.group.position.lerp(p.target, alpha);
      p.group.rotation.y = p.yaw;
    }
  }

  clear(): void {
    for (const id of [...this.players.keys()]) this.remove(id);
  }
}

function colorFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return new THREE.Color().setHSL((h % 360) / 360, 0.6, 0.55).getHex();
}

function makeNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(2, 0.5, 1);
  return sprite;
}