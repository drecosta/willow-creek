// Shared colour palette. Every colour is pre-mixed through a small fog ramp so
// distant chars dissolve into soft forest haze instead of hard edges.

export const COLORS = {
  leafHi: [176, 205, 132],
  leafMid: [113, 154, 96],
  leafDark: [66, 103, 74],
  leafDeep: [33, 61, 50],

  pineHi: [126, 178, 138],
  pineMid: [67, 120, 100],
  pineDark: [37, 80, 72],
  pineDeep: [18, 45, 43],

  birchHi: [202, 218, 148],
  birchMid: [158, 188, 116],
  birchDark: [105, 140, 88],
  birchDeep: [60, 92, 62],

  willowHi: [185, 214, 158],
  willowMid: [130, 177, 136],
  willowDark: [79, 128, 105],
  willowStrand: [166, 203, 166],
  willowDeep: [45, 78, 64],

  barkHi: [154, 116, 82],
  barkMid: [111, 80, 57],
  barkDark: [71, 51, 40],

  birchBark: [224, 218, 190],
  birchMark: [74, 64, 55],

  rockHi: [166, 165, 150],
  rockMid: [122, 122, 112],
  rockDark: [79, 81, 76],
  moss: [110, 132, 82],

  borderHi: [43, 74, 61],
  borderMid: [27, 52, 45],
  borderDeep: [13, 28, 26],

  grassHi: [144, 174, 108],
  grassMid: [104, 138, 88],
  grassDark: [70, 102, 76],
  grassDeep: [42, 69, 57],
  grassDry: [166, 162, 115],

  flowerPink: [215, 148, 162],
  flowerYellow: [230, 202, 129],
  flowerWhite: [231, 232, 212],
  flowerViolet: [170, 151, 200],

  reeds: [126, 152, 98],

  sandHi: [220, 205, 168],
  sandMid: [190, 172, 133],
  sandDark: [148, 130, 100],

  pathHi: [205, 180, 136],
  pathMid: [168, 140, 100],
  pathDark: [124, 99, 72],
  pebble: [182, 178, 160],

  waterDeep: [20, 57, 70],
  waterMid: [37, 91, 103],
  waterHi: [78, 140, 145],
  waterFoam: [190, 216, 204],
  waterGlint: [246, 228, 172],

  woodHi: [177, 133, 87],
  woodMid: [130, 94, 64],
  woodDark: [82, 59, 44],
  woodNail: [202, 194, 170],

  skyTop: [32, 57, 72],
  skyMid: [107, 139, 137],
  skyHorizon: [239, 219, 177],
  sun: [255, 245, 195],
  sunGlow: [246, 211, 137],
  cloud: [232, 228, 206],
  cloudSoft: [204, 210, 194],
  bird: [55, 65, 62],

  firefly: [255, 227, 135],
  spirit: [255, 241, 186],
  pollen: [243, 234, 197],

  fog: [178, 190, 170],
};

export const FOG_STEPS = 6;
const NO_FOG = new Set([
  'skyTop',
  'skyMid',
  'skyHorizon',
  'sun',
  'sunGlow',
  'cloud',
  'cloudSoft',
  'bird',
  'fog',
]);

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
