import * as THREE from 'three';

let crackTextures: THREE.CanvasTexture[] | null = null;

/** 生成 10 级裂纹贴图（程序化黑线，叠加在方块上） */
function buildCracks(): THREE.CanvasTexture[] {
  const stages: THREE.CanvasTexture[] = [];
  for (let stage = 0; stage < 10; stage++) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.clearRect(0, 0, 16, 16);
    const density = (stage + 1) / 10;
    // 若干条随机裂纹
    let lines = Math.floor(4 + density * 18);
    let seed = 12345 + stage * 777;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    ctx.strokeStyle = `rgba(20,20,20,${0.55 + density * 0.4})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      let x = Math.floor(rnd() * 16);
      let y = Math.floor(rnd() * 16);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 2 + Math.floor(density * 4);
      for (let s = 0; s < segs; s++) {
        x += Math.floor(rnd() * 5) - 2;
        y += Math.floor(rnd() * 5) - 2;
        x = Math.max(0, Math.min(15, x));
        y = Math.max(0, Math.min(15, y));
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    stages.push(tex);
  }
  return stages;
}

export function getCrackTexture(stage: number): THREE.CanvasTexture {
  if (!crackTextures) crackTextures = buildCracks();
  return crackTextures[Math.max(0, Math.min(9, stage))];
}