import { generateWorld, TILE } from '../js/world.js';

const w = generateWorld();
const glyph = {
  [TILE.GRASS]: '.',
  [TILE.WATER]: '~',
  [TILE.SAND]: ':',
  [TILE.PATH]: '"',
  [TILE.BRIDGE]: '=',
  [TILE.OAK]: 'O',
  [TILE.PINE]: 'A',
  [TILE.BIRCH]: 'b',
  [TILE.WILLOW]: 'w',
  [TILE.ROCK]: 'o',
  [TILE.BUSH]: ',',
  [TILE.RAIL]: '|',
  [TILE.BORDER]: '#',
};

let out = '';
for (let y = 0; y < w.h; y++) {
  let row = '';
  for (let x = 0; x < w.w; x++) {
    row += glyph[w.tiles[y * w.w + x]];
  }
  out += row + '\n';
}
console.log(out);
console.log('spawn', w.spawn, 'bridge', w.bridge, 'pool', w.pool);
console.log('collectibles', w.collectibles.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '));
let reachable = 0;
let walkable = 0;
for (let i = 0; i < w.tiles.length; i++) {
  const t = w.tiles[i];
  if (t === TILE.GRASS || t === TILE.SAND || t === TILE.PATH || t === TILE.BRIDGE || t === TILE.WATER) walkable++;
  if (w.reachable[i]) reachable++;
}
console.log('reachable walkable cells', reachable, 'of walkable-ish', walkable);
