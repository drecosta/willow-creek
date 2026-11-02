// Hand-drawn ASCII wall textures. Spaces are transparent (they reveal the sky
// gradient behind the canopy), which gives each tree a soft, irregular edge.

import { TILE } from './world.js';

const oak = {
  width: 16,
  height: 2.35,
  vGamma: 2.0,
  rows: [
    '      ....      ',
    '    ..####..    ',
    '   .##%%%%##.   ',
    '  .##%%@@%%##.  ',
    ' .##%%@@@@%%##. ',
    ' .#%%@@@@@@%%#. ',
    ' .#%%@@@@@@%%#. ',
    ' .#%%@@@@@@%%#. ',
    ' .##%%@@@@%%##. ',
    '  .##%%%%%%##.  ',
    '   .##%%%%##.   ',
    '    .#%%%%#.    ',
    '     .#%%#.     ',
    '      .##.      ',
    '      .##.      ',
    '       ||       ',
    '       ||       ',
    '      .||.      ',
    '      .||.      ',
    '      .||.      ',
    '      .||.      ',
    '      ||||      ',
    '      ||||      ',
    '     .||||.     ',
    '     .||||.     ',
    '     .||||.     ',
    '    ..||||..    ',
    '    .+||||+.    ',
    '   ..++++++..   ',
    '   .:++++++:.   ',
  ],
  colors: {
    '@': 'leafHi',
    '&': 'leafHi',
    '%': 'leafMid',
    '#': 'leafDark',
    ':': 'leafDeep',
    '.': 'leafDeep',
    '|': 'barkHi',
    '+': 'barkMid',
  },
};

const pine = {
  width: 16,
  height: 2.9,
  vGamma: 1.85,
  rows: [
    '       ..       ',
    '      .##.      ',
    '      .##.      ',
    '     .####.     ',
    '    .##%%##.    ',
    '    .##%%##.    ',
    '   .###%%###.   ',
    '   .###%%###.   ',
    '  .####%%####.  ',
    '  .####%%####.  ',
    ' .#####%%#####. ',
    ' .#####%%#####. ',
    '.######%%######.',
    ' .#####%%#####. ',
    '  .####%%####.  ',
    '   .###%%###.   ',
    '    .##%%##.    ',
    '     .####.     ',
    '      .##.      ',
    '       ||       ',
    '       ||       ',
    '      .||.      ',
    '      .||.      ',
    '      .||.      ',
    '      ||||      ',
    '      ||||      ',
    '     .||||.     ',
    '     .||||.     ',
    '    ..||||..    ',
    '    .+||||+.    ',
    '   ..++++++..   ',
    '   .:++++++:.   ',
  ],
  colors: {
    '%': 'pineHi',
    '#': 'pineMid',
    '.': 'pineDeep',
    ':': 'barkDark',
    '|': 'barkHi',
    '+': 'barkMid',
  },
};

const birch = {
  width: 16,
  height: 2.25,
  vGamma: 2.0,
  rows: [
    '       ..       ',
    '     ..%%..     ',
    '    .%%@@%%.    ',
    '   .%%@@@@%%.   ',
    '  .%%%@@@@%%%.  ',
    '  .%%@@@@@@%%.  ',
    ' .%%%@@@@@@%%%. ',
    ' .%%@@@@@@@@%%. ',
    ' .%%%@@@@@@%%%. ',
    '  .%%@@@@@@%%.  ',
    '  .%%%@@@@%%%.  ',
    '   .%%@@@@%%.   ',
    '    .%%@@%%.    ',
    '     ..%%..     ',
    '       ..       ',
    '       ||       ',
    '       ||       ',
    '       ||       ',
    '      .||.      ',
    '      .||.      ',
    '      .||.      ',
    '      ||||      ',
    '      ||||      ',
    '     .||||.     ',
    '     .||||.     ',
    '     .||||.     ',
    '    ..||||..    ',
    '    .+||||+.    ',
    '   ..++++++..   ',
    '   .:++++++:.   ',
  ],
  colors: {
    '@': 'birchHi',
    '%': 'birchMid',
    '.': 'birchDeep',
    ':': 'birchMark',
    '|': 'birchBark',
    '+': 'birchMark',
  },
};

