/* Comprueba que una captura de pantalla no está en blanco: decodifica el PNG
   con zlib y calcula estadísticas de color (ignora el filtro por fila).  */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function decode(file) {
  const b = fs.readFileSync(file);
  let o = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const type = b.toString('ascii', o + 4, o + 8);
    const data = b.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9];
    }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const bb = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const p = a + bb - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 0xff;
    }
    cur.copy(px, y * stride);
    prev = cur;
  }
  return { w, h, bpp, px };
}

const file = process.argv[2];
const img = decode(file);
const { w, h, bpp, px } = img;
let sum = 0, n = 0, uniq = new Set();
const hues = { blue: 0, white: 0, orange: 0, red: 0, green: 0, dark: 0 };
for (let y = 0; y < h; y += 3) {
  for (let x = 0; x < w; x += 3) {
    const i = y * w * bpp + x * bpp;
    const r = px[i], g = px[i + 1], bl = px[i + 2];
    sum += (r + g + bl) / 3; n++;
    uniq.add((r >> 4) + ',' + (g >> 4) + ',' + (bl >> 4));
    if (bl > 150 && bl - r > 40) hues.blue++;
    else if (r > 235 && g > 235 && bl > 235) hues.white++;
    else if (r > 200 && g > 110 && g < 190 && bl < 90) hues.orange++;
    else if (r > 180 && g < 100 && bl < 100) hues.red++;
    else if (g > 120 && r < 120 && bl < 130) hues.green++;
    else if (r < 70 && g < 70 && bl < 70) hues.dark++;
  }
}
console.log('archivo   :', file);
console.log('tamaño    :', w + ' x ' + h, '· canales', bpp);
console.log('brillo    :', (sum / n).toFixed(1), '/255  (una pantalla vacía daría 0 o 255)');
console.log('colores   :', uniq.size, 'tonos distintos muestreados');
console.log('distribución de color:', JSON.stringify(hues));
console.log(uniq.size > 12 && sum / n > 25 && sum / n < 245
  ? 'RESULTADO: la pantalla se está pintando correctamente'
  : 'RESULTADO: POSSIBLE PANTALLA EN BLANCO');