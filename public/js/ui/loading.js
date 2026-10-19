const STAGES = [
  [0, 'Contacting terrain service…'],
  [20, 'Fetching elevation tiles…'],
  [55, 'Analyzing water features…'],
  [80, 'Building 3D terrain…'],
  [95, 'Placing markers…'],
];

export class Loading {
  constructor(overlay, bar, text) {
    this.overlay = overlay;
    this.bar = bar;
    this.text = text;
  }

  start() {
    if (this.overlay) this.overlay.hidden = false;
    if (this.bar) this.bar.style.width = '0%';
  }

  stage(i) {
    const [pct, msg] = STAGES[Math.max(0, Math.min(i, STAGES.length - 1))];
    if (this.bar) this.bar.style.width = `${pct}%`;
    if (this.text) this.text.textContent = msg;
  }

  stop() {
    if (this.overlay) this.overlay.hidden = true;
  }
}
