// Development tool: renders a game frame to a PNG so the scene can be inspected
// as an image. Uses a tiny hand-made 5x7 bitmap font (approximate glyph shapes)
// and writes an uncompressed-filter PNG with Node's zlib.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { generateWorld } from '../js/world.js';
import { Renderer } from '../js/renderer.js';
import { CHARS } from '../js/ascii.js';
import { COLORS } from '../js/palette.js';

const view = process.argv[2] || 'spawn';
const cols = parseInt(process.argv[3] || '96', 10);
const rows = parseInt(process.argv[4] || '44', 10);
const outFile = process.argv[5] || `/data/data/com.termux/files/usr/tmp/opencode/willow-${view}.png`;

const FONT = {
  ' ': '..... ..... ..... ..... ..... ..... .....',
  '.': '..... ..... ..... ..... ..... ..#.. ..#..',
  ',': '..... ..... ..... ..... ..#.. ..#.. .#...',
  ':': '..... ..#.. ..#.. ..... ..#.. ..#.. .....',
  ';': '..... ..#.. ..#.. ..... ..#.. ..#.. .#...',
  "'": '..#.. ..#.. ..... ..... ..... ..... .....',
  '"': '.#.#. .#.#. ..... ..... ..... ..... .....',
  '`': '.#... ..#.. ..... ..... ..... ..... .....',
  '^': '..#.. .#.#. #...# ..... ..... ..... .....',
  '~': '..... ..... .#.#. #.#.. ..... ..... .....',
  '-': '..... ..... ..... .###. ..... ..... .....',
  '_': '..... ..... ..... ..... ..... ..... #####',
  '=': '..... ..... .###. ..... .###. ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '*': '..... ..#.. #.#.# .###. #.#.# ..#.. .....',
  '/': '....# ...#. ...#. ..#.. .#... .#... #....',
  '\\': '#.... .#... .#... ..#.. ...#. ...#. ....#',
  '|': '..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  '@': '.###. #...# #.### #.#.# #.### #.... .###.',
  '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.',
  '$': '..#.. .#### #.#.. .###. ..#.# ####. ..#..',
  '%': '##..# ##.#. ...#. ..#.. .#... .#.## #..##',
  '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
  'o': '..... ..... .###. #...# #...# #...# .###.',
  'O': '.###. #...# #...# #...# #...# #...# .###.',
  'v': '..... ..... #...# #...# #...# .#.#. ..#..',
  'Y': '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  'i': '..#.. ..... .##.. ..#.. ..#.. ..#.. .###.',
  'l': '.##.. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  'A': '..#.. .#.#. #...# #...# ##### #...# #...#',
  'b': '#.... #.... ####. #...# #...# #...# ####.',
  'w': '..... ..... #...# #...# #.#.# #.#.# .#.#.',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '[': '.###. .#... .#... .#... .#... .#... .###.',
  ']': '.###. ...#. ...#. ...#. ...#. ...#. .###.',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '≈': '..... ..... .#.#. #.#.. ..... .#.#. #.#..',
  '·': '..... ..... ..... ..#.. ..... ..... .....',
  '∙': '..... ..... ..... ..#.. ..... ..... .....',
  '●': '..... .###. ##### ##### ##### .###. .....',
  '○': '..... .###. #...# #...# #...# .###. .....',
  '◆': '..... ..#.. .###. ##### .###. ..#.. .....',
  '◇': '..... ..#.. .#.#. #...# .#.#. ..#.. .....',
  '░': '.#... ...#. .#... ...#. .#... ...#. .#...',
  '▒': '.#.#. #.#.# .#.#. #.#.# .#.#. #.#.# .#.#.',
  '▓': '###.# #.### ###.# #.### ###.# #.### ###.#',
  '█': '##### ##### ##### ##### ##### ##### #####',
  '▀': '##### ##### ##### ##### ..... ..... .....',
  '▄': '..... ..... ..... ..... ##### ##### #####',
  '▌': '###.. ###.. ###.. ###.. ###.. ###.. ###..',
  '▐': '..### ..### ..### ..### ..### ..### ..###',
  '▲': '..... ..#.. .###. ##### ##### ##### #####',
  '△': '..... ..#.. .#.#. #...# #...# ##### #####',
  '▼': '##### ##### ##### ##### .###. ..#.. .....',
  '─': '..... ..... ..... ##### ..... ..... .....',
  '│': '..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
};

const makeCam = (x, y, yaw) => {
  const P = 0.68;
  return {
    px: x, py: y, yaw,
    dirX: Math.cos(yaw), dirY: Math.sin(yaw),
    planeX: -Math.sin(yaw) * P, planeY: Math.cos(yaw) * P,
    time: 3.1, horizonOffset: 0, sunAngle: -2.15, collected: new Set(),
  };
};

const world = generateWorld();
const a = world.spawn;
const b = world.landmarks[1];
const bridge = world.bridge;
const views = {
  spawn: makeCam(a.x, a.y, -1.35),
  spawn2: makeCam(a.x, a.y, 0.4),
  bridge: makeCam(bridge.x0 - 3.5, bridge.y + 1.2, -0.18),
  bridge2: makeCam(bridge.x1 + 2, bridge.y + 1.2, Math.PI + 0.15),
  pool: makeCam(world.pool.x - 13, world.pool.y + 1.5, -0.15),
  grove: makeCam(b.x, b.y + 4, -Math.PI / 2),
  forest: makeCam(8.5, 51.5, Math.atan2(48.5 - 51.5, 9.5 - 8.5)),
  north: makeCam(bridge.x0 + 1, bridge.y - 3, -Math.PI / 2 + 0.4),
};
const cam = views[view] || views.spawn;

const renderer = new Renderer(cols, rows);
const frame = renderer.render(world, cam);

const CW = 10;
const CH = 16;
const W = cols * CW;
const H = rows * CH;
const pixels = Buffer.alloc(W * H * 3);

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const setPx = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i] = c[0];
  pixels[i + 1] = c[1];
  pixels[i + 2] = c[2];
};

for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const i = cy * cols + cx;
    const idx = frame.chars[i];
    const ch = CHARS[idx] || ' ';
    const col = renderer.palette.rgb[frame.colors[i]] || [255, 0, 255];

    let bg;
    if (cy < frame.horizon) {
      const t = cy / Math.max(1, frame.horizon);
      bg = t < 0.5 ? mix(COLORS.skyTop, COLORS.skyMid, t * 2) : mix(COLORS.skyMid, COLORS.skyHorizon, (t - 0.5) * 2);
    } else {
      bg = [18, 30, 22];
    }
    for (let py = 0; py < CH; py++) {
      for (let px = 0; px < CW; px++) {
        setPx(cx * CW + px, cy * CH + py, bg);
      }
    }

    const pat = FONT[ch] || FONT['▓'];
    const rowsF = pat.split(' ');
    const offX = 1;
    const offY = 1;
    for (let fy = 0; fy < 7; fy++) {
      for (let fx = 0; fx < 5; fx++) {
        if (rowsF[fy][fx] !== '#') continue;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            setPx(cx * CW + offX + fx * 2 + sx, cy * CH + offY + fy * 2 + sy, col);
          }
        }
      }
    }
  }
}

// ---- PNG writer ---------------------------------------------------------
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  pixels.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(outFile, png);
console.log(`wrote ${outFile} (${W}x${H}) view=${view}`);
