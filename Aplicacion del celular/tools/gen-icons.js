/* Generador de iconos PNG para PetSafe IoT — sin dependencias externas.
   Codificador PNG propio (zlib de Node) + dibujo con supersampling 4x.
   Uso: node tools/gen-icons.js                                              */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------------- codificador PNG ---------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtro None
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------- geometría ---------------- */
function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx, dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

// huella: almohadilla + 4 dedos
const PAW = [
  { c: [0.500, 0.640], r: [0.205, 0.170] },
  { c: [0.290, 0.420], r: [0.083, 0.108] },
  { c: [0.425, 0.300], r: [0.083, 0.108] },
  { c: [0.575, 0.300], r: [0.083, 0.108] },
  { c: [0.710, 0.420], r: [0.083, 0.108] }
];

function pawCoverage(nx, ny) {
  let best = 0;
  for (const p of PAW) {
    const dx = (nx - p.c[0]) / p.r[0], dy = (ny - p.c[1]) / p.r[1];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= 1) best = 1;
  }
  return best;
}

function roundRect(px, py, size, radius) {
  const x0 = radius, y0 = radius, x1 = size - radius, y1 = size - radius;
  if (px < x0 && py < y0) return inEllipse(px - x0, py - y0, 0, 0, radius, radius);
  if (px > x1 && py < y0) return inEllipse(px - x1, py - y0, 0, 0, radius, radius);
  if (px < x0 && py > y1) return inEllipse(px - x0, py - y1, 0, 0, radius, radius);
  if (px > x1 && py > y1) return inEllipse(px - x1, py - y1, 0, 0, radius, radius);
  return true;
}

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Dibuja el icono: squircle con degradado azul + huella blanca.
 * @param {number} size lado en píxeles
 * @param {object} opt  {full: fondo sin esquinas (adaptive), alpha: opacidad}
 */
function drawIcon(size, opt) {
  opt = opt || {};
  const SS = 4;                       // supersampling
  const out = Buffer.alloc(size * size * 4);
  const radius = size * 0.235;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;

          // cobertura del fondo (squircle) salvo en modo "full"
          const cov = opt.full ? 1 : (roundRect(px, py, size, radius) ? 1 : 0);

          const t = (px / size) * 0.45 + (py / size) * 0.55;
          let br = lerp(0x4d, 0x14, t);
          let bg = lerp(0x92, 0x5c, t);
          let bb = lerp(0xf3, 0xc8, t);

          // resplandor suave en la esquina superior izquierda
          const gl = Math.max(0, 1 - Math.hypot(px - size * 0.32, py - size * 0.24) / (size * 0.72));
          br = lerp(br, 255, gl * 0.22);
          bg = lerp(bg, 255, gl * 0.22);
          bb = lerp(bb, 255, gl * 0.22);

          // huella blanca
          if (pawCoverage(px / size, py / size)) { br = 255; bg = 255; bb = 255; }

          rSum += br * cov; gSum += bg * cov; bSum += bb * cov; aSum += 255 * cov;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      if (aSum > 0) {
        // color = promedio de las muestras cubiertas; alfa = cobertura media
        out[i] = Math.round((rSum * 255) / aSum);
        out[i + 1] = Math.round((gSum * 255) / aSum);
        out[i + 2] = Math.round((bSum * 255) / aSum);
      }
      out[i + 3] = Math.round(aSum / n);
    }
  }
  return encodePNG(size, size, out);
}

/* Capa frontal del icono adaptativo: huella blanca centrada en la zona segura
   (66/108 del lienzo), fondo transparente. */
function drawAdaptiveForeground(size) {
  const SS = 4;
  const out = Buffer.alloc(size * size * 4);
  const scale = 0.60;            // la huella ocupa el 60 % del lienzo
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const nx = 0.5 + (px / size - 0.5) / scale;
          const ny = 0.5 + (py / size - 0.5) / scale;
          if (pawCoverage(nx, ny)) hits++;
        }
      }
      const i = (y * size + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = Math.round((hits / (SS * SS)) * 255);
    }
  }
  return encodePNG(size, size, out);
}

/* Icono monocromo para la notificación (blanco sobre transparente) */
function drawNotificationIcon(size) {
  const SS = 4;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          if (pawCoverage(nx, ny)) hits++;
        }
      }
      const i = (y * size + x) * 4;
      const a = Math.round((hits / (SS * SS)) * 255);
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = a;
    }
  }
  return encodePNG(size, size, out);
}

/* ---------------- salida ---------------- */
const ROOT = path.resolve(__dirname, '..');

const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const LAUNCHER = [
  ['mipmap-mdpi', 108], ['mipmap-hdpi', 162], ['mipmap-xhdpi', 216],
  ['mipmap-xxhdpi', 324], ['mipmap-xxxhdpi', 432]
];

function write(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log('  ' + path.relative(ROOT, file) + '  (' + buf.length + ' B)');
}

console.log('Iconos del lanzador:');
LAUNCHER.forEach(([dir, size]) => {
  write(path.join(ANDROID_RES, dir, 'ic_launcher.png'), drawIcon(Math.round(size * 0.62), {}));
  write(path.join(ANDROID_RES, dir, 'ic_launcher_round.png'), drawIcon(Math.round(size * 0.62), {}));
  write(path.join(ANDROID_RES, dir, 'ic_launcher_foreground.png'), drawAdaptiveForeground(size));
});

console.log('Recursos web:');
write(path.join(ROOT, 'www', 'assets', 'icon', 'icon-192.png'), drawIcon(192, {}));
write(path.join(ROOT, 'www', 'assets', 'icon', 'icon-512.png'), drawIcon(512, {}));
write(path.join(ROOT, 'www', 'assets', 'icon', 'favicon-32.png'), drawIcon(32, {}));

console.log('Icono de notificación:');
write(path.join(ANDROID_RES, 'drawable-mdpi', 'ic_stat_pet.png'), drawNotificationIcon(24));
write(path.join(ANDROID_RES, 'drawable-hdpi', 'ic_stat_pet.png'), drawNotificationIcon(36));
write(path.join(ANDROID_RES, 'drawable-xhdpi', 'ic_stat_pet.png'), drawNotificationIcon(48));
write(path.join(ANDROID_RES, 'drawable-xxhdpi', 'ic_stat_pet.png'), drawNotificationIcon(72));
write(path.join(ANDROID_RES, 'drawable-xxxhdpi', 'ic_stat_pet.png'), drawNotificationIcon(96));

console.log('Listo.');