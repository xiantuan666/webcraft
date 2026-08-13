const fs = require('fs');
const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync('diag_shot.png'));
const { width, height, data } = png;
console.log('size:', width + 'x' + height);

function sample(x0, y0, x1, y1, label) {
  let r = 0, g = 0, b = 0, n = 0, dark = 0, bright = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (y * width + x) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 30) dark++;
      if (lum > 150) bright++;
    }
  }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  console.log(`${label}: avg rgb=(${r},${g},${b}) dark=${((dark / n) * 100).toFixed(0)}% bright=${((bright / n) * 100).toFixed(0)}%`);
}
sample(0, 0, width, 80, '顶部(天空)');
sample(width/2 - 80, height/2 - 80, width/2 + 80, height/2 + 80, '中央(准星)');
sample(80, height/2 - 60, 300, height/2 + 60, '左侧中部');
sample(width-300, height/2 - 60, width-80, height/2 + 60, '右侧中部');
sample(0, height - 120, width, height, '底部(热栏区)');