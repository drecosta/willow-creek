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
  eq: ci('='),
  mid: ci('.'),
  at: ci('@'),
  hash: ci('#'),
  caret: ci('^'),
  slash: ci('/'),
  bslash: ci('\\'),
};

const SHADE = {
  leafHi: 'leafMid',
  leafMid: 'leafDark',
  leafDark: 'leafDeep',
  leafDeep: 'borderDeep',
  pineHi: 'pineMid',
  pineMid: 'pineDark',
  pineDark: 'pineDeep',
  pineDeep: 'pineDeep',
  birchHi: 'birchMid',
  birchMid: 'birchDark',
  birchDark: 'birchDeep',
  birchDeep: 'birchDeep',
  willowHi: 'willowMid',
  willowMid: 'willowDark',
  willowDark: 'willowDeep',
  willowStrand: 'willowMid',
  willowDeep: 'willowDeep',
  barkHi: 'barkMid',
  barkMid: 'barkDark',
  barkDark: 'barkDark',
  rockHi: 'rockMid',
  rockMid: 'rockDark',
  rockDark: 'rockDark',
  woodHi: 'woodMid',
  woodMid: 'woodDark',
  woodDark: 'woodDark',
  borderHi: 'borderMid',
  borderMid: 'borderDeep',
  borderDeep: 'borderDeep',
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
    for (const tile of [
      TILE.OAK,
      TILE.PINE,
      TILE.BIRCH,
      TILE.WILLOW,
      TILE.ROCK,
      TILE.BUSH,
      TILE.RAIL,
      TILE.BORDER,
    ]) {
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

    const cloudLimit = Math.max(0, Math.floor(horizon * 0.4));
    for (let y = 0; y < cloudLimit; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise2(x * 0.026 - yaw * 4.2 + t * 0.006, y * 0.1 + 6.4);
        if (n < 0.8) continue;
        const i = y * w + x;
        this.chars[i] = n > 0.86 ? C.dash : C.comma;
        this.colors[i] = pal.index(n > 0.86 ? 'cloudSoft' : 'cloud', 0);
      }
    }

    const sunAngle = state.sunAngle ?? -1.95;
    const delta = normalizeAngle(sunAngle - yaw);
    const edge = Math.atan(planeLen) + 0.09;
    if (Math.abs(delta) < edge && Math.cos(delta) > 0.05) {
      const sx = Math.floor((w / 2) * (1 + Math.tan(delta) / planeLen));
      const sy = Math.floor(horizon * 0.28);
      this.sunScreenX = sx;
      this.sunScreenY = sy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r = Math.hypot(dx, dy);
          if (r > 1.6) continue;
          const x = sx + dx;
          const y = sy + dy;
          if (x < 0 || y < 0 || x >= w || y >= horizon) continue;
          const i = y * w + x;
          if (r <= 0.6) {
            this.chars[i] = C.at;
            this.colors[i] = pal.index('sun', 0);
          } else {
            this.chars[i] = C.star;
            this.colors[i] = pal.index('sunGlow', 0);
          }
        }
      }
    } else {
      this.sunScreenX = -1;
      this.sunScreenY = -1;
    }

    for (let b = 0; b < 2; b++) {
      const speed = 2.4 + b * 0.8;
      const bx = Math.floor(((t * speed + b * 37) % (w + 28)) - 14);
      const by = Math.floor(horizon * 0.16 + b * 2 + Math.sin(t * 0.45 + b * 1.7) * 1.4);
      if (bx < 0 || bx >= w || by < 0 || by >= horizon) continue;
      const i = by * w + bx;
      if (this.chars[i] === 0) {
        this.chars[i] = Math.sin(t * 4.6 + b) > 0 ? C.caret : C.v;
        this.colors[i] = pal.index('bird', 0);
      }
    }


    const canopyBottom = Math.floor(horizon * 0.32);
    for (let y = 0; y < canopyBottom; y++) {
      const top = y / Math.max(1, canopyBottom);
      for (let x = 0; x < w; x++) {
        const edge = Math.abs((x + 0.5) / w - 0.5) * 2;
        if (edge < 0.38) continue;
        const side = (edge - 0.38) / 0.62;
        const n = noise2(x * 0.11 - yaw * 7.5 + 4.1, y * 0.36 + 2.6);
        if (n < 0.76 - side * 0.12 + top * 0.06) continue;
        const i = y * w + x;
        const detail = noise2(x * 0.31 + 8.4, y * 0.72 - 1.1);
        this.chars[i] = detail < 0.4 ? C.comma : detail < 0.76 ? C.quote : C.dot;
        this.colors[i] = pal.index(detail > 0.62 ? 'leafDark' : 'leafDeep', 0);
      }
    }
  }

  drawFloor(world, state) {
    const { w, h } = this;
    const pal = this.palette;
    const horizon = this.horizon;
    const projScale = h * 0.94;
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
      if (offset < 0.4) continue;
      const rowDist = (0.5 * projScale) / offset;
      if (rowDist > 44) continue;
      const fog = pal.fogLevel(rowDist);
      const planeLen = Math.hypot(planeX, planeY) || 0.66;
      const fineFreq = clamp(w / (2 * rowDist * planeLen), 3.6, 48);
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
        const patch = hash2(Math.floor(fx * 2.1), Math.floor(fy * 2.1));

        if (tile === TILE.WATER) {
          const wave =
            Math.sin(fx * 3.6 + time * 1.12) +
            Math.sin(fy * 4.4 - time * 0.9) +
            (n - 0.5) * 0.7;
          let ch;
          let colorName;
          if (wave > 1.4) {
            ch = C.tilde;
            colorName = 'waterHi';
          } else if (wave > 0.2) {
            ch = C.tilde;
            colorName = 'waterMid';
          } else if (wave > -0.6) {
            ch = C.dash;
            colorName = 'waterMid';
          } else {
            ch = C.dot;
            colorName = 'waterDeep';
          }
          const edge = world.waterEdge && world.waterEdge[ti];
          if (edge && wave > -0.4) {
            ch = C.tilde;
            colorName = 'waterFoam';
          }
          if (n < 0.008) {
            ch = C.star;
            colorName = 'waterGlint';
          }
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fog);
          this.bg[i] = pal.index('waterDeep', fog);
        } else if (tile === TILE.SAND) {
          const ch = n < 0.62 ? C.dot : C.comma;
          const colorName = patch < 0.36 ? 'sandHi' : patch < 0.8 ? 'sandMid' : 'sandDark';
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fog);
          this.bg[i] = pal.index('sandDark', fog);
        } else if (tile === TILE.PATH) {
          const ch = n < 0.58 ? C.dot : n < 0.9 ? C.dash : C.comma;
          const colorName = patch < 0.42 ? 'pathHi' : patch < 0.84 ? 'pathMid' : 'pathDark';
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fog);
          this.bg[i] = pal.index('pathDark', fog);
        } else if (tile === TILE.BRIDGE) {
          const seam = Math.floor(fx * 3.2) % 5 === 0;
          const ch = seam ? C.pipe : C.eq;
          const colorName = seam ? 'woodMid' : patch < 0.4 ? 'woodHi' : 'woodMid';
          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fog);
          this.bg[i] = pal.index('woodDark', fog);
        } else if (
          tile === TILE.OAK ||
          tile === TILE.PINE ||
          tile === TILE.BIRCH ||
          tile === TILE.WILLOW ||
          tile === TILE.BORDER ||
          tile === TILE.ROCK ||
          tile === TILE.BUSH
        ) {
          this.chars[i] = C.dot;
          this.colors[i] = pal.index('grassDeep', fog);
          this.bg[i] = pal.index('grassDeep', fog);
        } else {
          const dt = world.distToTree ? world.distToTree[ti] : 99;
          const dw = world.distToWater ? world.distToWater[ti] : 99;
          const tone = world.tone ? world.tone[ti] : 0;
          let ch;
          if (n < 0.4) ch = C.dot;
          else if (n < 0.82) ch = C.comma;
          else ch = C.quote;

          let colorName;
          if (dt >= 0 && dt <= 1) colorName = 'grassDark';
          else if (dt === 2) colorName = 'grassMid';
          else if (tone === 2) colorName = patch > 0.52 ? 'grassDry' : 'grassMid';
          else if (tone === 1) colorName = patch > 0.62 ? 'grassHi' : 'grassMid';
          else colorName = patch > 0.48 ? 'grassHi' : 'grassMid';

          if (dw >= 0 && dw <= 1 && n > 0.88) {
            ch = C.bang;
            colorName = 'reeds';
          }
          if (dw > 1 && dt > 2 && n > 0.96) {
            ch = C.dot;
            const f = hash2(tx + 71, ty - 47);
            colorName = f < 0.36 ? 'flowerWhite' : f < 0.68 ? 'flowerYellow' : 'flowerPink';
          }

          this.chars[i] = ch;
          this.colors[i] = pal.index(colorName, fog);
          this.bg[i] = pal.index('grassDeep', fog);
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
    const projScale = h * 0.94;
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

      if (rayX < 0) {
        stepX = -1;
        sideX = (px - mapX) * deltaX;
      } else {
        stepX = 1;
        sideX = (mapX + 1 - px) * deltaX;
      }
      if (rayY < 0) {
        stepY = -1;
        sideY = (py - mapY) * deltaY;
      } else {
        stepY = 1;
        sideY = (mapY + 1 - py) * deltaY;
      }

      let side = 0;
      let tile = TILE.BORDER;
      let hit = false;
      for (let steps = 0; steps < 150; steps++) {
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
        hf *= 0.95 + ((variant % 3) * 0.05);
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
        const i = y * w + x;
        if (ch === 0) {
          if (t > 0.34 && tile !== TILE.RAIL) {
            const n = hash2(mapX * 31 + texX, mapY * 17 + y);
            const base = n < 0.5 ? 'grassDeep' : 'leafDeep';
            this.chars[i] = n < 0.62 ? C.dot : C.comma;
            this.colors[i] = pal.index(side === 0 ? SHADE[base] || base : base, fog);
            this.bg[i] = pal.index(side === 0 ? SHADE.leafDeep : 'leafDeep', fog);
          }
          continue;
        }
        const colorName = cache.colorNames[o];
        if (!colorName) continue;
        this.chars[i] = ch;
        const drawnName = side === 0 ? SHADE[colorName] || colorName : colorName;
        this.colors[i] = pal.index(drawnName, fog);

        let bgName = 'leafDeep';
        if (tile === TILE.PINE) bgName = 'pineDeep';
        else if (tile === TILE.ROCK) bgName = 'rockDark';
        else if (tile === TILE.RAIL) bgName = 'woodDark';
        else if (tile === TILE.BUSH) bgName = 'leafDeep';
        else if (tile === TILE.BORDER) bgName = 'borderDeep';
        else if (tile === TILE.OAK || tile === TILE.BIRCH || tile === TILE.WILLOW) bgName = 'leafDeep';
        const bgDrawn = side === 0 ? SHADE[bgName] || bgName : bgName;
        this.bg[i] = pal.index(bgDrawn, fog);
      }

    }
  }

  drawSprites(world, state) {
    const { w, h } = this;
    const pal = this.palette;
    const horizon = this.horizon;
    const projScale = h * 0.94;
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
      if (ty <= 0.14) return;
      const sx = Math.floor((w / 2) * (1 + tx / ty));
      if (sx < -3 || sx > w + 3) return;
      const sy = Math.floor(horizon + (0.5 - height) * (projScale / ty));
      if (sy < -2 || sy > h + 2) return;
      list.push({ sx, sy, depth: ty, type, ...extra });
    };

    for (const c of world.collectibles || []) {
      if (collected && collected.has(c.id)) continue;
      const bob = Math.sin(time * 1.18 + c.phase) * 0.05;
      project(c.x, c.y, 0.58 + bob, 'collect', { phase: c.phase });
    }
    for (const f of world.fireflies || []) {
      const driftX = Math.cos(time * 0.26 + f.phase) * f.radius * 0.28;
      const driftY = Math.sin(time * 0.21 + f.phase * 1.2) * f.radius * 0.24;
      project(f.x + driftX, f.y + driftY, f.height, 'firefly', { phase: f.phase });
    }
    for (const m of world.motes || []) {
      if ((Math.floor(time * 0.4) + Math.floor(m.x * 13)) % 3 === 0) continue;
      const driftX = Math.sin(time * 0.07 + m.phase) * m.drift * 0.6;
      const driftY = Math.cos(time * 0.06 + m.phase) * m.drift * 0.4;
      project(m.x + driftX, m.y + driftY, m.height, 'mote', { phase: m.phase });
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
        const twinkle = Math.sin(time * 2.8 + s.phase);
        if (twinkle < -0.6) continue;
        const ch = twinkle > 0.25 ? C.star : C.dot;
        put(s.sx, s.sy, ch, twinkle > 0.25 ? 'spirit' : 'firefly', fog, s.depth);
      } else if (s.type === 'mote') {
        const fade = Math.sin(time * 0.4 + s.phase);
        if (fade < -0.7) continue;
        put(s.sx, s.sy, C.dot, 'pollen', Math.min(4, fog + 1), s.depth);
      } else if (s.type === 'collect') {
        const pulse = Math.sin(time * 1.6 + s.phase);
        const level = Math.min(2, pal.fogLevel(s.depth));
        put(s.sx, s.sy, pulse > 0.2 ? C.at : C.star, pulse > 0.2 ? 'sunGlow' : 'spirit', level, s.depth);
      }
    }
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
