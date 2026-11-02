// Procedural soundscape: wind, creek, birds, footsteps, and the little chime
// of a spirit light. No audio files, no waiting.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this.riverGain = null;
    this.riverFilter = null;
    this.windGain = null;
    this.stepSide = 0;
    this.birdTimer = null;
    this.noiseBuffer = null;
    this.fxBus = null;
    this.padGain = null;

    try {
      this.muted = localStorage.getItem('willow.muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  async init() {
    if (this.started) {
      await this.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    const ctx = this.ctx;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.3;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(compressor);
    compressor.connect(ctx.destination);

    this.fxBus = ctx.createGain();
    this.fxBus.gain.value = 1;
    this.fxBus.connect(this.master);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.24;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.24;
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    this.fxBus.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.master);

    this.noiseBuffer = this.makeNoise(4);
    this.buildWind();
    this.buildRiver();
    this.buildPad();

    this.started = true;
    this.scheduleBird(rand(4, 9));
    await this.resume();
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.97 + white * 0.03;
      data[i] = last * 4.2;
    }
    return buf;
  }

  noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  buildWind() {
    const ctx = this.ctx;
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.value = 0.036;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.061;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.014;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.037;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 160;
    sweep.connect(sweepGain);
    sweepGain.connect(filter.frequency);

    src.start();
    lfo.start();
    sweep.start();
    this.windGain = gain;
  }

  buildRiver() {
    const ctx = this.ctx;
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 960;
    filter.Q.value = 0.75;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.028;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.09;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 240;
    sweep.connect(sweepGain);
    sweepGain.connect(filter.frequency);

    src.start();
    lfo.start();
    sweep.start();
    this.riverGain = gain;
    this.riverFilter = filter;
  }

  buildPad() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.4;
    filter.connect(gain);

    for (const [freq, detune, level] of [
      [110, -4, 0.5],
      [164.81, 3, 0.34],
      [220, -2, 0.16],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(filter);
      osc.start();
    }

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.043;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.padGain = gain;
    gain.gain.setTargetAtTime(0.012, ctx.currentTime, 2.5);
  }

  async resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* Ignore a blocked resume. */
      }
    }
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem('willow.muted', muted ? '1' : '0');
    } catch {
      /* Storage can be unavailable in private mode. */
    }
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.06);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    if (!this.muted) this.resume();
    return this.muted;
  }

  setWaterProximity(distance) {
    if (!this.ctx || !this.riverGain) return;
    const near = clamp(1 - distance / 9, 0, 1);
    const target = near * near * 0.115;
    this.riverGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    if (this.riverFilter) {
      this.riverFilter.frequency.setTargetAtTime(760 + near * 700, this.ctx.currentTime, 0.9);
    }
  }

  scheduleBird(delay) {
    if (this.birdTimer) clearTimeout(this.birdTimer);
    this.birdTimer = setTimeout(() => {
      if (this.ctx && this.ctx.state === 'running' && !this.muted) this.chirp();
      this.scheduleBird(rand(5, 14));
    }, Math.max(800, delay * 1000));
  }

  chirp() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = rand(-0.8, 0.8);
      pan.connect(this.fxBus);
    }
    const out = pan || this.fxBus;
    const base = rand(1700, 3100);
    const notes = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < notes; i++) {
      const t = now + i * rand(0.06, 0.11);
      const osc = ctx.createOscillator();
      osc.type = pick(['sine', 'triangle']);
      const freq = base * rand(0.92, 1.12) * (i % 2 === 0 ? 1 : 1.18);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(rand(0.018, 0.032), t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.09, 0.18));
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * rand(0.8, 1.35), t + 0.09);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  }

  step(surface = 'grass') {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.stepSide = 1 - this.stepSide;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = this.stepSide ? 0.18 : -0.18;
      pan.connect(this.master);
    }
    const out = pan || this.master;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const offset = rand(0, 2.5);
    const filter = ctx.createBiquadFilter();
    filter.type = surface === 'bridge' ? 'bandpass' : 'lowpass';
    filter.frequency.value = surface === 'bridge' ? 380 : surface === 'sand' ? 900 : 520;
    filter.Q.value = surface === 'bridge' ? 1.2 : 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(surface === 'bridge' ? 0.05 : 0.035, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now, offset, 0.18);
    src.stop(now + 0.18);

    if (surface === 'bridge') {
      const thump = ctx.createOscillator();
      thump.type = 'sine';
      const tg = ctx.createGain();
      thump.frequency.setValueAtTime(96, now);
      thump.frequency.exponentialRampToValueAtTime(58, now + 0.12);
      tg.gain.setValueAtTime(0.045, now);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      thump.connect(tg);
      tg.connect(out);
      thump.start(now);
      thump.stop(now + 0.18);
    }
  }

  chime() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.085;
      for (const [type, level] of [
        ['sine', 0.055],
        ['triangle', 0.022],
      ]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(level, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        osc.connect(gain);
        gain.connect(this.fxBus);
        osc.start(t);
        osc.stop(t + 1.5);
      }
    });
  }

  complete() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const t = t0 + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      osc.connect(gain);
      gain.connect(this.fxBus);
      osc.start(t);
      osc.stop(t + 2.3);
    });
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resumeIfNeeded() {
    if (this.ctx && !this.muted) this.resume();
  }
}
