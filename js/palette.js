// Shared colour palette. Every colour is pre-mixed through a small fog ramp so
// distant chars dissolve into warm forest haze instead of hard edges.

export const COLORS = {
  leafHi: [158, 208, 112],
  leafMid: [104, 170, 84],
  leafDark: [58, 118, 64],
  leafDeep: [30, 68, 48],

  pineHi: [82, 164, 112],
  pineMid: [44, 118, 88],
  pineDark: [26, 78, 64],
  pineDeep: [15, 48, 42],

  birchHi: [188, 224, 126],
  birchMid: [142, 194, 102],
  birchDark: [92, 146, 80],
  birchDeep: [52, 96, 56],

  willowHi: [170, 214, 142],
  willowMid: [116, 176, 122],
  willowDark: [70, 128, 98],
  willowStrand: [150, 200, 156],
  willowDeep: [38, 78, 62],

  barkHi: [146, 104, 66],
  barkMid: [104, 72, 48],
  barkDark: [66, 46, 34],

  birchBark: [218, 210, 176],
  birchMark: [62, 56, 48],

  rockHi: [160, 162, 150],
  rockMid: [116, 118, 110],
  rockDark: [76, 78, 74],
  moss: [104, 132, 72],

  borderHi: [38, 72, 52],
  borderMid: [24, 50, 40],
  borderDeep: [13, 30, 27],

  grassHi: [138, 186, 88],
  grassMid: [100, 154, 72],
  grassDark: [68, 118, 58],
  grassDeep: [46, 88, 50],
  grassDry: [162, 168, 96],

  flowerPink: [230, 150, 172],
  flowerYellow: [236, 210, 112],
  flowerWhite: [238, 240, 218],
  flowerViolet: [182, 154, 220],

  reeds: [120, 158, 88],

  sandHi: [224, 208, 160],
  sandMid: [198, 178, 128],
  sandDark: [158, 138, 98],

  pathHi: [178, 150, 104],
  pathMid: [144, 118, 82],
  pathDark: [106, 86, 60],
  pebble: [170, 170, 156],

  waterDeep: [26, 80, 98],
  waterMid: [42, 118, 126],
  waterHi: [78, 156, 154],
  waterFoam: [190, 224, 206],
  waterGlint: [250, 236, 174],

  woodHi: [164, 120, 72],
  woodMid: [124, 88, 54],
  woodDark: [82, 58, 40],
  woodNail: [196, 190, 168],

  skyTop: [44, 96, 116],
  skyMid: [112, 160, 156],
  skyHorizon: [244, 228, 178],
  sun: [255, 246, 190],
  sunGlow: [248, 218, 138],
  cloud: [240, 238, 214],
  bird: [62, 72, 68],

  firefly: [255, 232, 132],
  spirit: [255, 242, 186],
  pollen: [248, 238, 196],

  fog: [204, 210, 168],
};

export const FOG_STEPS = 6;
const NO_FOG = new Set(['skyTop', 'skyMid', 'skyHorizon', 'sun', 'sunGlow', 'cloud', 'bird', 'fog']);

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function buildPalette() {
  const names = Object.keys(COLORS);
  const rgb = [];
  const css = [];
  const offsets = {};
  const steps = {};
  const fog = COLORS.fog;

  for (const name of names) {
    offsets[name] = rgb.length;
    const n = NO_FOG.has(name) ? 1 : FOG_STEPS;
    steps[name] = n;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const c = mix(COLORS[name], fog, t);
      const r = Math.round(c[0]);
      const g = Math.round(c[1]);
      const b = Math.round(c[2]);
      rgb.push([r, g, b]);
      css.push(`rgb(${r},${g},${b})`);
    }
  }

  const LEVEL_TABLE = new Float32Array(4 * 72 + 1);
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    const d = i / 4;
    const t = (1 - Math.exp(-d / 13)) * (FOG_STEPS - 1);
    LEVEL_TABLE[i] = Math.min(FOG_STEPS - 1, Math.max(0, Math.round(t)));
  }

  const level = (dist) => {
    const i = Math.min(LEVEL_TABLE.length - 1, Math.max(0, (dist * 4) | 0));
    return LEVEL_TABLE[i];
  };

  const index = (name, fogLevel = 0) => {
    const offset = offsets[name];
    if (offset === undefined) throw new Error(`Unknown colour: ${name}`);
    const n = steps[name];
    if (n === 1) return offset;
    return offset + Math.min(n - 1, Math.max(0, fogLevel | 0));
  };

  return { rgb, css, offsets, steps, fogLevel: level, index, names };
}
