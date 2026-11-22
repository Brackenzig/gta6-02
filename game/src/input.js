// Keyboard and mouse input for SOLMAR.
// Tracks held keys plus edge-triggered "pressed this frame" events, so
// actions like stealing a car or punching fire exactly once per keypress
// instead of once per frame while the key is held.

// Keys are normalised to lower-case `event.key` values. Movement reads
// both WASD and the arrow keys.
const MOVE_KEYS = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this._onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      // Don't let the page scroll on arrows/space while playing.
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(key);
      this.held.add(key);
    };
    this._onKeyUp = (event) => {
      this.held.delete(event.key.toLowerCase());
    };
    this._onBlur = () => {
      this.held.clear();
      this.pressed.clear();
    };
    this._onMouseDown = () => {
      this.pressed.add('mouse');
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousedown', this._onMouseDown);
  }

  // Call once per frame after the game has read the input: clears the
  // edge-triggered set so a press only counts for one frame.
  endFrame() {
    this.pressed.clear();
  }

  isDown(key) {
    return this.held.has(key.toLowerCase());
  }

  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  // -1 / 0 / +1 forward axis (W/S or Up/Down).
  axisY() {
    let value = 0;
    if (MOVE_KEYS.up.some((k) => this.held.has(k))) value += 1;
    if (MOVE_KEYS.down.some((k) => this.held.has(k))) value -= 1;
    return value;
  }

  // -1 / 0 / +1 strafe axis (A/D or Left/Right).
  axisX() {
    let value = 0;
    if (MOVE_KEYS.right.some((k) => this.held.has(k))) value += 1;
    if (MOVE_KEYS.left.some((k) => this.held.has(k))) value -= 1;
    return value;
  }

  get running() {
    return this.held.has('shift');
  }

  get handbrake() {
    return this.held.has(' ');
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousedown', this._onMouseDown);
  }
}
