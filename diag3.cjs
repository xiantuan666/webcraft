const { chromium } = require('playwright');
const fs = require('fs');
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
  const hotbar = await page.evaluate(() => Array.from(document.querySelectorAll('#hotbar img')).map(i => ({ hasSrc: i.src.length > 0, len: i.src.length }))).catch(e => 'ERR ' + e.message);
  await page.screenshot({ path: 'diag_shot2.png' });
  console.log('HOTBAR:', JSON.stringify(hotbar));
  console.log('LOGS:', JSON.stringify(logs));
  await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR:', e); process.exit(1); });