// Render a frame of Willow Creek directly into your terminal.
// Usage: node tools/preview-scene.mjs [view] [cols] [rows]
// Views: spawn, bridge, pool, grove, north

import { generateWorld, riverCenter } from '../js/world.js';
import { Renderer } from '../js/renderer.js';
import { CHARS } from '../js/ascii.js';
import { COLORS, FOG_STEPS } from '../js/palette.js';

const view = process.argv[2] || 'spawn';
const cols = parseInt(process.argv[3] || '100', 10);
const rows = parseInt(process.argv[4] || '44', 10);

const world = generateWorld();

const P = 0.68;
const makeCam = (x, y, yaw) => ({
  px: x,
  py: y,
  yaw,
  dirX: Math.cos(yaw),
  dirY: Math.sin(yaw),
  planeX: -Math.sin(yaw) * P,
  planeY: Math.cos(yaw) * P,
  time: 3.1,
  horizonOffset: 0,
  sunAngle: -1.95,
  collected: new Set(),
});

const views = {
  spawn: makeCam(world.start.x, world.start.y, world.start.angle),
  oldspawn: makeCam(world.spawn.x, world.spawn.y, -1.35),
  bridge: makeCam(world.bridge.x0 - 3.5, world.bridge.y + 1.2, -0.18),
  pool: makeCam(world.pool.x - 13, world.pool.y + 1.5, -0.15),
  grove: makeCam(world.landmarks[1].x, world.landmarks[1].y + 4, -Math.PI / 2),
  north: makeCam(world.bridge.x0 + 1, world.bridge.y - 3, -Math.PI / 2 + 0.4),
  east: makeCam(world.spawn.x, world.spawn.y, -0.15),
  start: makeCam(18.5, 36.5, -1.35),
  bank: makeCam(19.5, 44.5, -0.3),
  glade: makeCam(world.landmarks[0].x, world.landmarks[0].y + 2.6, -Math.PI / 2 + 0.2),
  deck: makeCam(world.bridge.x0 + 0.6, world.bridge.y + 1.15, 0.02),
  deck2: makeCam(world.bridge.x0 + 0.6, world.bridge.y + 1.15, -0.42),
  approach: makeCam(world.bridge.x0 - 1.4, world.bridge.y + 1.15, 0.02),
  approach2: makeCam(world.bridge.x0 - 1.4, world.bridge.y + 1.15, -0.34),
  eastbank: makeCam(world.bridge.x1 + 1.6, world.bridge.y + 1.15, Math.PI),
  eastbank2: makeCam(world.bridge.x1 + 1.6, world.bridge.y + 1.15, Math.PI + 0.38),
  riverside: makeCam(world.spawn.x + 2.4, world.spawn.y, -0.72),
};

const cam = views[view] || views.spawn;
const renderer = new Renderer(cols, rows);
const frame = renderer.render(world, cam);

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function bgFor(y, horizon) {
  if (y < horizon) {
    const t = y / horizon;
    if (t < 0.5) return mix(COLORS.skyTop, COLORS.skyMid, t * 2);
    return mix(COLORS.skyMid, COLORS.skyHorizon, (t - 0.5) * 2);
  }
  return [20, 32, 23];
}

const useColor = process.env.COLOR === '1';
const out = [];
for (let y = 0; y < rows; y++) {
  let line = '';
  const bg = bgFor(y, frame.horizon);
  for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    const ch = CHARS[frame.chars[i]] || ' ';
    if (!useColor) {
      line += ch;
      continue;
    }
    const col = frame.colors[i];
    const rgb = renderer.palette.rgb[col] || [255, 0, 255];
    const fg = `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    const bgc = `\x1b[48;2;${bg[0] | 0};${bg[1] | 0};${bg[2] | 0}m`;
    line += fg + bgc + ch;
  }
  out.push(useColor ? line + '\x1b[0m' : line);
}
console.log(out.join('\n'));
console.log(`view=${view} cam=(${cam.px.toFixed(1)}, ${cam.py.toFixed(1)}) horizon=${frame.horizon.toFixed(1)} glyphs=${CHARS.length} fogSteps=${FOG_STEPS}`);
