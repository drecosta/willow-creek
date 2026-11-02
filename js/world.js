// Willow Creek - deterministic forest & river world generation.
// Pure module: safe to import in Node for headless previews and tests.

export const TILE = Object.freeze({
  GRASS: 0,
  WATER: 1,
  SAND: 2,
  PATH: 3,
  BRIDGE: 4,
  OAK: 5,
  PINE: 6,
  BIRCH: 7,
  WILLOW: 8,
  ROCK: 9,
  BUSH: 10,
  RAIL: 11,
  BORDER: 12,
});

export const TILE_COUNT = 13;

// Walls for the ray caster.
export const SOLID = new Uint8Array(TILE_COUNT);
for (const t of [TILE.OAK, TILE.PINE, TILE.BIRCH, TILE.WILLOW, TILE.ROCK, TILE.BUSH, TILE.RAIL, TILE.BORDER]) {
  SOLID[t] = 1;
}

// Tiles the player may stand on.
export const WALKABLE = new Uint8Array(TILE_COUNT);
for (const t of [TILE.GRASS, TILE.SAND, TILE.PATH, TILE.BRIDGE]) {
  WALKABLE[t] = 1;
}

export const MAP_W = 58;
export const MAP_H = 58;
export const SEED = 0x51c0ffee;

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const hash2 = (x, y) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smoother = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export const noise2 = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoother(xf);
  const v = smoother(yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
};

export const riverCenter = (y) =>
  MAP_W * 0.5 + Math.sin(y * 0.155) * 5.6 + Math.sin(y * 0.061 + 1.9) * 3.4;

const riverHalfWidth = (y) =>
  2.05 + (0.5 + 0.5 * Math.sin(y * 0.23 + 0.7)) * 1.15 + noise2(y * 0.4, 77.7) * 0.8;

const inBounds = (w, x, y) => x >= 0 && y >= 0 && x < w.w && y < w.h;

const stampDisk = (w, cx, cy, r, tile, onlyIf = null) => {
  const r2 = r * r;
  const x0 = Math.max(2, Math.floor(cx - r));
  const x1 = Math.min(w.w - 3, Math.ceil(cx + r));
  const y0 = Math.max(2, Math.floor(cy - r));
  const y1 = Math.min(w.h - 3, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = y * w.w + x;
      if (onlyIf && !onlyIf(w.tiles[i], x, y)) continue;
      w.tiles[i] = tile;
    }
  }
};

const carveTrail = (w, points, width = 1.2) => {
  for (let p = 0; p < points.length - 1; p++) {
    const [ax, ay] = points[p];
    const [bx, by] = points[p + 1];
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = lerp(ax, bx, t) + Math.sin(t * 9 + p) * 0.55;
      const y = lerp(ay, by, t) + Math.cos(t * 7 + p) * 0.45;
      const r = width * (0.78 + 0.22 * noise2(x * 0.7, y * 0.7));
      // Never carve into the river; the bridge is the only crossing.
      stampDisk(w, x, y, r, TILE.PATH, (tile) => tile !== TILE.WATER && tile !== TILE.BRIDGE && tile !== TILE.RAIL);
    }
  }
};

const bfsDistances = (w, fromTiles) => {
  const dist = new Int16Array(w.w * w.h).fill(-1);
  const queue = new Int32Array(w.w * w.h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (fromTiles.has(w.tiles[i])) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w.w;
    const y = (i / w.w) | 0;
    const d = dist[i] + 1;
    if (x > 0 && dist[i - 1] < 0) { dist[i - 1] = d; queue[tail++] = i - 1; }
    if (x < w.w - 1 && dist[i + 1] < 0) { dist[i + 1] = d; queue[tail++] = i + 1; }
    if (y > 0 && dist[i - w.w] < 0) { dist[i - w.w] = d; queue[tail++] = i - w.w; }
    if (y < w.h - 1 && dist[i + w.w] < 0) { dist[i + w.w] = d; queue[tail++] = i + w.w; }
  }
  return dist;
};

