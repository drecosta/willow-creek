// One input model for keyboard, mouse, and thumbs. Movement is accumulated so
// the game loop never has to care which device produced it.

const DEADZONE = 0.16;

export class Input {
  constructor(canvas, joystickEl, knobEl) {
    this.canvas = canvas;
    this.joystickEl = joystickEl;
    this.knobEl = knobEl;
    this.keys = new Set();
    this.joyX = 0;
    this.joyY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.onAction = null;
    this.onFirstInput = null;
    this.hadInput = false;

    this.lookPointer = null;
    this.lookLastX = 0;
    this.lookLastY = 0;
    this.stickPointer = null;
    this.stickCenterX = 0;
    this.stickCenterY = 0;
    this.stickRadius = 44;

    this.bindKeyboard();
    this.bindLook();
    this.bindStick();
  }

  markInput() {
    if (this.hadInput) return;
    this.hadInput = true;
    if (this.onFirstInput) this.onFirstInput();
  }

  bindKeyboard() {
    const handled = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyQ',
      'KeyE',
    ]);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (handled.has(e.code)) e.preventDefault();
        return;
      }
      if (handled.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.markInput();

      if (e.code === 'KeyM' && this.onAction) this.onAction('mute');
      if (e.code === 'KeyH' && this.onAction) this.onAction('help');
      if (e.code === 'Escape' && this.onAction) this.onAction('escape');
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.releaseStick();
    });
  }

  bindLook() {
    const canvas = this.canvas;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      if (e.pointerType === 'touch') document.body.classList.add('touch');
      this.markInput();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      const dx = e.clientX - this.lookLastX;
      const dy = e.clientY - this.lookLastY;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
      this.lookX += dx;
      this.lookY += dy;
    });

    const release = (e) => {
      if (e.pointerId !== this.lookPointer) return;
      canvas.releasePointerCapture?.(e.pointerId);
      this.lookPointer = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
  }

  bindStick() {
    const stick = this.joystickEl;
    const knob = this.knobEl;
    if (!stick || !knob) return;

    const down = (e) => {
      if (this.stickPointer !== null) return;
      e.preventDefault();
      e.stopPropagation();
      this.stickPointer = e.pointerId;
      const rect = stick.getBoundingClientRect();
      this.stickCenterX = rect.left + rect.width / 2;
      this.stickCenterY = rect.top + rect.height / 2;
      this.stickRadius = rect.width * 0.34;
      stick.setPointerCapture?.(e.pointerId);
      stick.classList.add('active');
      if (e.pointerType === 'touch') document.body.classList.add('touch');
      this.markInput();
      this.moveStick(e.clientX, e.clientY);
    };

    const move = (e) => {
      if (e.pointerId !== this.stickPointer) return;
      e.preventDefault();
      this.moveStick(e.clientX, e.clientY);
    };

    const up = (e) => {
      if (e.pointerId !== this.stickPointer) return;
      this.releaseStick();
    };

    stick.addEventListener('pointerdown', down);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', up);
    stick.addEventListener('pointercancel', up);
    stick.addEventListener('lostpointercapture', up);
  }

  moveStick(clientX, clientY) {
    const dx = clientX - this.stickCenterX;
    const dy = clientY - this.stickCenterY;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(1, len / this.stickRadius);
    const ux = dx / len;
    const uy = dy / len;
    const visual = clamped < DEADZONE ? 0 : (clamped - DEADZONE) / (1 - DEADZONE);
    this.joyX = ux * visual;
    this.joyY = -uy * visual;

    const px = this.joyX * this.stickRadius;
    const py = -this.joyY * this.stickRadius;
    this.knobEl.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    this.knobEl.style.opacity = String(0.65 + visual * 0.35);
  }

  releaseStick() {
    this.stickPointer = null;
    this.joyX = 0;
    this.joyY = 0;
    if (this.knobEl) {
      this.knobEl.style.transform = 'translate(0px, 0px)';
      this.knobEl.style.opacity = '0.8';
    }
    if (this.joystickEl) this.joystickEl.classList.remove('active');
  }

  consumeLook() {
    const out = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return out;
  }

  axis(code, altCode) {
    return this.keys.has(code) || (altCode && this.keys.has(altCode)) ? 1 : 0;
  }

  move() {
    let forward = this.axis('KeyW', 'ArrowUp') - this.axis('KeyS', 'ArrowDown') + this.joyY;
    let strafe = this.axis('KeyD') - this.axis('KeyA') + this.joyX;
    const turn = this.axis('ArrowRight') - this.axis('ArrowLeft');
    const len = Math.hypot(forward, strafe);
    if (len > 1) {
      forward /= len;
      strafe /= len;
    }
    return {
      forward,
      strafe,
      turn,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  reset() {
    this.keys.clear();
    this.releaseStick();
    this.lookX = 0;
    this.lookY = 0;
    this.lookPointer = null;
  }
}
