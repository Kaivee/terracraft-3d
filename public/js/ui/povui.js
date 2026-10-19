const HINT = 'Click to look · WASD move · Space jump · Shift sprint · Esc exit';

export class PovHud {
  constructor({ container }) {
    this.container = container;
    this._lockSupported = this._featureDetect();
    this._build();
  }

  _featureDetect() {
    try {
      return typeof document !== 'undefined' && 'pointerLockElement' in document;
    } catch {
      return false;
    }
  }

  _build() {
    this.container.textContent = '';

    const hint = document.createElement('p');
    hint.className = 'pov-hint';
    hint.textContent = HINT;

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'pov-exit';
    exit.textContent = 'Exit';
    exit.addEventListener('click', () => {
      if (document.pointerLockElement) document.exitPointerLock();
    });

    this.container.append(hint, exit);

    if (!this._lockSupported) {
      exit.hidden = true;
      const note = document.createElement('p');
      note.className = 'pov-note';
      note.textContent = 'Pointer lock is not supported in this browser — POV is unavailable.';
      this.container.appendChild(note);
    }
  }

  show() {
    if (this.container) this.container.hidden = false;
  }

  hide() {
    if (this.container) this.container.hidden = true;
  }
}
