# Willow Creek

A quiet first-person walk through a forest and along a creek, drawn entirely in ASCII. Made for a phone in your hand.

**Play:** https://drecosta.github.io/willow-creek/

## The walk

Follow the creek. Gather the nine spirit lights. There is no hurry.

- **WASD / arrow keys** walk and turn
- **Shift** hurry
- **Drag** look around
- **Left thumbstick** walk on touch
- **Right side drag** look on touch
- **M** sound on / off
- **H** controls

## How it is made

The world is deterministic: a 58 x 58 forest with a winding river, a stillwater pool, an old bridge, carved trails, glades, fireflies, and drifting pollen. A small raycaster fills a grid of glyph and palette indices using tall tree and rock textures. `CanvasView` pre-renders every glyph in every fog colour into a few offscreen atlas pages, then blits them to the screen. Sound is procedural Web Audio: wind, creek proximity, birds, footsteps, and a chime for each light.

No game engine, no build step, no image assets.

## Local development

```sh
npm start
```

Open `http://127.0.0.1:4173/`.

```sh
npm run check
npm run preview
```

`npm run check` exercises the world, palette, renderer, atlas bounds, and HTML wiring in Node. `npm run preview` prints an ASCII scene to the terminal.
