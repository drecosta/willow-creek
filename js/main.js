// Willow Creek. Walk. Listen. Gather the lights.

import { generateWorld, zoneName, isWalkableAt, TILE } from './world.js';
import { Renderer } from './renderer.js';
import { CanvasView } from './view.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';

const TWO_PI = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const shortest = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
};

const canvas = document.getElementById('view');
const fx = document.getElementById('fx');
const hud = document.getElementById('hud');
const zoneEl = document.getElementById('zone');
const headingEl = document.getElementById('heading');
const lightsEl = document.getElementById('lights');
const muteBtn = document.getElementById('mute');
const helpBtn = document.getElementById('help-btn');
const joystick = document.getElementById('joystick');
const knob = document.getElementById('knob');

const startScreen = document.getElementById('start');
const beginBtn = document.getElementById('begin');
const howBtn = document.getElementById('how');
const helpScreen = document.getElementById('help');
const closeHelp = document.getElementById('close-help');
const endScreen = document.getElementById('end');
const wanderBtn = document.getElementById('wander');
const againBtn = document.getElementById('again');
const endCopy = document.getElementById('end-copy');
const toastEl = document.getElementById('toast');
const loading = document.getElementById('loading');

const DIRS = [
  { name: 'N', ang: -Math.PI / 2 },
  { name: 'NE', ang: -Math.PI / 4 },
  { name: 'E', ang: 0 },
  { name: 'SE', ang: Math.PI / 4 },
  { name: 'S', ang: Math.PI / 2 },
  { name: 'SW', ang: (3 * Math.PI) / 4 },
  { name: 'W', ang: Math.PI },
  { name: 'NW', ang: (-3 * Math.PI) / 4 },
];

const world = generateWorld();
const renderer = new Renderer(96, 44);
const view = new CanvasView(canvas);
const input = new Input(canvas, joystick, knob);
const audio = new AudioEngine();

const state = {
  px: world.start.x,
  py: world.start.y,
  yaw: world.start.angle,
  dirX: Math.cos(world.start.angle),
  dirY: Math.sin(world.start.angle),
  planeX: -Math.sin(world.start.angle) * 0.68,
  planeY: Math.cos(world.start.angle) * 0.68,
  time: 0,
  horizonOffset: 0,
  sunAngle: -1.95,
  collected: new Set(),
  velX: 0,
  velY: 0,
  breath: 0,
  bob: 0,
  stepTimer: 0,
  stepDist: 0,
  lastZone: '',
  lastZoneToast: -99,
  lastLight: -1,
  finished: false,
  started: false,
  paused: true,
  lastToast: 0,
  pitch: 0,
  waterTick: 0,
};

let last = performance.now();
let acc = 0;
let toastTimer = 0;
let resizeTimer = 0;
const FIXED = 1 / 60;

function resize() {
  const { cols, rows } = view.resize(renderer);
  renderer.w = cols;
  renderer.h = rows;
  renderer.chars = new Uint16Array(cols * rows);
  renderer.colors = new Uint16Array(cols * rows);
  renderer.bg = new Uint16Array(cols * rows);
  renderer.zBuffer = new Float32Array(cols);
  renderer.horizon = rows * 0.44;
  state.pitch = clamp(state.pitch, -rows * 0.18, rows * 0.18);
}

function buildCam() {
  state.dirX = Math.cos(state.yaw);
  state.dirY = Math.sin(state.yaw);
  const p = 0.68;
  state.planeX = -Math.sin(state.yaw) * p;
  state.planeY = Math.cos(state.yaw) * p;
}

function canMove(x, y) {
  if (!isWalkableAt(world, x, y)) return false;
  const r = 0.22;
  const q = r * 0.7071;
  return (
    isWalkableAt(world, x + r, y) &&
    isWalkableAt(world, x - r, y) &&
    isWalkableAt(world, x, y + r) &&
    isWalkableAt(world, x, y - r) &&
    isWalkableAt(world, x + q, y + q) &&
    isWalkableAt(world, x + q, y - q) &&
    isWalkableAt(world, x - q, y + q) &&
    isWalkableAt(world, x - q, y - q)
  );
}

