// Night Ledger — keyboard and mouse state. Movement keys are read as a
// vector each step; clicks are queued as world points for the coin throw;
// single-press actions (start, restart, mute) are queued as named events.

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const ACTION_KEYS = {
  Enter: 'confirm',
  Space: 'confirm',
  KeyR: 'restart',
  KeyM: 'mute',
  KeyP: 'pause',
};

export class Input {
  constructor(canvas, toWorld) {
    this.held = new Set();
    this.sneaking = false;
    this.clicks = [];
    this.actions = [];
    this.mouse = { x: 0, y: 0 };

    window.addEventListener('keydown', (event) => {
      if (MOVE_KEYS[event.code] !== undefined) {
        this.held.add(MOVE_KEYS[event.code]);
        event.preventDefault();
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.sneaking = true;
      if (ACTION_KEYS[event.code] !== undefined && !event.repeat) this.actions.push(ACTION_KEYS[event.code]);
    });
    window.addEventListener('keyup', (event) => {
      if (MOVE_KEYS[event.code] !== undefined) this.held.delete(MOVE_KEYS[event.code]);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.sneaking = false;
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.sneaking = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      this.mouse = toWorld(event);
    });
    canvas.addEventListener('pointerdown', (event) => {
      this.clicks.push(toWorld(event));
    });
  }

  /** Movement direction as a unit-ish vector with components in {-1, 0, 1}. */
  vector() {
    const x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    const y = (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0);
    return { x, y };
  }

  takeClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  takeActions() {
    const out = this.actions;
    this.actions = [];
    return out;
  }
}
