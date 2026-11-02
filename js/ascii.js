// The complete glyph alphabet used by the game. Keeping every glyph in one
// pre-rendered atlas is what makes thousands of coloured characters cheap to
// draw on a phone.

import { WALL_TEXTURES } from './textures.js';

const EXTRA = " .,:;'\"`^~-_=+*/\\|@#$%&oOvY()[]{}!?";

const set = new Set();
for (const ch of EXTRA) set.add(ch);
for (const tex of Object.values(WALL_TEXTURES)) {
  for (const row of tex.rows) for (const ch of row) set.add(ch);
}

// Space first so index 0 means "nothing here" (background shows through).
export const CHARS = [' ', ...Array.from(set).filter((ch) => ch !== ' ')];
export const CHAR_INDEX = new Map(CHARS.map((ch, i) => [ch, i]));

export function glyph(ch) {
  const i = CHAR_INDEX.get(ch);
  if (i === undefined) throw new Error(`Glyph not registered: ${JSON.stringify(ch)}`);
  return i;
}
