const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox', '--proxy-server=http://127.0.0.1:7897', '--window-size=960,600']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure() ? r.failure().errorText : ''}`));
  await page.goto('https://elcraft.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const menuVisible = await page.isVisible('#menu .menu-box');
  await page.click('#btn-create').catch(e => logs.push('[click err] ' + e.message));
  await page.waitForTimeout(8000);
  const status = await page.textContent('#status').catch(() => null);
  const fatal = await page.textContent('#fatal').catch(() => null);
  const canvasCount = await page.evaluate(() => document.querySelectorAll('#app canvas').length).catch(() => -1);
  const hotbarImgs = await page.evaluate(() => Array.from(document.querySelectorAll('#hotbar img')).map(i => ({ len: i.src.length, head: i.src.slice(0, 30) }))).catch(() => null);
  const iconData = await page.evaluate(() => { const img = document.querySelector('#hotbar img'); return img ? img.src : null; }).catch(() => null);
  await page.screenshot({ path: 'diag_shot.png' }).catch(e => logs.push('[shot err] ' + e.message));
  if (iconData) fs.writeFileSync('diag_icon_b64.txt', iconData);
  console.log('MENU_VISIBLE:', menuVisible);
  console.log('STATUS:', status);
  console.log('FATAL:', fatal);
  console.log('CANVAS_COUNT:', canvasCount);
  console.log('HOTBAR_IMGS:', JSON.stringify(hotbarImgs));
  console.log('LOGS:\n' + logs.join('\n'));
  await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR:', e); process.exit(1); });