// Canvas presentation layer. The raycaster hands us a grid of glyph and colour
// indices; this turns that into pixels using a pre-rendered glyph atlas.

import { CHARS } from './ascii.js';

export const FONT_STACK =
  '"IBM Plex Mono", "JetBrains Mono", "Cascadia Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.palette = null;
    this.atlas = null;
    this.cols = 0;
    this.rows = 0;
    this.dpr = 1;
    this.cellW = 0;
    this.cellH = 0;
    this.vw = 0;
    this.vh = 0;
    this.bgCanvas = document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.bgImage = null;
  }

  measure() {
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(300, window.innerHeight);

    let cols = clamp(Math.round(vw / 8.6), 40, 116);
    let rows = Math.round(cols * (vh / vw) * 0.66);
    if (rows > 64) {
      rows = 64;
      cols = clamp(Math.round((rows * (vw / vh)) / 0.66), 40, 140);
    }
    if (rows < 28) {
      rows = 28;
      cols = clamp(Math.round((rows * (vw / vh)) / 0.66), 40, 150);
    }

    const cellW = vw / cols;
    const cellH = vh / rows;
    const dpr = clamp(
      Math.min(window.devicePixelRatio || 1, 2, 30 / cellH, 18 / cellW),
      0.55,
      2,
    );
    return { vw, vh, cols, rows, cellW, cellH, dpr };
  }

  resize(renderer) {
    const m = this.measure();
    this.palette = renderer.palette;
    this.vw = m.vw;
    this.vh = m.vh;
    this.cols = m.cols;
    this.rows = m.rows;
    this.dpr = m.dpr;

    this.cellW = clamp(Math.round(m.cellW * m.dpr), 5, 20);
    this.cellH = clamp(Math.round(m.cellH * m.dpr), 8, 34);

    this.canvas.width = this.cols * this.cellW;
    this.canvas.height = this.rows * this.cellH;

    this.bgCanvas.width = this.cols;
    this.bgCanvas.height = this.rows;
    this.bgImage = this.bgCtx.createImageData(this.cols, this.rows);
    this.bgImage.data.fill(0);

    this.buildAtlas();
    return { cols: this.cols, rows: this.rows };
  }

  buildAtlas() {
    const palette = this.palette;
    const colorCount = palette.rgb.length;
    const glyphCount = CHARS.length;
    const cellW = this.cellW;
    const cellH = this.cellH;
    const maxDim = 4096;
    const rowsPerPage = Math.max(1, Math.floor(maxDim / cellH));
    const pageCount = Math.ceil(colorCount / rowsPerPage);
    const pageW = glyphCount * cellW;
    const fontPx = Math.max(6, Math.round(cellH * 0.82));
    const font = `500 ${fontPx}px ${FONT_STACK}`;
    const pages = [];

    for (let p = 0; p < pageCount; p++) {
      const start = p * rowsPerPage;
      const end = Math.min(colorCount, start + rowsPerPage);
      const page = document.createElement('canvas');
      page.width = pageW;
      page.height = (end - start) * cellH;
      const c = page.getContext('2d');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = font;

      for (let color = start; color < end; color++) {
        c.fillStyle = palette.css[color];
        const cy = (color - start) * cellH + cellH * 0.54;
        for (let g = 1; g < glyphCount; g++) {
          c.fillText(CHARS[g], g * cellW + cellW / 2, cy);
        }
      }
      pages.push(page);
    }

    this.atlas = {
      cellW,
      cellH,
      glyphCount,
      rowsPerPage,
      pages,
      fontPx,
      pageW,
      colorCount,
    };
  }

  skyStyle(horizonPx) {
    const pal = this.palette;
    const c = this.ctx;
    const top = pal.rgb[pal.offsets.skyTop];
    const mid = pal.rgb[pal.offsets.skyMid];
    const low = pal.rgb[pal.offsets.skyHorizon];
    const g = c.createLinearGradient(0, 0, 0, Math.max(1, horizonPx));
    g.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
    g.addColorStop(0.48, `rgb(${mid[0]},${mid[1]},${mid[2]})`);
    g.addColorStop(1, `rgb(${low[0]},${low[1]},${low[2]})`);
    return g;
  }

  groundStyle(horizonPx) {
    const pal = this.palette;
    const c = this.ctx;
    const deep = pal.rgb[pal.offsets.grassDeep];
    const g = c.createLinearGradient(0, horizonPx, 0, this.canvas.height);
    g.addColorStop(0, `rgb(${Math.round(deep[0] * 0.9)},${Math.round(deep[1] * 0.9)},${Math.round(deep[2] * 0.85)})`);
    g.addColorStop(0.35, `rgb(${Math.round(deep[0] * 0.55)},${Math.round(deep[1] * 0.55)},${Math.round(deep[2] * 0.55)})`);
    g.addColorStop(1, 'rgb(7, 15, 11)');
    return g;
  }

  drawBackground(frame) {
    const img = this.bgImage;
    const data = img.data;
    const rgb = this.palette.rgb;
    const bg = frame.bg;

    for (let i = 0, o = 0; i < bg.length; i++, o += 4) {
      const c = bg[i];
      if (c === 0) {
        data[o + 3] = 0;
        continue;
      }
      const col = rgb[c];
      data[o] = col[0];
      data[o + 1] = col[1];
      data[o + 2] = col[2];
      data[o + 3] = 238;
    }

    this.bgCtx.putImageData(img, 0, 0);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(this.bgCanvas, 0, 0, this.cols, this.rows, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
  }

  draw(frame) {
    if (!this.atlas || !this.bgImage) return;
    const ctx = this.ctx;
    const atlas = this.atlas;
    const pal = this.palette;
    const cw = this.cellW;
    const ch = this.cellH;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const horizonPx = clamp(frame.horizon * ch, 0, H);

    ctx.fillStyle = this.skyStyle(horizonPx);
    ctx.fillRect(0, 0, W, Math.ceil(horizonPx));
    if (horizonPx < H) {
      ctx.fillStyle = this.groundStyle(horizonPx);
      ctx.fillRect(0, Math.floor(horizonPx), W, H - Math.floor(horizonPx));
    }

    if (frame.sunX >= 0 && frame.sunY >= 0) {
      const sx = (frame.sunX + 0.5) * cw;
      const sy = (frame.sunY + 0.5) * ch;
      const radius = Math.max(cw, ch) * 11;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      glow.addColorStop(0, 'rgba(255, 244, 196, 0.46)');
      glow.addColorStop(0.22, 'rgba(250, 224, 150, 0.22)');
      glow.addColorStop(0.62, 'rgba(244, 214, 146, 0.08)');
      glow.addColorStop(1, 'rgba(244, 214, 146, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    }

    const haze = ctx.createLinearGradient(0, horizonPx - ch * 5, 0, horizonPx + ch * 2);
    haze.addColorStop(0, 'rgba(244, 228, 178, 0)');
    haze.addColorStop(0.62, 'rgba(244, 228, 178, 0.14)');
    haze.addColorStop(1, 'rgba(244, 228, 178, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, Math.max(0, horizonPx - ch * 5), W, ch * 7);

    this.drawBackground(frame);

    ctx.imageSmoothingEnabled = false;
    const rowsPerPage = atlas.rowsPerPage;
    const pages = atlas.pages;
    const chars = CHARS;

    for (let y = 0; y < this.rows; y++) {
      const dy = y * ch;
      const row = y * this.cols;
      for (let x = 0; x < this.cols; x++) {
        const i = row + x;
        const g = frame.chars[i];
        if (g === 0 || chars[g] === ' ') continue;
        const color = frame.colors[i];
        const pageIndex = (color / rowsPerPage) | 0;
        const page = pages[pageIndex];
        if (!page) continue;
        const sy = (color - pageIndex * rowsPerPage) * ch;
        ctx.drawImage(page, g * cw, sy, cw, ch, x * cw, dy, cw, ch);
      }
    }
  }
}
