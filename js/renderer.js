// ASCII raycaster. It fills a grid of character indices + palette indices that
// the canvas view (or the terminal preview tool) turns into pixels.

import { TILE, isSolidAt, tileAt, hash2, noise2 } from './world.js';
import { buildPalette } from './palette.js';
import { WALL_TEXTURES } from './textures.js';
import { CHAR_INDEX } from './ascii.js';

const TWO_PI = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const fract = (v) => v - Math.floor(v);

const ci = (ch) => {
  const i = CHAR_INDEX.get(ch);
  if (i === undefined) throw new Error(`Glyph missing from atlas: ${JSON.stringify(ch)}`);
  return i;
};

const C = {
  dot: ci('.'),
  comma: ci(','),
  quote: ci("'"),
  dquote: ci('"'),
  backtick: ci('`'),
  semi: ci(';'),
  colon: ci(':'),
  v: ci('v'),
  bigY: ci('Y'),
  pipe: ci('|'),
  bang: ci('!'),
  star: ci('*'),
  o: ci('o'),
  plus: ci('+'),
  under: ci('_'),
  tilde: ci('~'),
  dash: ci('-'),
  approx: ci('~'),
  eq: ci('='),
  mid: ci('.'),
  at: ci('@'),
  caret: ci('^'),
  bullet: ci('*'),
};

const normalizeAngle = (a) => {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
};

export class Renderer {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.palette = buildPalette();
    this.chars = new Uint16Array(width * height);
    this.colors = new Uint16Array(width * height);
    this.bg = new Uint16Array(width * height);
    this.zBuffer = new Float32Array(width);
    this.sprites = [];
    this.horizon = height * 0.44;
    this.sunScreenX = -1;
    this.sunScreenY = -1;
    this.time = 0;

