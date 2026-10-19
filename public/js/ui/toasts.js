const KINDS = { error: 'toast-error', info: 'toast-info', success: 'toast-success', warn: 'toast-warn' };
export class Toasts {
  constructor(container = document.body) { this.container = container; }
  show(message, kind = 'error', ms = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${KINDS[kind] || KINDS.info}`;
    el.innerHTML = `<span class="toast-dot" aria-hidden="true"></span><span>${message}</span>`;
    this.container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    setTimeout(() => {
      el.classList.remove('toast-in');
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, ms);
  }
}
