const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox', '--window-size=960,600']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await page.goto('http://localhost:5197/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.click('#btn-create');
  await page.waitForTimeout(8000);

  const atlas = await page.evaluate(() => {
    const f = window.__atlasSample;
    if (typeof f !== 'function') return 'NO_HOOK';
    return f();
  }).catch(e => 'ERR ' + e.message);

  const world = await page.evaluate(() => {
    const g = window.__game;
    if (!g || !g.world) return 'NO_GAME';
    const w = g.world;
    const out = { blocks: [], surfaces: [], triangles: 0 };
    if (g.renderer && g.renderer.renderer) out.triangles = g.renderer.renderer.info.render.triangles;
    for (const [x, z] of [[128,128],[64,64],[200,80],[30,200]]) {
      const h = w.getSurfaceHeight(x, z);
      out.surfaces.push([x, z, h]);
      out.blocks.push([x, h, z, w.getBlock(x, h, z), w.getBlock(x, h-1, z), w.getBlock(x, h-2, z)]);
    }
    return out;
  }).catch(e => 'ERR ' + e.message);

  const cam = await page.evaluate(() => {
    const g = window.__game;
    if (!g || !g.controls) return 'NO_CONTROLS';
    const p = g.controls.position;
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), flying: g.controls.flying };
  }).catch(e => 'ERR ' + e.message);

  console.log('ATLAS:', JSON.stringify(atlas));
  console.log('WORLD:', JSON.stringify(world));
  console.log('CAM:', JSON.stringify(cam));
  console.log('LOGS:', JSON.stringify(logs));
  await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR:', e); process.exit(1); });