const reachableFrom = (w, sx, sy) => {
  const seen = new Uint8Array(w.w * w.h);
  const queue = new Int32Array(w.w * w.h);
  let head = 0;
  let tail = 0;
  const start = Math.floor(sy) * w.w + Math.floor(sx);
  if (!WALKABLE[w.tiles[start]]) return seen;
  seen[start] = 1;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w.w;
    const y = (i / w.w) | 0;
    const step = (j) => {
      if (!seen[j] && WALKABLE[w.tiles[j]]) {
        seen[j] = 1;
        queue[tail++] = j;
      }
    };
    if (x > 0) step(i - 1);
    if (x < w.w - 1) step(i + 1);
    if (y > 0) step(i - w.w);
    if (y < w.h - 1) step(i + w.w);
  }
  return seen;
};

const pickTree = (x, y, distToWater, rng) => {
  const n = noise2(x * 0.12 + 41, y * 0.12 + 17);
  if (distToWater > 0 && distToWater <= 3 && rng() < 0.52) return TILE.WILLOW;
  if (n > 0.62) return TILE.PINE;
  if (n > 0.42) return TILE.BIRCH;
  return TILE.OAK;
};

export function generateWorld(seed = SEED) {
  const rng = mulberry32(seed);
  const w = {
    w: MAP_W,
    h: MAP_H,
    tiles: new Uint8Array(MAP_W * MAP_H),
    variant: new Uint8Array(MAP_W * MAP_H),
    seed,
  };
  const idx = (x, y) => y * w.w + x;

  // ---- river ----------------------------------------------------------
  for (let y = 0; y < w.h; y++) {
    const cx = riverCenter(y);
    const hw = riverHalfWidth(y);
    for (let x = 0; x < w.w; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d < hw) w.tiles[idx(x, y)] = TILE.WATER;
      else if (d < hw + 1.9) w.tiles[idx(x, y)] = TILE.SAND;
    }
  }

  // A still pool where the creek widens.
  const pool = { x: riverCenter(41) + 1.5, y: 41 };
  stampDisk(w, pool.x, pool.y, 7.2, TILE.WATER);
  stampDisk(w, pool.x, pool.y, 9.1, TILE.SAND, (tile) => tile !== TILE.WATER);

  const distToWater = bfsDistances(w, new Set([TILE.WATER]));

  // ---- landmark clearings --------------------------------------------
  const spawn = { x: riverCenter(48) - 9.5, y: 48, angle: -Math.PI * 0.62 };
  const glades = [
    { x: spawn.x, y: spawn.y, r: 3.4 },
    { x: riverCenter(14) + 10.5, y: 15, r: 3.6 },
    { x: riverCenter(34) - 12.5, y: 35, r: 3.3 },
    { x: riverCenter(47) - 8.5, y: 50.5, r: 3.0 },
    { x: riverCenter(8) + 7.5, y: 8.5, r: 3.1 },
  ];
  for (const g of glades) {
    stampDisk(w, g.x, g.y, g.r, TILE.GRASS, (tile) => tile !== TILE.WATER);
    stampDisk(w, g.x, g.y, g.r + 0.8, TILE.GRASS, (tile) => tile === TILE.SAND && distToWater[idx(Math.floor(g.x), Math.floor(g.y))] > 2);
  }

  // ---- wooden bridge --------------------------------------------------
  const bridge = { y: 26, rows: 3 };
  const bcx = riverCenter(bridge.y);
  const bhw = riverHalfWidth(bridge.y);
  bridge.x0 = Math.max(3, Math.floor(bcx - bhw - 2.2));
  bridge.x1 = Math.min(w.w - 4, Math.ceil(bcx + bhw + 2.2));
  for (let y = bridge.y; y < bridge.y + bridge.rows; y++) {
    for (let x = bridge.x0; x <= bridge.x1; x++) w.tiles[idx(x, y)] = TILE.BRIDGE;
  }
  for (const y of [bridge.y - 1, bridge.y + bridge.rows]) {
    for (let x = bridge.x0; x <= bridge.x1; x++) w.tiles[idx(x, y)] = TILE.RAIL;
  }

  // ---- trails ---------------------------------------------------------
  const westBank = riverCenter(bridge.y) - bhw - 4.4;
  const eastBank = riverCenter(bridge.y) + bhw + 4.4;
  carveTrail(w, [
    [spawn.x, spawn.y],
    [riverCenter(43) - 7.2, 43],
    [riverCenter(36) - 6.4, 36],
    [riverCenter(31) - 5.4, 31],
    [westBank, bridge.y + 1],
    [eastBank, bridge.y + 1],
    [riverCenter(22) + 9.5, 22],
    [glades[1].x, glades[1].y],
    [riverCenter(10) + 8, 10],
    [glades[4].x, glades[4].y],
  ], 1.45);
  carveTrail(w, [
    [riverCenter(43) - 7.2, 43],
    [riverCenter(46) - 9.2, 46],
    [glades[3].x, glades[3].y],
  ], 1.15);
  carveTrail(w, [
    [riverCenter(31) - 5.4, 31],
    [riverCenter(34) - 12.5, 35],
    [glades[2].x, glades[2].y],
    [riverCenter(38) - 9, 39],
  ], 1.1);

  // ---- forest ---------------------------------------------------------
  const pathClear = new Uint8Array(w.w * w.h);
  for (let y = 2; y < w.h - 2; y++) {
    for (let x = 2; x < w.w - 2; x++) {
      const t = w.tiles[idx(x, y)];
      if (t === TILE.PATH || t === TILE.BRIDGE || t === TILE.RAIL) {
        for (let oy = -2; oy <= 2; oy++) {
          for (let ox = -2; ox <= 2; ox++) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx < 2 || yy < 2 || xx >= w.w - 2 || yy >= w.h - 2) continue;
            if (ox * ox + oy * oy <= 3) pathClear[idx(xx, yy)] = 1;
          }
        }
      }
    }
  }

  for (let y = 2; y < w.h - 2; y++) {
    for (let x = 2; x < w.w - 2; x++) {
      const i = idx(x, y);
      if (w.tiles[i] !== TILE.GRASS) continue;
      if (pathClear[i]) continue;
      let inGlade = false;
      for (const g of glades) {
        if (Math.hypot(x + 0.5 - g.x, y + 0.5 - g.y) < g.r + 1.2) { inGlade = true; break; }
      }
      if (inGlade) continue;

      const gladeNoise = noise2(x * 0.082 + 5.2, y * 0.082 + 3.7);
      let density = 0.11 + 0.52 * noise2(x * 0.19 + 9.3, y * 0.19 + 1.1) + 0.21 * noise2(x * 0.53, y * 0.53);
      if (gladeNoise > 0.615) density *= 0.08;
      if (distToWater[i] > 0 && distToWater[i] <= 2) density *= 0.32;

      const roll = rng();
      if (roll < density) {
        w.tiles[i] = pickTree(x, y, distToWater[i], rng);
        w.variant[i] = Math.floor(rng() * 3);
      } else if (roll < density + 0.018 && distToWater[i] > 2) {
        w.tiles[i] = TILE.ROCK;
      } else if (roll < density + 0.05 && distToWater[i] > 1) {
        w.tiles[i] = TILE.BUSH;
        w.variant[i] = Math.floor(rng() * 4);
      }
    }
  }

  // Dense, dark border so the world feels endless but stays bounded.
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      const edge = Math.min(x, y, w.w - 1 - x, w.h - 1 - y);
      if (edge < 2 || (edge === 2 && rng() < 0.75)) w.tiles[idx(x, y)] = TILE.BORDER;
    }
  }

  // ---- walkable reachability & collectibles ---------------------------
  w.reachable = reachableFrom(w, spawn.x, spawn.y);
  const reachableTiles = [];
  for (let y = 6; y < w.h - 6; y++) {
    for (let x = 6; x < w.w - 6; x++) {
      const i = idx(x, y);
      if (w.reachable[i] && w.tiles[i] !== TILE.BRIDGE) {
        reachableTiles.push({ x: x + 0.5, y: y + 0.5, water: distToWater[i] });
      }
    }
  }
  const chosen = [];
  const minSpawn = 6;
  const candidates = reachableTiles.filter((p) => Math.hypot(p.x - spawn.x, p.y - spawn.y) > minSpawn);
  if (candidates.length) chosen.push(candidates[Math.floor(rng() * candidates.length)]);
  while (chosen.length < 9 && candidates.length) {
    let best = null;
    let bestScore = -1;
    for (let s = 0; s < 220; s++) {
      const p = candidates[Math.floor(rng() * candidates.length)];
      if (chosen.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 5.5)) continue;
      let nearest = Infinity;
      for (const c of chosen) nearest = Math.min(nearest, Math.hypot(c.x - p.x, c.y - p.y));
      const score = nearest + Math.max(0, 6 - p.water) * 0.6 + rng() * 2.2;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) break;
    chosen.push(best);
  }
  w.collectibles = chosen.map((p, i) => ({ id: i, x: p.x, y: p.y, phase: rng() * Math.PI * 2 }));

  // Ambient fireflies gather near water and in the glades.
  const fireflies = [];
  for (let n = 0; n < 64; n++) {
    let x;
    let y;
    let tries = 0;
    do {
      x = 3 + rng() * (w.w - 6);
      y = 3 + rng() * (w.h - 6);
      tries++;
    } while (tries < 40 && (distToWater[idx(Math.floor(x), Math.floor(y))] > 5 || !w.reachable[idx(Math.floor(x), Math.floor(y))]));
    fireflies.push({
      x, y,
      height: 0.25 + rng() * 0.8,
      phase: rng() * Math.PI * 2,
      speed: 0.3 + rng() * 0.9,
      radius: 0.25 + rng() * 0.5,
      char: rng() < 0.25 ? 'o' : rng() < 0.55 ? '.' : '.',
    });
  }
  w.fireflies = fireflies;

  // Drifting pollen / petals.
  const motes = [];
  for (let n = 0; n < 38; n++) {
    const x = 3 + rng() * (w.w - 6);
    const y = 3 + rng() * (w.h - 6);
    motes.push({
      x, y,
      height: 0.3 + rng() * 1.5,
      phase: rng() * Math.PI * 2,
      speed: 0.05 + rng() * 0.14,
      drift: 0.15 + rng() * 0.3,
      char: rng() < 0.2 ? '*' : rng() < 0.55 ? '.' : "'",
    });
  }
  w.motes = motes;

  // ---- ground detail maps --------------------------------------------
  w.tone = new Uint8Array(w.w * w.h);
  w.waterEdge = new Uint8Array(w.w * w.h);
  for (let y = 1; y < w.h - 1; y++) {
    for (let x = 1; x < w.w - 1; x++) {
      const i = idx(x, y);
      const n = noise2(x * 0.17 + 3.4, y * 0.17 + 8.1);
      w.tone[i] = n > 0.58 ? 2 : n > 0.32 ? 1 : 0;
      if (w.tiles[i] === TILE.WATER) {
        w.waterEdge[i] =
          w.tiles[i - 1] !== TILE.WATER ||
          w.tiles[i + 1] !== TILE.WATER ||
          w.tiles[i - w.w] !== TILE.WATER ||
          w.tiles[i + w.w] !== TILE.WATER ? 1 : 0;
      }
    }
  }
  const treeStarts = new Set([TILE.OAK, TILE.PINE, TILE.BIRCH, TILE.WILLOW]);
  w.distToTree = bfsDistances(w, treeStarts);

  w.spawn = spawn;
  // Scenic first step: on the trail above the creek, bridge and river ahead.
  w.start = { x: 18.5, y: 36.5, angle: -1.35 };
  w.bridge = bridge;
  w.pool = pool;
  w.glade = glades[0];
  w.landmarks = glades;
  w.distToWater = distToWater;
  w.pathClear = pathClear;

  return w;
}

