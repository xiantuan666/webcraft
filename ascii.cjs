const fs = require('fs');
const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync('diag_shot.png'));
const { width, height, data } = png;
const cols = 72, rows = 30;
const chars = ' .:-=+*#%@';
for (let r = 0; r < rows; r++) {
  let line = '';
  for (let c = 0; c < cols; c++) {
    const x = Math.floor((c + 0.5) * width / cols);
    const y = Math.floor((r + 0.5) * height / rows);
    const i = (y * width + x) * 4;
    const R = data[i], G = data[i+1], B = data[i+2];
    const lum = (0.299*R + 0.587*G + 0.114*B) / 255;
    // 着色标记：蓝=天空/水，绿=草，棕=泥土/木，红=警告
    let ch = chars[Math.min(chars.length-1, Math.floor(lum * (chars.length-1)))];
    if (B > R + 20 && B > 100) ch = 'B';      // 偏蓝
    else if (G > R + 15 && G > 80) ch = 'G';  // 偏绿
    else if (R > B + 20 && R > 100) ch = 'R'; // 偏红/棕
    line += ch;
  }
  console.log(line);
}