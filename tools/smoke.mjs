import fs from 'node:fs';
import { generateWorld, isWalkableAt, zoneName } from '../js/world.js';
import { Renderer } from '../js/renderer.js';
import { buildPalette } from '../js/palette.js';
import { CHARS, CHAR_INDEX } from '../js/ascii.js';

let failures = 0;
const fail = (message) => {
  failures++;
  console.error(`FAIL ${message}`);
};
const ok = (condition, message) => {
  if (!condition) fail(message);
};

const world = generateWorld();
ok(world.w === 58 && world.h === 58, 'world is 58x58');
ok(world.collectibles.length === 9, 'nine spirit lights');
ok(isWalkableAt(world, world.start.x, world.start.y), 'start is walkable');
ok(world.reachable.reduce((n, v) => n + (v ? 1 : 0), 0) > 900, 'world has a large reachable area');

for (const light of world.collectibles) {
  ok(isWalkableAt(world, light.x, light.y), `light ${light.id} is walkable`);
  ok(Math.hypot(light.x - world.start.x, light.y - world.start.y) > 4, `light ${light.id} is away from start`);
}

const palette = buildPalette();
ok(palette.rgb.length >= 350, 'palette has fog ramps');
ok(palette.rgb.length < 4096, 'palette fits a Uint16 buffer');

const keys = CHARS;
ok(keys.length === 35, `pure ASCII glyph set is 35 (got ${keys.length})`);
for (const ch of keys) {
  ok(ch.length === 1 && ch.charCodeAt(0) < 128, 'glyph is one ASCII byte');
  ok(CHAR_INDEX.get(ch) !== undefined, 'glyph index is registered');
}

const renderer = new Renderer(96, 44);
const views = [
  { name: 'start', x: world.start.x, y: world.start.y, angle: world.start.angle },
  { name: 'bridge', x: world.bridge.x0 - 3.5, y: world.bridge.y + 1.5, angle: 0.1 },
  { name: 'pool', x: world.pool.x + 8, y: world.pool.y + 2, angle: -1.2 },
  { name: 'woods', x: world.spawn.x, y: world.spawn.y, angle: -0.5 },
];

for (const view of views) {
  const frame = renderer.render(world, {
    x: view.x,
    y: view.y,
    angle: view.angle,
    horizonOffset: 0,
    time: 4.2,
    fade: 0,
  });
  const size = frame.width * frame.height;
  ok(frame.chars.length === size && frame.colors.length === size && frame.bg.length === size, `${view.name}: frame buffer sizes`);
  let painted = 0;
  let maxChar = 0;
  for (let i = 0; i < size; i++) {
    if (frame.chars[i] !== 0) painted++;
    if (frame.chars[i] > maxChar) maxChar = frame.chars[i];
  }
  ok(painted > size * 0.45, `${view.name}: frame is mostly painted`);
  ok(maxChar < keys.length, `${view.name}: chars stay inside the atlas`);
  ok(frame.colors.every((c) => c < palette.rgb.length), `${view.name}: colors stay inside the palette`);
  ok(zoneName(world, view.x, view.y).length > 0, `${view.name}: zone has a name`);
}

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const ids = [...main.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
for (const id of new Set(ids)) {
  ok(html.includes(`id="${id}"`), `index.html contains #${id}`);
}
for (const asset of ['favicon.svg', 'site.webmanifest']) {
  ok(fs.existsSync(new URL(`../${asset}`, import.meta.url)), `${asset} exists`);
}

if (failures) {
  console.error(`${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log(`smoke ok: ${palette.rgb.length} colors, ${keys.length} glyphs, ${world.collectibles.length} lights`);