const willow = {
  width: 16,
  height: 2.05,
  vGamma: 1.9,
  rows: [
    '      ....      ',
    '    ..%%%%..    ',
    '   .%%%@@%%%.   ',
    '  .%%@@@@@@%%.  ',
    ' .%%@@@@@@@@%%. ',
    ' .%@@@@@@@@@@%. ',
    ' .%@@@@@@@@@@%. ',
    ' .%%@@@@@@@@%%. ',
    '  .%%@@@@@@%%.  ',
    '  ..%%@@@@%%..  ',
    ' ~..%%%@@%%%..~ ',
    '  ~..%%%%%%..~  ',
    '   ~..%%%%..~   ',
    '     .:##:.     ',
    '    ~..:||:..~  ',
    '     ~.:||:.~   ',
    '      .:||:.    ',
    '      .:||:.    ',
    '       :||:     ',
    '       ||||     ',
    '       ||||     ',
    '      .||||.    ',
    '      .||||.    ',
    '     .||||||.   ',
    '     .||||||.   ',
    '    ..||||||..  ',
    '    .+||||||+.  ',
    '   ..++++++++.. ',
    '   .:++++++++:. ',
    '      ......    ',
  ],
  colors: {
    '@': 'willowHi',
    '%': 'willowMid',
    '#': 'willowDark',
    '~': 'willowStrand',
    '.': 'willowDeep',
    ':': 'willowDeep',
    '|': 'barkHi',
    '+': 'barkMid',
  },
};

const rock = {
  width: 16,
  height: 0.62,
  vGamma: 1.0,
  rows: [
    '      ....      ',
    '    ..####..    ',
    '   .##%%%%##.   ',
    '  .##%%@@%%##.  ',
    ' .##%%@@@@%%##. ',
    ' .#%%@@@@@@%%#. ',
    ' .#%%@@@@@@%%#. ',
    ' .##%%@@@@%%##. ',
    '  .##%%%%%%##.  ',
    '   .##%%%%##.   ',
    '  ..,:####:,... ',
    ' ...:######:... ',
  ],
  colors: {
    '@': 'rockHi',
    '%': 'rockMid',
    '#': 'rockDark',
    '.': 'rockDark',
    ':': 'rockDark',
    ',': 'moss',
  },
};

const bush = {
  width: 16,
  height: 0.5,
  vGamma: 1.0,
  rows: [
    '     ......     ',
    '   ..%%%%%%..   ',
    '  .%%@@@@@@%%.  ',
    ' .%%@@@**@@@%%. ',
    ' .%@@@*oo*@@@%. ',
    ' .%@@@*oo*@@@%. ',
    ' .%%@@@**@@@%%. ',
    '  .%%@@@@@@%%.  ',
    '   ..%%%%%%..   ',
    '     ......     ',
  ],
  colors: {
    '@': 'leafHi',
    '%': 'leafMid',
    '.': 'leafDeep',
    '*': 'flowerPink',
    'o': 'flowerYellow',
  },
};

const rail = {
  width: 16,
  height: 0.46,
  vGamma: 1.0,
  rows: [
    ' ||          || ',
    ' ||==========|| ',
    ' ||##########|| ',
    ' ||==========|| ',
    ' ||          || ',
    ' ||----------|| ',
    ' ||          || ',
    ' ||##########|| ',
    ' ||==========|| ',
    ' ||          || ',
    ' ||          || ',
    ' ||          || ',
  ],
  colors: {
    '=': 'woodHi',
    '#': 'woodMid',
    '-': 'woodDark',
    '|': 'woodDark',
  },
};

const borderRows = [];
const bhash = (x, y) => {
  let h = Math.imul(x + 13, 374761393) ^ Math.imul(y + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
for (let y = 0; y < 30; y++) {
  let row = '';
  for (let x = 0; x < 16; x++) {
    const n = bhash(x, y);
    row += n < 0.18 ? ':' : n < 0.45 ? '%' : n < 0.74 ? '#' : n < 0.9 ? '@' : '.';
  }
  borderRows.push(row);
}
const border = {
  width: 16,
  height: 2.8,
  vGamma: 1.0,
  rows: borderRows,
  colors: {
    ':': 'borderDeep',
    '.': 'borderDeep',
    '%': 'borderMid',
    '#': 'borderHi',
    '@': 'borderMid',
  },
};

export const WALL_TEXTURES = {
  [TILE.OAK]: oak,
  [TILE.PINE]: pine,
  [TILE.BIRCH]: birch,
  [TILE.WILLOW]: willow,
  [TILE.ROCK]: rock,
  [TILE.BUSH]: bush,
  [TILE.RAIL]: rail,
  [TILE.BORDER]: border,
};

// Fail loudly during development if a hand-edited row is the wrong width.
for (const [name, tex] of Object.entries({ oak, pine, birch, willow, rock, bush, rail, border })) {
  for (const [i, row] of tex.rows.entries()) {
    if (row.length !== tex.width) {
      throw new Error(`Texture ${name} row ${i} has width ${row.length}, expected ${tex.width}: "${row}"`);
    }
  }
}