function update(dt) {
  state.time += dt * 0.6;
  if (!state.started || state.paused) return;

  const look = input.consumeLook();
  const axis = input.move();

  state.yaw += look.x * 0.0032 + axis.turn * 1.7 * dt;
  state.pitch = clamp(state.pitch - look.y * 0.055, -renderer.h * 0.18, renderer.h * 0.18);
  buildCam();

  const sprint = axis.sprint && (axis.forward !== 0 || axis.strafe !== 0);
  const maxSpeed = sprint ? 3.2 : 2.38;
  const accel = sprint ? 14 : 10.4;
  const drag = 7.2;

  const fwdX = state.dirX;
  const fwdY = state.dirY;
  const rx = -state.dirY;
  const ry = state.dirX;

  let dx = fwdX * axis.forward + rx * axis.strafe;
  let dy = fwdY * axis.forward + ry * axis.strafe;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  state.velX += dx * accel * dt;
  state.velY += dy * accel * dt;
  const sv = Math.hypot(state.velX, state.velY);
  if (sv > maxSpeed) {
    state.velX = (state.velX / sv) * maxSpeed;
    state.velY = (state.velY / sv) * maxSpeed;
  }
  state.velX *= 1 - Math.min(1, drag * dt);
  state.velY *= 1 - Math.min(1, drag * dt);

  state.waterTick -= dt;
  if (state.waterTick <= 0) {
    state.waterTick = 0.35;
    const wx = Math.floor(state.px);
    const wy = Math.floor(state.py);
    const wi = wy * world.w + wx;
    audio.setWaterProximity(world.distToWater ? world.distToWater[wi] ?? 12 : 12);
  }

  const speed = Math.hypot(state.velX, state.velY);
  if (speed > 0.012) {
    const nx = state.px + state.velX * dt;
    const ny = state.py + state.velY * dt;
    const pxCell = Math.floor(nx);
    const pyCell = Math.floor(ny);
    if (canMove(nx, state.py)) state.px = nx;
    if (canMove(state.px, ny)) state.py = ny;
    const tile = world.tiles[pyCell * world.w + pxCell] ?? 12;

    state.stepDist += speed * dt;
    state.stepTimer -= dt;
    if (state.stepTimer <= 0 && state.stepDist > 0.52) {
      let surf = 'grass';
      if (tile === TILE.BRIDGE) surf = 'bridge';
      else if (tile === TILE.SAND) surf = 'sand';
      else if (tile === TILE.PATH) surf = 'grass';
      audio.step(surf);
      state.stepTimer = speed > 2.6 ? 0.28 : 0.36;
      state.stepDist = 0;
    }

    state.bob += dt * (speed > 2.6 ? 9.4 : 7.2);
    state.horizonOffset = Math.sin(state.bob) * (speed > 2.6 ? 2.2 : 1.6);
  } else {
    state.horizonOffset = lerp(state.horizonOffset, 0, dt * 6);
    state.bob *= 0.9;
    state.velX *= 0.78;
    state.velY *= 0.78;
  }

  state.breath += dt * 0.8;

  const zone = zoneName(world, state.px, state.py);
  if (zone !== state.lastZone) {
    state.lastZone = zone;
    zoneEl.textContent = zone;
    if (state.time - state.lastZoneToast > 6) {
      state.lastZoneToast = state.time;
      showToast(zone);
    }
  }

  const heading = headingName(state.yaw);
  headingEl.textContent = heading;

  const cx = Math.floor(state.px);
  const cy = Math.floor(state.py);
  for (const c of world.collectibles || []) {
    if (state.collected.has(c.id)) continue;
    const dxv = state.px - c.x;
    const dyv = state.py - c.y;
    if (dxv * dxv + dyv * dyv < 0.8) {
      state.collected.add(c.id);
      audio.chime();
      const count = state.collected.size;
      lightsEl.textContent = count + ' / 9';
      if (count === 1) showToast('a spirit light follows the creek');
      if (count === 3) showToast('mossy banks hide more');
      if (count === 6) showToast('almost all gathered');
      if (count === 9) {
        showToast('all nine lights gathered');
        finishWalk();
      }
    }
  }

  if (state.collected.size !== state.lastLight) {
    state.lastLight = state.collected.size;
    lightsEl.textContent = state.collected.size + ' / 9';
  }
}