    this.textures = {};
    for (const tile of [TILE.OAK, TILE.PINE, TILE.BIRCH, TILE.WILLOW, TILE.ROCK, TILE.BUSH, TILE.RAIL, TILE.BORDER]) {
      const tex = WALL_TEXTURES[tile];
      const n = tex.width * tex.rows.length;
      const charIdx = new Uint16Array(n);
      const colorNames = new Array(n);
      for (let y = 0; y < tex.rows.length; y++) {
        const row = tex.rows[y];
        for (let x = 0; x < tex.width; x++) {
          const ch = row[x];
          const o = y * tex.width + x;
          if (ch === ' ') {
            charIdx[o] = 0;
            colorNames[o] = null;
          } else {
            charIdx[o] = ci(ch);
            colorNames[o] = tex.colors[ch] || null;
            if (!colorNames[o]) throw new Error(`No colour for "${ch}" in texture ${tile}`);
          }
        }
      }
      this.textures[tile] = {
        tex,
        charIdx,
        colorNames,
        tw: tex.width,
        th: tex.rows.length,
        baseHeight: tex.height,
        vGamma: tex.vGamma || 1,
      };
    }
  }

  clear() {
    this.chars.fill(0);
    this.colors.fill(0);
    this.bg.fill(0);
    this.zBuffer.fill(1e30);
    this.sprites.length = 0;
  }

  drawSky(state) {
    const { w, h } = this;
    const pal = this.palette;
    const horizon = this.horizon;
    const yaw = state.yaw;
    const planeLen = Math.hypot(state.planeX, state.planeY) || 0.66;
    const t = state.time;

    // Wispy clouds that slide as you turn.
    const maxY = Math.max(0, Math.floor(horizon) - 1);
    for (let y = 0; y < maxY; y++) {
      const wy = y * 0.19 + 4.3;
      for (let x = 0; x < w; x++) {
        const wx = x * 0.042 - yaw * 8.4 + t * 0.012;
        const n = noise2(wx, wy);
        if (n < 0.755) continue;
        const i = y * w + x;
        if (n > 0.83) {
          this.chars[i] = C.tilde;
          this.colors[i] = pal.index('cloud', 0);
        } else if (n > 0.79) {
          this.chars[i] = C.dash;
          this.colors[i] = pal.index('cloud', 0);
        } else {
          this.chars[i] = C.dot;
          this.colors[i] = pal.index('skyHorizon', 0);
        }
      }
    }

    // Sun sits at a fixed compass bearing.
    const sunAngle = state.sunAngle ?? -1.95;
    const delta = normalizeAngle(sunAngle - yaw);
    const edge = Math.atan(planeLen) + 0.12;
    if (Math.abs(delta) < edge && Math.cos(delta) > 0.05) {
      const sx = Math.floor((w / 2) * (1 + Math.tan(delta) / planeLen));
      const sy = Math.floor(horizon * 0.3 + Math.sin(t * 0.05) * 0.8);
      this.sunScreenX = sx;
      this.sunScreenY = sy;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const r = Math.hypot(dx, dy);
          if (r > 2.45) continue;
          const x = sx + dx;
          const y = sy + dy;
          if (x < 0 || y < 0 || x >= w || y >= horizon) continue;
          let ch;
          let col;
          if (r <= 0.8) { ch = C.at; col = pal.index('sun', 0); }
          else if (r <= 1.5) { ch = C.star; col = pal.index('sunGlow', 0); }
          else { ch = C.mid; col = pal.index('sunGlow', 0); }
          const i = y * w + x;
          this.chars[i] = ch;
          this.colors[i] = col;
        }
      }
    } else {
      this.sunScreenX = -1;
      this.sunScreenY = -1;
    }

    // A few birds crossing the sunlit sky.
    for (let b = 0; b < 3; b++) {
      const speed = 3.2 + b * 1.4;
      const bx = Math.floor(((t * speed + b * 41) % (w + 36)) - 18);
      const by = Math.floor(horizon * 0.16 + b * 3.2 + Math.sin(t * 0.7 + b * 2.1) * 2.2);
      if (bx < 0 || bx >= w || by < 0 || by >= horizon) continue;
      const ch = Math.sin(t * 7.5 + b * 1.7) > 0 ? C.caret : C.v;
      const i = by * w + bx;
      if (this.chars[i] === 0) {
        this.chars[i] = ch;
        this.colors[i] = pal.index('bird', 0);
      }
    }

    // Overhanging boughs at the top of the frame. This is the layer that makes
    // even an open glade feel like it is inside a forest.
    const canopyBottom = Math.floor(horizon * 0.66);
    for (let y = 0; y < canopyBottom; y++) {
      const depth = 1 - y / Math.max(1, canopyBottom);
      const threshold = 0.75 - depth * 0.12;
      const wy = y * 0.36 + 2.2;
      for (let x = 0; x < w; x++) {
        const n = noise2(x * 0.105 - yaw * 7.2 + 3.7, wy + t * 0.004);
        const detail = noise2(x * 0.29 + 8.1, y * 0.67 - 1.4);
        if (n < threshold + (detail - 0.5) * 0.09) continue;
        const i = y * w + x;
        let ch;
        if (detail < 0.3) ch = C.comma;
        else if (detail < 0.56) ch = C.quote;
        else if (detail < 0.8) ch = C.dot;
        else ch = C.semi;
        this.chars[i] = ch;
        this.colors[i] = pal.index(detail > 0.7 ? 'leafDark' : detail > 0.45 ? 'leafDeep' : 'borderMid', 0);
      }
    }
  }

  drawFloor(world, state) {
    const { w, h } = this;
    const pal = this.palette;
    const horizon = this.horizon;
    const projScale = h * 0.92;
    const px = state.px;
    const py = state.py;
    const dirX = state.dirX;
    const dirY = state.dirY;
    const planeX = state.planeX;
    const planeY = state.planeY;
    const time = state.time;

    const yStart = Math.max(0, Math.ceil(horizon) + 1);
    for (let y = yStart; y < h; y++) {
      const offset = y - horizon;
      if (offset < 0.35) continue;
      const rowDist = (0.5 * projScale) / offset;
      if (rowDist > 48) continue;
      const fog = pal.fogLevel(rowDist);
      const fogIdx = fog;
      const planeLen = Math.hypot(planeX, planeY) || 0.66;
      const fineFreq = clamp(w / (2 * rowDist * planeLen), 4, 64);
      let fx = px + rowDist * (dirX - planeX);
      let fy = py + rowDist * (dirY - planeY);
      const stepX = (rowDist * 2 * planeX) / w;
      const stepY = (rowDist * 2 * planeY) / w;

      for (let x = 0; x < w; x++) {
        const tx = Math.floor(fx);
        const ty = Math.floor(fy);
        const i = y * w + x;
        if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) {
          this.chars[i] = C.dot;
          this.colors[i] = pal.index('fog', 0);
          this.bg[i] = pal.index('fog', 0);
          fx += stepX;
          fy += stepY;
          continue;
        }
        const ti = ty * world.w + tx;
        const tile = world.tiles[ti];
        const n = hash2(Math.floor(fx * fineFreq), Math.floor(fy * fineFreq));
        const patch = hash2(Math.floor(fx * 2.4), Math.floor(fy * 2.4));
        const tileHash = hash2(tx * 13 + 7, ty * 17 - 3);

        if (tile === TILE.WATER) {
          const wave =
            Math.sin(fx * 4.1 + time * 1.45) +
            Math.sin(fy * 5.3 - time * 1.1) +
            Math.sin((fx + fy) * 2.4 + time * 0.7) +
            (n - 0.5) * 0.9;
          let ch;
          let colorName;
          if (wave > 1.9) { ch = C.approx; colorName = 'waterHi'; }
          else if (wave > 0.55) { ch = C.tilde; colorName = 'waterHi'; }
          else if (wave > -0.55) { ch = C.dash; colorName = 'waterMid'; }
          else { ch = C.dot; colorName = 'waterDeep'; }
          const edge = world.waterEdge && world.waterEdge[ti];
          if (edge) colorName = wave > -0.1 ? 'waterFoam' : 'waterHi';
          if (n < 0.009) {
            ch = C.star;
            colorName = 'waterGlint';
            this.chars[i] = ch;
            this.colors[i] = pal.index(colorName, Math.min(2, fogIdx));
            this.bg[i] = pal.index('waterDeep', fogIdx);
            fx += stepX;
            fy += stepY;
            continue;
          }
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fogIdx);
          this.bg[i] = pal.index('waterDeep', fogIdx);
        } else if (tile === TILE.SAND) {
          let ch;
          if (n < 0.18) ch = C.tilde;
          else if (n < 0.46) ch = C.dot;
          else if (n < 0.72) ch = C.colon;
          else if (n < 0.9) ch = C.dash;
          else ch = C.o;
          let colorName = patch < 0.32 ? 'sandHi' : patch < 0.78 ? 'sandMid' : 'sandDark';
          if (world.distToWater[ti] === 1) colorName = 'sandDark';
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fogIdx);
          this.bg[i] = pal.index('sandDark', fogIdx);
        } else if (tile === TILE.PATH) {
          let ch;
          if (n < 0.26) ch = C.dot;
          else if (n < 0.54) ch = C.colon;
          else if (n < 0.74) ch = C.backtick;
          else if (n < 0.92) ch = C.quote;
          else ch = C.o;
          let colorName = patch < 0.4 ? 'pathHi' : patch < 0.8 ? 'pathMid' : 'pathDark';
          if (ch === C.o) colorName = 'pebble';
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fogIdx);
          this.bg[i] = pal.index('pathDark', fogIdx);
        } else if (tile === TILE.BRIDGE) {
          const seam = Math.floor(fx * 3 + 0.35) % 3 === 0;
          let ch = seam ? C.pipe : C.eq;
          let colorName = seam ? 'woodDark' : patch < 0.35 ? 'woodHi' : 'woodMid';
          if (n < 0.025) { ch = C.o; colorName = 'woodNail'; }
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fogIdx);
          this.bg[i] = pal.index('woodDark', fogIdx);
        } else if (tile === TILE.OAK || tile === TILE.PINE || tile === TILE.BIRCH || tile === TILE.WILLOW || tile === TILE.BORDER) {
          let ch;
          if (n < 0.25) ch = C.comma;
          else if (n < 0.5) ch = C.dot;
          else if (n < 0.72) ch = C.quote;
          else ch = C.backtick;
          this.chars[i] = ch;
          this.colors[i] = pal.index(n > 0.72 ? 'grassDeep' : 'borderDeep', fogIdx);
          this.bg[i] = pal.index('borderDeep', fogIdx);
        } else {
          const dt = world.distToTree ? world.distToTree[ti] : 99;
          const dw = world.distToWater ? world.distToWater[ti] : 99;
          const tone = world.tone ? world.tone[ti] : 0;
          let ch;
          if (n < 0.17) ch = C.quote;
          else if (n < 0.36) ch = C.comma;
          else if (n < 0.56) ch = C.dot;
          else if (n < 0.69) ch = C.backtick;
          else if (n < 0.8) ch = C.dquote;
          else if (n < 0.89) ch = C.semi;
          else if (n < 0.96) ch = C.v;
          else ch = C.bigY;

          let colorName;
          if (dt >= 0 && dt <= 1) colorName = 'grassDeep';
          else if (dt === 2) colorName = 'grassDark';
          else if (tone === 2) colorName = patch > 0.5 ? 'grassDry' : 'grassMid';
          else if (tone === 1) colorName = patch > 0.6 ? 'grassHi' : 'grassMid';
          else colorName = patch > 0.45 ? 'grassHi' : 'grassMid';

          // Leaf litter in the deep shade.
          if (dt >= 0 && dt <= 1 && n > 0.91) {
            ch = C.comma;
            colorName = 'pathDark';
          }
          // Reeds at the water's edge.
          if (dw >= 0 && dw <= 1 && tileHash > 0.84) {
            ch = tileHash > 0.92 ? C.pipe : C.bang;
            colorName = 'reeds';
          }
          // Tiny flowers in sunny glades.
          if (dw > 1 && dt > 2 && tileHash > 0.945) {
            ch = tileHash > 0.975 ? C.star : C.o;
            const f = hash2(tx + 91, ty - 33);
            colorName = f < 0.32 ? 'flowerPink' : f < 0.58 ? 'flowerYellow' : f < 0.82 ? 'flowerWhite' : 'flowerViolet';
          }
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fogIdx);
          this.bg[i] = pal.index(colorName === 'grassHi' ? 'grassDark' : 'grassDeep', fogIdx);
        }
        fx += stepX;
        fy += stepY;
      }
    }
  }

  drawWalls(world, state) {
    const { w, h } = this;
    const pal = this.palette;
    const horizon = this.horizon;
    const projScale = h * 0.92;
    const px = state.px;
    const py = state.py;
    const dirX = state.dirX;
    const dirY = state.dirY;
    const planeX = state.planeX;
    const planeY = state.planeY;

    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rayX = dirX + planeX * cameraX;
      const rayY = dirY + planeY * cameraX;

      let mapX = Math.floor(px);
      let mapY = Math.floor(py);
      const deltaX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
      const deltaY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
      let stepX;
      let stepY;
      let sideX;
      let sideY;

      if (rayX < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
      else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
      if (rayY < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
      else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }

      let side = 0;
      let tile = TILE.BORDER;
      let hit = false;
      for (let steps = 0; steps < 160; steps++) {
        if (sideX < sideY) {
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (isSolidAt(world, mapX, mapY)) {
          tile = tileAt(world, mapX, mapY);
          hit = true;
          break;
        }
      }
      if (!hit) continue;

      let perp = side === 0 ? sideX - deltaX : sideY - deltaY;
      if (perp < 0.0001) perp = 0.0001;
      this.zBuffer[x] = perp;

      let wallX = side === 0 ? py + perp * rayY : px + perp * rayX;
      wallX -= Math.floor(wallX);

      const cache = this.textures[tile] || this.textures[TILE.BORDER];
      let texX = Math.floor(wallX * cache.tw);
      if (texX < 0) texX = 0;
      if (texX >= cache.tw) texX = cache.tw - 1;
      if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = cache.tw - texX - 1;
      const variant = world.variant ? world.variant[mapY * world.w + mapX] : 0;
      if (variant & 1) texX = cache.tw - texX - 1;

      let hf = cache.baseHeight;
      if (tile === TILE.OAK || tile === TILE.PINE || tile === TILE.BIRCH || tile === TILE.WILLOW) {
        hf *= 0.94 + ((variant % 3) * 0.055);
      }

      const lineH = projScale / perp;
      const bottom = horizon + lineH * 0.5;
      const top = bottom - lineH * hf;
      let startY = Math.max(0, Math.floor(top));
      let endY = Math.min(h - 1, Math.ceil(bottom));
      if (endY < startY) continue;

      const fog = pal.fogLevel(perp);
      const span = bottom - top;
      if (span <= 0) continue;

      for (let y = startY; y <= endY; y++) {
        const t = clamp((y - top) / span, 0, 0.9999);
        const vt = cache.vGamma === 1 ? t : Math.pow(t, cache.vGamma);
        const texY = Math.min(cache.th - 1, Math.floor(vt * cache.th));
        const o = texY * cache.tw + texX;
        const ch = cache.charIdx[o];
        if (ch === 0) continue;
        const colorName = cache.colorNames[o];
        if (!colorName) continue;
        const i = y * w + x;
        this.chars[i] = ch;
        this.colors[i] = pal.index(colorName, fog);
        let bgName = 'leafDeep';
        if (tile === TILE.PINE) bgName = 'pineDeep';
        else if (tile === TILE.ROCK) bgName = 'rockDark';
        else if (tile === TILE.RAIL || tile === TILE.BRIDGE) bgName = 'woodDark';
        else if (tile === TILE.BORDER) bgName = 'borderDeep';
        else if (tile === TILE.OAK || tile === TILE.BIRCH || tile === TILE.WILLOW || tile === TILE.BUSH) bgName = 'leafDeep';
        this.bg[i] = pal.index(bgName, fog);
      }
    }
  }

  drawSprites(world, state) {
    const { w, h } = this;
    const pal = this.palette;
    const horizon = this.horizon;
    const projScale = h * 0.92;
    const px = state.px;
    const py = state.py;
    const dirX = state.dirX;
    const dirY = state.dirY;
    const planeX = state.planeX;
    const planeY = state.planeY;
    const time = state.time;
    const collected = state.collected;
    const invDet = 1 / (planeX * dirY - dirX * planeY);

    const list = this.sprites;
    list.length = 0;

    const project = (x, y, height, type, extra) => {
      const dx = x - px;
      const dy = y - py;
      const tx = invDet * (dirY * dx - dirX * dy);
      const ty = invDet * (-planeY * dx + planeX * dy);
      if (ty <= 0.12) return;
      const sx = Math.floor((w / 2) * (1 + tx / ty));
      if (sx < -2 || sx > w + 2) return;
      const sy = Math.floor(horizon + (0.5 - height) * (projScale / ty));
      if (sy < -2 || sy > h + 2) return;
      list.push({ sx, sy, depth: ty, type, ...extra });
    };

    for (const c of world.collectibles || []) {
      if (collected && collected.has(c.id)) continue;
      const bob = Math.sin(time * 1.35 + c.phase) * 0.07;
      project(c.x, c.y, 0.62 + bob, 'collect', { phase: c.phase });
    }
    for (const f of world.fireflies || []) {
      const driftX = Math.cos(time * 0.31 + f.phase) * f.radius * 0.35;
      const driftY = Math.sin(time * 0.24 + f.phase * 1.3) * f.radius * 0.35;
      const bob = Math.sin(time * 0.8 + f.phase) * 0.06;
      project(f.x + driftX, f.y + driftY, f.height + bob, 'firefly', { phase: f.phase, char: f.char });
    }
    for (const m of world.motes || []) {
      const driftX = Math.sin(time * m.speed + m.phase) * m.drift;
      const driftY = Math.cos(time * m.speed * 0.83 + m.phase) * m.drift;
      const bob = Math.sin(time * 0.5 + m.phase) * 0.12;
      project(m.x + driftX, m.y + driftY, m.height + bob, 'mote', { phase: m.phase, char: m.char });
    }

    list.sort((a, b) => b.depth - a.depth);

    const put = (x, y, ch, colorName, level, depth) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      if (depth >= this.zBuffer[x]) return;
      const i = y * w + x;
      this.chars[i] = ch;
      this.colors[i] = pal.index(colorName, level);
    };

    for (const s of list) {
      const fog = Math.min(2, pal.fogLevel(s.depth));
      if (s.type === 'firefly') {
        const twinkle = Math.sin(time * 4.1 + s.phase) * 0.5 + Math.sin(time * 2.2 + s.phase * 1.7) * 0.5;
        if (twinkle < -0.55) continue;
        let ch = s.char === 'o' ? C.o : s.char === '.' ? C.mid : C.dot;
        let colorName = 'firefly';
        if (twinkle > 0.35) { ch = C.star; colorName = 'spirit'; }
        put(s.sx, s.sy, ch, colorName, fog, s.depth);
      } else if (s.type === 'mote') {
        const fade = Math.sin(time * 0.6 + s.phase);
        if (fade < -0.5) continue;
        const ch = s.char === '*' ? C.star : s.char === '.' ? C.mid : C.quote;
        put(s.sx, s.sy, ch, 'pollen', Math.min(3, pal.fogLevel(s.depth) + 1), s.depth);
      } else if (s.type === 'collect') {
        const pulse = Math.sin(time * 2.1 + s.phase);
        const bright = pulse > 0.1;
        const level = Math.min(2, pal.fogLevel(s.depth));
        put(s.sx, s.sy, bright ? C.at : C.bullet, bright ? 'sunGlow' : 'spirit', level, s.depth);
        put(s.sx - 1, s.sy, C.mid, 'spirit', level, s.depth);
        put(s.sx + 1, s.sy, C.mid, 'spirit', level, s.depth);
        put(s.sx, s.sy - 1, C.dot, 'spirit', level, s.depth);
        put(s.sx, s.sy + 1, C.dot, 'spirit', level, s.depth);
        if (s.depth < 8) {
          put(s.sx - 1, s.sy - 1, C.dot, 'firefly', Math.min(3, level + 1), s.depth);
          put(s.sx + 1, s.sy - 1, C.dot, 'firefly', Math.min(3, level + 1), s.depth);
          put(s.sx - 1, s.sy + 1, C.dot, 'firefly', Math.min(3, level + 1), s.depth);
          put(s.sx + 1, s.sy + 1, C.dot, 'firefly', Math.min(3, level + 1), s.depth);
        }
      }
    }
  }

  fogLevel(dist) {
    return this.palette.fogLevel(dist);
  }

  render(world, state) {
    this.time = state.time;
    this.horizon = this.h * 0.44 + (state.horizonOffset || 0);
    this.clear();
    this.drawSky(state);
    this.drawFloor(world, state);
    this.drawWalls(world, state);
    this.drawSprites(world, state);
    return {
      chars: this.chars,
      colors: this.colors,
      bg: this.bg,
      width: this.w,
      height: this.h,
      horizon: this.horizon,
      sunX: this.sunScreenX,
      sunY: this.sunScreenY,
    };
  }
}