export function tileAt(w, x, y) {
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return TILE.BORDER;
  return w.tiles[(y | 0) * w.w + (x | 0)];
}

export function isSolidAt(w, x, y) {
  return SOLID[tileAt(w, x, y)] === 1;
}

export function isWalkableAt(w, x, y) {
  return WALKABLE[tileAt(w, x, y)] === 1;
}

export function zoneName(w, x, y) {
  const i = (y | 0) * w.w + (x | 0);
  const bridge = w.bridge;
  const bx = (bridge.x0 + bridge.x1) / 2;
  if (Math.hypot(x - bx, y - (bridge.y + 1)) < 5.2) return 'THE OLD BRIDGE';
  if (Math.hypot(x - w.pool.x, y - w.pool.y) < 9.5) return 'STILLWATER POOL';
  const dw = w.distToWater[i] ?? 99;
  if (dw >= 0 && dw <= 2) return 'RIVERBANK';
  let open = 0;
  for (let oy = -3; oy <= 3; oy++) {
    for (let ox = -3; ox <= 3; ox++) {
      if (isWalkableAt(w, x + ox, y + oy)) open++;
    }
  }
  if (open > 38) return 'SUNLIT GLADE';
  if (dw <= 5) return 'WILLOW BANK';
  return 'DEEP WOODS';
}