function headingName(yaw) {
  let a = yaw;
  while (a < -Math.PI) a += TWO_PI;
  while (a > Math.PI) a -= TWO_PI;
  let best = 0;
  let bestD = 10;
  for (let i = 0; i < DIRS.length; i++) {
    const d = Math.abs(shortest(a, DIRS[i].ang));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return DIRS[best].name;
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('show');
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function finishWalk() {
  if (state.finished) return;
  state.finished = true;
  state.paused = true;
  document.body.classList.add('paused');
  audio.complete();
  input.reset();
  setTimeout(() => {
    document.body.classList.remove('playing');
    endCopy.textContent = 'The glade settles. Nine small lights keep the creek company. Wander on, or take the walk from the start again.';
    endScreen.classList.remove('is-hidden');
    endScreen.setAttribute('aria-hidden', 'false');
  }, 900);
}

function begin() {
  audio.init().catch(() => {});
  audio.resumeIfNeeded();
  startScreen.classList.add('is-hidden');
  startScreen.setAttribute('aria-hidden', 'true');
  helpScreen.classList.add('is-hidden');
  helpScreen.setAttribute('aria-hidden', 'true');
  endScreen.classList.add('is-hidden');
  endScreen.setAttribute('aria-hidden', 'true');
  loading.classList.add('is-hidden');
  loading.style.pointerEvents = 'none';
  state.started = true;
  state.paused = false;
  state.finished = false;
  state.collected.clear();
  state.px = world.start.x;
  state.py = world.start.y;
  state.yaw = world.start.angle;
  state.lastZone = zoneName(world, state.px, state.py);
  state.lastZoneToast = state.time + 3;
  state.lastLight = -1;
  zoneEl.textContent = state.lastZone;
  buildCam();
  state.velX = 0;
  state.velY = 0;
  state.pitch = 0;
  state.waterTick = 0;
  input.reset();
  document.body.classList.add('playing');
  document.body.classList.remove('paused');
  hud.classList.remove('is-hidden');
  lightsEl.textContent = '0 / 9';
  showToast('follow the creek');
  if (audio.muted) muteBtn.setAttribute('aria-pressed', 'true');
  else muteBtn.setAttribute('aria-pressed', 'false');
}

function openHelp() {
  if (!state.started) {
    startScreen.classList.add('is-hidden');
    startScreen.setAttribute('aria-hidden', 'true');
  }
  helpScreen.classList.remove('is-hidden');
  helpScreen.setAttribute('aria-hidden', 'false');
  state.paused = true;
  document.body.classList.add('paused');
  audio.resumeIfNeeded();
}

function closeHelpScreen() {
  helpScreen.classList.add('is-hidden');
  helpScreen.setAttribute('aria-hidden', 'true');
  if (state.started) {
    state.paused = false;
    document.body.classList.remove('paused');
  } else {
    startScreen.classList.remove('is-hidden');
    startScreen.setAttribute('aria-hidden', 'false');
  }
}

function mute() {
  const muted = audio.toggleMuted();
  muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  showToast(muted ? 'sound off' : 'sound on');
}

function wander() {
  endScreen.classList.add('is-hidden');
  endScreen.setAttribute('aria-hidden', 'true');
  state.paused = false;
  document.body.classList.add('playing');
  document.body.classList.remove('paused');
}

function again() {
  endScreen.classList.add('is-hidden');
  endScreen.setAttribute('aria-hidden', 'true');
  state.started = false;
  state.paused = true;
  state.finished = false;
  state.collected.clear();
  state.px = world.start.x;
  state.py = world.start.y;
  state.yaw = world.start.angle;
  state.pitch = 0;
  state.velX = 0;
  state.velY = 0;
  state.horizonOffset = 0;
  state.lastZone = '';
  state.lastZoneToast = -99;
  buildCam();
  lightsEl.textContent = '0 / 9';
  document.body.classList.remove('playing');
  startScreen.classList.remove('is-hidden');
  startScreen.setAttribute('aria-hidden', 'false');
}

let lastRender = 0;

function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  while (acc >= FIXED) {
    update(FIXED);
    acc -= FIXED;
  }

  if (now - lastRender < 1000 / 30) {
    requestAnimationFrame(loop);
    return;
  }
  lastRender = now;

  const cam = {
    px: state.px,
    py: state.py,
    yaw: state.yaw,
    dirX: state.dirX,
    dirY: state.dirY,
    planeX: state.planeX,
    planeY: state.planeY,
    time: state.time,
    horizonOffset: state.horizonOffset + state.pitch,
    sunAngle: state.sunAngle,
    collected: state.collected,
  };

  const frame = renderer.render(world, cam);
  view.draw(frame);
  requestAnimationFrame(loop);
}

beginBtn.addEventListener('click', begin);
howBtn.addEventListener('click', openHelp);
helpBtn.addEventListener('click', openHelp);
closeHelp.addEventListener('click', closeHelpScreen);
muteBtn.addEventListener('click', mute);
wanderBtn.addEventListener('click', wander);
againBtn.addEventListener('click', again);

input.onAction = (action) => {
  if (action === 'mute') mute();
  if (action === 'help') {
    if (helpScreen.classList.contains('is-hidden')) openHelp();
    else closeHelpScreen();
  }
  if (action === 'escape') {
    if (!helpScreen.classList.contains('is-hidden')) closeHelpScreen();
    else if (!endScreen.classList.contains('is-hidden')) wander();
  }
};

input.onFirstInput = () => {
  if (!state.started) return;
  audio.init().catch(() => {});
  audio.resumeIfNeeded();
};

function scheduleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 180);
}

async function boot() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    await Promise.race([
      document.fonts ? document.fonts.load('500 16px "IBM Plex Mono"') : Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 1600)),
    ]);
  } catch {
    /* A fallback monospace is perfectly fine. */
  }
  resize();
  buildCam();
  requestAnimationFrame(loop);
  setTimeout(() => {
    loading.classList.add('is-hidden');
    loading.style.pointerEvents = 'none';
  }, 250);
}

window.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', () => setTimeout(resize, 280));

boot();
