import * as THREE from 'three';
import type { World } from '../world/world';
import { CHUNK_SIZE } from '../world/chunk';
import { meshChunk, type MeshData } from './mesher';
import { getAtlasTexture } from './textures';

function toGeometry(data: MeshData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geo.setIndex(new THREE.Uint32BufferAttribute(data.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** 世界渲染器：区块网格加载/卸载/重建 */
export class WorldRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly chunkMeshes = new Map<number, THREE.Mesh[]>();
  private readonly opaqueMat: THREE.MeshLambertMaterial;
  private readonly transparentMat: THREE.MeshLambertMaterial;
  private loadedCenter: [number, number] = [-9999, -9999];
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight || 1, 0.1, 1000);
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 90, 240);

    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x9a8a70, 0.95);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(0.6, 1.0, 0.35);
    this.scene.add(hemi, sun);

    this.opaqueMat = new THREE.MeshLambertMaterial({ map: getAtlasTexture(), side: THREE.DoubleSide });
    this.transparentMat = new THREE.MeshLambertMaterial({
      map: getAtlasTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  addToScene(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  private chunkKey(cx: number, cz: number): number {
    return cx * 512 + cz;
  }

  /** 根据玩家位置加载/卸载周围区块 */
  updateChunks(world: World, playerPos: THREE.Vector3, radius: number): void {
    const ccx = Math.floor(playerPos.x / CHUNK_SIZE);
    const ccz = Math.floor(playerPos.z / CHUNK_SIZE);
    if (ccx === this.loadedCenter[0] && ccz === this.loadedCenter[1]) return;
    this.loadedCenter = [ccx, ccz];

    const maxChunk = world.config.size / CHUNK_SIZE;
    const want = new Set<number>();
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        if (cx < 0 || cz < 0 || cx >= maxChunk || cz >= maxChunk) continue;
        want.add(this.chunkKey(cx, cz));
      }
    }
    for (const key of this.chunkMeshes.keys()) {
      if (!want.has(key)) this.disposeChunk(key);
    }
    for (const key of want) {
      if (!this.chunkMeshes.has(key)) {
        this.buildChunk(world, Math.floor(key / 512), key % 512);
      }
    }
  }

  buildChunk(world: World, cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    const { opaque, transparent } = meshChunk(world, cx, cz);
    const meshes: THREE.Mesh[] = [];
    const opaqueMesh = new THREE.Mesh(toGeometry(opaque), this.opaqueMat);
    opaqueMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    this.scene.add(opaqueMesh);
    meshes.push(opaqueMesh);
    if (transparent.indices.length > 0) {
      const transMesh = new THREE.Mesh(toGeometry(transparent), this.transparentMat);
      transMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      this.scene.add(transMesh);
      meshes.push(transMesh);
    }
    this.chunkMeshes.set(key, meshes);
  }

  rebuildChunk(world: World, cx: number, cz: number): void {
    const maxChunk = world.config.size / CHUNK_SIZE;
    if (cx < 0 || cz < 0 || cx >= maxChunk || cz >= maxChunk) return;
    const key = this.chunkKey(cx, cz);
    if (!this.chunkMeshes.has(key)) return; // 未加载则无需重建
    this.disposeChunk(key);
    this.buildChunk(world, cx, cz);
  }

  /** 重建某方块所在区块及其 8 邻域 */
  rebuildAround(world: World, bx: number, bz: number): void {
    const cx = Math.floor(bx / CHUNK_SIZE);
    const cz = Math.floor(bz / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.rebuildChunk(world, cx + dx, cz + dz);
      }
    }
  }

  private disposeChunk(key: number): void {
    const meshes = this.chunkMeshes.get(key);
    if (meshes) {
      for (const m of meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
      this.chunkMeshes.delete(key);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const key of [...this.chunkMeshes.keys()]) this.disposeChunk(key);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}